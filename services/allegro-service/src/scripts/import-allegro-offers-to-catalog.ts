import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OffersService } from '../allegro/offers/offers.service';
import { PrismaService } from '@allegro/shared';
import { buildScriptSafety, redactedError, requireExactConfirmation } from './lib/script-safety';

type Args = {
  userId?: string;
  accountId?: string;
  accountName?: string;
  allAccounts: boolean;
  offerIds: string[];
  apply: boolean;
  activateAccount: boolean;
  confirmCatalogApply?: string;
  confirmActivateAccount?: string;
  help: boolean;
};

const CATALOG_IMPORT_CONFIRMATION = 'ALLEGRO_ACTIVE_OFFER_CATALOG_IMPORT';
const ACTIVATE_ACCOUNT_CONFIRMATION = 'ALLEGRO_IMPORT_ACTIVATE_ACCOUNT';

function printHelp(): void {
  console.log(`Import Allegro offers into Catalog.

Usage:
  npm run import:allegro-offers:catalog -- --account-name ClipFlop --offer-id 18106529080 --dry-run
  npm run import:allegro-offers:catalog -- --account-id <uuid> --offer-ids 18106529080,18106529081 --apply --activate-account --confirm-activate-account ${ACTIVATE_ACCOUNT_CONFIRMATION} --confirm-catalog-apply ${CATALOG_IMPORT_CONFIRMATION}
  npm run import:allegro-offers:catalog -- --all-accounts --all --dry-run
  npm run import:allegro-offers:catalog -- --all-accounts --all --apply --activate-account --confirm-activate-account ${ACTIVATE_ACCOUNT_CONFIRMATION} --confirm-catalog-apply ${CATALOG_IMPORT_CONFIRMATION}
  npm run import:allegro-offers:catalog -- --user-id <uuid> --all --apply --confirm-catalog-apply ${CATALOG_IMPORT_CONFIRMATION}

Options:
  --account-name <name>  Resolve this Allegro account. Applying with an account selector requires explicit activation confirmation.
  --account-id <uuid>    Resolve this Allegro account. Applying with an account selector requires explicit activation confirmation.
  --all-accounts         Resolve all Allegro accounts. Applying requires explicit activation confirmation and imports sequentially.
  --user-id <uuid>       User id to import for. Required when no account selector is provided.
  --offer-id <id>        Import one Allegro offer. Can be repeated.
  --offer-ids <ids>      Comma-separated Allegro offer ids.
  --all                  Import all offers visible to the active Allegro account.
  --dry-run              Resolve and print the mutation plan only. Default.
  --apply                Execute Catalog/local offer/Warehouse stock import through OffersService.
  --confirm-catalog-apply <${CATALOG_IMPORT_CONFIRMATION}>
                         Required with --apply.
  --activate-account     Update active Allegro account before applying. Never implicit.
  --confirm-activate-account <${ACTIVATE_ACCOUNT_CONFIRMATION}>
                         Required with --activate-account.
`);
}

function normalizeOfferId(value: string): string {
  return value.trim().replace(/^ALLEGRO-OFFER-/i, '');
}

function parseArgs(argv: string[]): Args {
  const args: Args = { allAccounts: false, offerIds: [], apply: false, activateAccount: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--user-id') {
      args.userId = next();
    } else if (arg === '--account-id') {
      args.accountId = next();
    } else if (arg === '--account-name') {
      args.accountName = next();
    } else if (arg === '--all-accounts') {
      args.allAccounts = true;
    } else if (arg === '--offer-id') {
      args.offerIds.push(normalizeOfferId(next()));
    } else if (arg === '--offer-ids') {
      args.offerIds.push(...next().split(',').map(normalizeOfferId).filter(Boolean));
    } else if (arg === '--all') {
      // Explicit readability flag. Import-all is also the fallback when no offer ids are supplied.
    } else if (arg === '--dry-run') {
      args.apply = false;
    } else if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--confirm-catalog-apply') {
      args.confirmCatalogApply = next();
    } else if (arg === '--activate-account') {
      args.activateAccount = true;
    } else if (arg === '--confirm-activate-account') {
      args.confirmActivateAccount = next();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.offerIds = Array.from(new Set(args.offerIds.filter(Boolean)));
  if (args.allAccounts && (args.accountId || args.accountName || args.userId)) {
    throw new Error('Use --all-accounts without --account-id, --account-name, or --user-id.');
  }
  return args;
}

function buildImportSafety(args: Args): Record<string, unknown> {
  return buildScriptSafety({
    mode: args.apply ? 'apply' : 'dry-run',
    mutates: args.apply,
    mutatesLocalAllegroProjection: args.apply,
    mutatesCatalog: args.apply,
    mutatesWarehouse: args.apply,
    mutatesOrders: false,
    mutatesAllegro: false,
    forwardsOrders: false,
    writesAllowed: args.apply ? ['catalog-microservice', 'allegro_offers', 'warehouse-microservice'] : [],
    writesForbidden: ['orders-microservice', 'allegro-write-api', 'bizbox-import'],
    ...(args.apply
      ? { confirmation: { flag: '--confirm-catalog-apply', expected: CATALOG_IMPORT_CONFIRMATION, satisfied: true } }
      : {}),
  });
}

