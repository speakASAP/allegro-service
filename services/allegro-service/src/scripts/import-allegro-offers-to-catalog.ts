import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OffersService } from '../allegro/offers/offers.service';
import { PrismaService } from '@allegro/shared';

type Args = {
  userId?: string;
  accountId?: string;
  accountName?: string;
  offerIds: string[];
  help: boolean;
};

function printHelp(): void {
  console.log(`Import Allegro offers into Catalog.

Usage:
  npm run import:allegro-offers:catalog -- --account-name ClipFlop --offer-id 18106529080
  npm run import:allegro-offers:catalog -- --account-id <uuid> --offer-ids 18106529080,18106529081
  npm run import:allegro-offers:catalog -- --user-id <uuid> --all

Options:
  --account-name <name>  Resolve and activate this Allegro account before import.
  --account-id <uuid>    Resolve and activate this Allegro account before import.
  --user-id <uuid>       User id to import for. Required when no account selector is provided.
  --offer-id <id>        Import one Allegro offer. Can be repeated.
  --offer-ids <ids>      Comma-separated Allegro offer ids.
  --all                  Import all offers visible to the active Allegro account.
`);
}

function normalizeOfferId(value: string): string {
  return value.trim().replace(/^ALLEGRO-OFFER-/i, '');
}

function parseArgs(argv: string[]): Args {
  const args: Args = { offerIds: [], help: false };

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
    } else if (arg === '--offer-id') {
      args.offerIds.push(normalizeOfferId(next()));
    } else if (arg === '--offer-ids') {
      args.offerIds.push(...next().split(',').map(normalizeOfferId).filter(Boolean));
    } else if (arg === '--all') {
      // Explicit readability flag. Import-all is also the fallback when no offer ids are supplied.
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.offerIds = Array.from(new Set(args.offerIds.filter(Boolean)));
  return args;
}

async function resolveAccount(prisma: PrismaService, args: Args): Promise<{ userId: string; accountId?: string; accountName?: string }> {
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
    return { userId: account.userId, accountId: account.id, accountName: account.name };
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

    return { userId: accounts[0].userId, accountId: accounts[0].id, accountName: accounts[0].name };
  }

  if (!args.userId) {
    throw new Error('Provide --account-name, --account-id, or --user-id.');
  }

  return { userId: args.userId };
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

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const prisma = app.get(PrismaService);
    const offersService = app.get(OffersService);
    const resolved = await resolveAccount(prisma, args);

    await activateAccount(prisma, resolved.userId, resolved.accountId);

    const result = args.offerIds.length > 0
      ? await offersService.importApprovedOffers(resolved.userId, args.offerIds)
      : await offersService.importAllOffers(resolved.userId);

    console.log(JSON.stringify({
      status: 'ok',
      userId: resolved.userId,
      accountId: resolved.accountId || null,
      accountName: resolved.accountName || null,
      offerIds: args.offerIds,
      result,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'error',
    message: error?.message || String(error),
  }, null, 2));
  process.exit(1);
});
