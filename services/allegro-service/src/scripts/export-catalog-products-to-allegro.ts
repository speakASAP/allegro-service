import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogSellActionService } from '../allegro/catalog-sell-action/catalog-sell-action.service';
import { PublishLifecycleService } from '../allegro/publish-lifecycle/publish-lifecycle.service';
import { CatalogClientService, PrismaService } from '@allegro/shared';
import { buildScriptSafety, redactedError, requireExactConfirmation } from './lib/script-safety';

type Args = {
  userId?: string;
  accountId?: string;
  accountName?: string;
  catalogProductIds: string[];
  allCatalogProducts: boolean;
  search?: string;
  limit: number;
  prepare: boolean;
  execute: boolean;
  forceNewDraft: boolean;
  confirmPrepare?: string;
  confirmExport?: string;
  help: boolean;
};

const PREPARE_CONFIRMATION = 'ALLEGRO_CATALOG_EXPORT_PREPARE';
const EXECUTE_CONFIRMATION = 'ALLEGRO_CATALOG_EXPORT_EXECUTE';

function printHelp(): void {
  console.log(`Export Catalog products to Allegro through the governed publish lifecycle.

Usage:
  npm run export:catalog-products:allegro -- --account-name FlipFlop --catalog-product-id <uuid> --dry-run
  npm run export:catalog-products:allegro -- --account-id <uuid> --catalog-product-ids <uuid>,<uuid> --prepare --confirm-prepare ${PREPARE_CONFIRMATION}
  npm run export:catalog-products:allegro -- --account-name statexcz --catalog-product-id <uuid> --execute --confirm-export ${EXECUTE_CONFIRMATION}
  npm run export:catalog-products:allegro -- --account-id <uuid> --all-catalog-products --limit 100 --dry-run

Options:
  --account-name <name>       Allegro account name. Use --account-id when names are ambiguous.
  --account-id <uuid>         Exact Allegro account id to publish through.
  --user-id <uuid>            Restrict account lookup to a specific user.
  --catalog-product-id <uuid> Catalog product id. Can be repeated.
  --catalog-product-ids <ids> Comma-separated Catalog product ids.
  --all-catalog-products      Read active Catalog products from Catalog service.
  --search <text>             Filter Catalog product search when using --all-catalog-products.
  --limit <number>            Maximum Catalog products to load for --all-catalog-products. Default 100.
  --force-new-draft           Do not reuse an existing inactive local draft.
  --dry-run                   Resolve account/products and print plan only. Default.
  --prepare                   Create local Allegro drafts and governed publish attempts only.
  --confirm-prepare <${PREPARE_CONFIRMATION}>
                             Required with --prepare.
  --execute                   Prepare, confirm, and execute publish attempts against Allegro.
  --confirm-export <${EXECUTE_CONFIRMATION}>
                             Required with --execute.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    catalogProductIds: [],
    allCatalogProducts: false,
    limit: 100,
    prepare: false,
    execute: false,
    forceNewDraft: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--user-id') args.userId = next();
    else if (arg === '--account-id') args.accountId = next();
    else if (arg === '--account-name') args.accountName = next();
    else if (arg === '--catalog-product-id') args.catalogProductIds.push(next());
    else if (arg === '--catalog-product-ids') args.catalogProductIds.push(...next().split(',').map((value) => value.trim()).filter(Boolean));
    else if (arg === '--all-catalog-products') args.allCatalogProducts = true;
    else if (arg === '--search') args.search = next();
    else if (arg === '--limit') args.limit = Math.max(1, Math.min(Number(next()) || 100, 1000));
    else if (arg === '--force-new-draft') args.forceNewDraft = true;
    else if (arg === '--dry-run') {
      args.prepare = false;
      args.execute = false;
    } else if (arg === '--prepare') args.prepare = true;
    else if (arg === '--execute') args.execute = true;
    else if (arg === '--confirm-prepare') args.confirmPrepare = next();
    else if (arg === '--confirm-export') args.confirmExport = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.catalogProductIds = Array.from(new Set(args.catalogProductIds));
  if (args.execute) args.prepare = false;
  return args;
}

function buildExportSafety(args: Args): Record<string, unknown> {
  return buildScriptSafety({
    taskId: 'TASK-010',
    mode: args.execute || args.prepare ? 'apply' : 'dry-run',
    mutates: args.execute || args.prepare,
    mutatesLocalAllegroProjection: args.execute || args.prepare,
    mutatesCatalog: false,
    mutatesWarehouse: false,
    mutatesOrders: false,
    mutatesAllegro: args.execute,
    forwardsOrders: false,
    writesAllowed: args.execute
      ? ['allegro_offers', 'allegro_publish_attempts', 'allegro-write-api']
      : args.prepare
        ? ['allegro_offers', 'allegro_publish_attempts']
        : [],
    writesForbidden: ['catalog-microservice', 'warehouse-microservice', 'orders-microservice', 'bizbox-import'],
    confirmation: args.execute
      ? { flag: '--confirm-export', expected: EXECUTE_CONFIRMATION, satisfied: true }
      : args.prepare
        ? { flag: '--confirm-prepare', expected: PREPARE_CONFIRMATION, satisfied: true }
        : undefined,
  });
}

async function resolveAccount(prisma: PrismaService, args: Args): Promise<{ userId: string; accountId: string; accountName: string; isActive: boolean }> {
  const select = { id: true, userId: true, name: true, isActive: true } as const;
  if (args.accountId) {
    const account = await prisma.allegroAccount.findUnique({ where: { id: args.accountId }, select });
    if (!account) throw new Error(`Allegro account not found: ${args.accountId}`);
    if (args.userId && args.userId !== account.userId) throw new Error(`Account ${args.accountId} belongs to another user.`);
    return { userId: account.userId, accountId: account.id, accountName: account.name, isActive: account.isActive };
  }

  if (!args.accountName) throw new Error('Provide --account-id or --account-name.');

  const accounts = await prisma.allegroAccount.findMany({
    where: {
      name: { equals: args.accountName, mode: 'insensitive' },
      ...(args.userId ? { userId: args.userId } : {}),
    },
    select,
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) throw new Error(`Allegro account not found by name: ${args.accountName}`);
  if (accounts.length > 1) {
    const choices = accounts.map((account) => `${account.name}:${account.id}:${account.userId}`).join(', ');
    throw new Error(`Account name is ambiguous. Use --account-id. Matches: ${choices}`);
  }

  return { userId: accounts[0].userId, accountId: accounts[0].id, accountName: accounts[0].name, isActive: accounts[0].isActive };
}

async function resolveCatalogProductIds(catalogClient: CatalogClientService, args: Args): Promise<string[]> {
  if (args.catalogProductIds.length) return args.catalogProductIds;
  if (!args.allCatalogProducts) throw new Error('Provide --catalog-product-id, --catalog-product-ids, or --all-catalog-products.');

  const ids: string[] = [];
  let page = 1;
  const pageLimit = Math.min(args.limit, 100);
  while (ids.length < args.limit) {
    const response = await catalogClient.searchProducts({
      search: args.search,
      isActive: true,
      page,
      limit: pageLimit,
    });
    for (const product of response.items || []) {
      if (product?.id) ids.push(String(product.id));
      if (ids.length >= args.limit) break;
    }
    if (!response.items?.length || ids.length >= response.total || response.items.length < pageLimit) break;
    page += 1;
  }
  return Array.from(new Set(ids));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.prepare) requireExactConfirmation(args.confirmPrepare, PREPARE_CONFIRMATION, '--confirm-prepare');
  if (args.execute) requireExactConfirmation(args.confirmExport, EXECUTE_CONFIRMATION, '--confirm-export');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const prisma = app.get(PrismaService);
    const catalogClient = app.get(CatalogClientService);
    const catalogSellAction = app.get(CatalogSellActionService);
    const publishLifecycle = app.get(PublishLifecycleService);
    const account = await resolveAccount(prisma, args);
    const catalogProductIds = await resolveCatalogProductIds(catalogClient, args);
    const safety = buildExportSafety(args);

    if (!args.prepare && !args.execute) {
      console.log(JSON.stringify({
        status: 'ok',
        mode: 'dry-run',
        safety,
        account,
        catalogProductIds,
        total: catalogProductIds.length,
        note: 'No local Allegro projection, Catalog, Warehouse, orders, BizBox, or Allegro write was executed.',
      }, null, 2));
      return;
    }

    const results: any[] = [];
    for (const catalogProductId of catalogProductIds) {
      const idempotencyKey = `catalog-export:${account.accountId}:${catalogProductId}`;
      const prepared = await catalogSellAction.prepare({
        catalogProductId,
        accountId: account.accountId,
        idempotencyKey,
        forceNewDraft: args.forceNewDraft,
      }, account.userId);

      const row: any = {
        catalogProductId,
        accountId: account.accountId,
        accountName: account.accountName,
        draft: prepared.draft,
        attempt: {
          id: prepared.attempt?.id,
          status: prepared.attempt?.status,
          previewToken: args.execute ? '[REDACTED]' : prepared.attempt?.previewToken,
        },
        nextAction: prepared.nextAction,
      };

      if (args.execute && prepared.attempt?.status !== 'BLOCKED') {
        const queued = await publishLifecycle.confirm(prepared.attempt.id, account.userId, prepared.attempt.previewToken);
        const executed = await publishLifecycle.execute(queued.id, account.userId, `catalog-export-${account.accountId}-${catalogProductId}-${Date.now()}`);
        row.execution = {
          id: executed.id,
          status: executed.status,
          derivedStatus: executed.derivedStatus,
          commandResult: executed.commandResult || null,
          failureContext: executed.failureContext || null,
        };
      }

      results.push(row);
    }

    console.log(JSON.stringify({
      status: 'ok',
      mode: args.execute ? 'execute' : 'prepare',
      safety,
      account,
      total: results.length,
      results,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify(redactedError(error), null, 2));
  process.exit(1);
});