type ResolvedImportAccount = { userId: string; accountId?: string; accountName?: string; isActive?: boolean };

async function resolveAccounts(prisma: PrismaService, args: Args): Promise<ResolvedImportAccount[]> {
  if (args.allAccounts) {
    const accounts = await prisma.allegroAccount.findMany({
      select: { id: true, userId: true, name: true, isActive: true, updatedAt: true },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    return accounts.map((account) => ({
      userId: account.userId,
      accountId: account.id,
      accountName: account.name,
      isActive: account.isActive,
    }));
  }

  if (args.accountId) {
    const account = await prisma.allegroAccount.findUnique({
      where: { id: args.accountId },
      select: { id: true, userId: true, name: true },
    });
    if (!account) {
      throw new Error(`Allegro account not found: ${args.accountId}`);
    }
    if (args.userId && args.userId !== account.userId) {
      throw new Error(`Account ${args.accountId} belongs to another user.`);
    }
    return [{ userId: account.userId, accountId: account.id, accountName: account.name }];
  }

  if (args.accountName) {
    const accounts = await prisma.allegroAccount.findMany({
      where: {
        name: { equals: args.accountName, mode: 'insensitive' },
        ...(args.userId ? { userId: args.userId } : {}),
      },
      select: { id: true, userId: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    if (accounts.length === 0) {
      throw new Error(`Allegro account not found by name: ${args.accountName}`);
    }
    if (accounts.length > 1) {
      const choices = accounts.map((account) => `${account.name}:${account.id}:${account.userId}`).join(', ');
      throw new Error(`Account name is ambiguous. Use --account-id. Matches: ${choices}`);
    }

    return [{ userId: accounts[0].userId, accountId: accounts[0].id, accountName: accounts[0].name }];
  }

  if (!args.userId) {
    throw new Error('Provide --account-name, --account-id, or --user-id.');
  }

  return [{ userId: args.userId }];
}

async function activateAccount(prisma: PrismaService, userId: string, accountId?: string): Promise<void> {
  if (!accountId) {
    return;
  }

  await Promise.all([
    prisma.allegroAccount.updateMany({
      where: { userId, id: { not: accountId } },
      data: { isActive: false },
    }),
    prisma.allegroAccount.update({
      where: { id: accountId },
      data: { isActive: true },
    }),
  ]);

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (settings) {
    const preferences = { ...((settings.preferences || {}) as Record<string, unknown>), activeAllegroAccountId: accountId };
    await prisma.userSettings.update({
      where: { userId },
      data: { preferences },
    });
  } else {
    await prisma.userSettings.create({
      data: {
        userId,
        preferences: { activeAllegroAccountId: accountId },
        supplierConfigs: [],
      },
    });
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.apply) {
    requireExactConfirmation(args.confirmCatalogApply, CATALOG_IMPORT_CONFIRMATION, '--confirm-catalog-apply');
    if (args.activateAccount) {
      requireExactConfirmation(args.confirmActivateAccount, ACTIVATE_ACCOUNT_CONFIRMATION, '--confirm-activate-account');
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const prisma = app.get(PrismaService);
    const offersService = app.get(OffersService);
    const resolvedAccounts = await resolveAccounts(prisma, args);
    if (!resolvedAccounts.length) {
      throw new Error('No matching Allegro accounts found.');
    }
    const safety = buildImportSafety(args);

    if (!args.apply) {
      console.log(JSON.stringify({
        status: 'ok',
        mode: 'dry-run',
        safety,
        accounts: resolvedAccounts.map((account) => ({
          userId: account.userId,
          accountId: account.accountId || null,
          accountName: account.accountName || null,
          isActive: account.isActive ?? null,
        })),
        offerIds: args.offerIds,
        wouldImportAll: args.offerIds.length === 0,
        note: 'No Catalog, local offer, Warehouse, active-account, orders, BizBox, or Allegro write was executed.',
      }, null, 2));
      return;
    }

    if (resolvedAccounts.some((account) => account.accountId) && !args.activateAccount) {
      throw new Error('Applying with --account-id, --account-name, or --all-accounts requires --activate-account plus --confirm-activate-account because OffersService imports from the active Allegro account.');
    }

    const results = [];
    for (const resolved of resolvedAccounts) {
      if (args.activateAccount) {
        await activateAccount(prisma, resolved.userId, resolved.accountId);
      }
      const result = args.offerIds.length > 0
        ? await offersService.importApprovedOffers(resolved.userId, args.offerIds)
        : await offersService.importAllOffers(resolved.userId);
      results.push({
        userId: resolved.userId,
        accountId: resolved.accountId || null,
        accountName: resolved.accountName || null,
        result,
      });
    }

    console.log(JSON.stringify({
      status: 'ok',
      safety,
      offerIds: args.offerIds,
      accounts: results,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ...redactedError(error),
  }, null, 2));
  process.exit(1);
});
