import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { ClientsModule, LoggerModule, PrismaModule } from '@allegro/shared';
import { AvailabilityReconciliationService } from '../allegro/availability-reconciliation/availability-reconciliation.service';
import { buildScriptSafety, redactedError, requireExactConfirmation } from './lib/script-safety';

type Args = {
  catalogProductIds: string[];
  limit?: number;
  apply: boolean;
  confirmApply?: string;
  help: boolean;
};

const APPLY_CONFIRMATION = 'ALLEGRO_AVAILABILITY_RECONCILE_LOCAL_FAIL_CLOSE';
const MISSING_DEACTIVATE_POLICY = '[MISSING: Allegro live offer deactivate endpoint/policy confirmation]';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    LoggerModule,
    ClientsModule,
  ],
  providers: [AvailabilityReconciliationService],
})
class ReconciliationScriptModule {}

function printHelp(): void {
  console.log(`Reconcile local Allegro offer availability against Catalog and Warehouse authority.

Usage:
  npm run reconcile:availability -- --dry-run
  npm run reconcile:availability -- --catalog-product-id <uuid> --dry-run
  npm run reconcile:availability -- --catalog-product-ids <uuid>,<uuid> --apply --confirm-local-fail-close ${APPLY_CONFIRMATION}

Default mode is dry-run. Apply mode mutates only local Allegro projection/audit/blocked END attempt rows.
It does not mutate Catalog, Warehouse, Orders, Payments, BizBox, or live Allegro APIs.

Options:
  --catalog-product-id <uuid>       Catalog product id. Can be repeated.
  --catalog-product-ids <ids>       Comma-separated Catalog product ids.
  --limit <number>                  Max local sellable offers to scan. Default ALLEGRO_AVAILABILITY_RECONCILIATION_LIMIT or 500.
  --dry-run                         Read Catalog/Warehouse and print planned local fail-close actions. Default.
  --apply                           Fail-close stale local Allegro projections and record local audit/blocked END evidence.
  --confirm-local-fail-close <${APPLY_CONFIRMATION}>
                                     Required with --apply.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { catalogProductIds: [], apply: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--catalog-product-id') args.catalogProductIds.push(next());
    else if (arg === '--catalog-product-ids') args.catalogProductIds.push(...next().split(',').map((value) => value.trim()).filter(Boolean));
    else if (arg === '--limit') args.limit = Math.max(1, Math.min(Number(next()) || 500, 5000));
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--confirm-local-fail-close') args.confirmApply = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  args.catalogProductIds = Array.from(new Set(args.catalogProductIds));
  return args;
}

function buildSafety(args: Args): Record<string, unknown> {
  return buildScriptSafety({
    taskId: 'W5b',
    mode: args.apply ? 'apply' : 'dry-run',
    mutates: args.apply,
    mutatesLocalAllegroProjection: args.apply,
    mutatesLocalSyncEvidence: args.apply,
    mutatesCatalog: false,
    mutatesWarehouse: false,
    mutatesOrders: false,
    mutatesAllegro: false,
    mutatesBizBox: false,
    forwardsOrders: false,
    writesAllowed: args.apply ? ['allegro_offers', 'allegro_projection_audit_logs', 'allegro_publish_attempts'] : [],
    writesForbidden: ['catalog-microservice', 'warehouse-microservice', 'orders-microservice', 'payments-microservice', 'bizbox-import', 'allegro-live-api'],
    confirmation: args.apply
      ? { flag: '--confirm-local-fail-close', expected: APPLY_CONFIRMATION, satisfied: true }
      : undefined,
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.apply) requireExactConfirmation(args.confirmApply, APPLY_CONFIRMATION, '--confirm-local-fail-close');

  const app = await NestFactory.createApplicationContext(ReconciliationScriptModule, { logger: ['error', 'warn', 'log'] });
  try {
    const reconciliation = app.get(AvailabilityReconciliationService);
    const result = await reconciliation.reconcile({
      mode: args.apply ? 'apply' : 'dry-run',
      catalogProductIds: args.catalogProductIds,
      limit: args.limit,
    });

    console.log(JSON.stringify({
      status: 'ok',
      safety: buildSafety(args),
      result,
      blockers: [MISSING_DEACTIVATE_POLICY],
      note: args.apply
        ? 'Local Allegro projection/audit evidence only; no Catalog, Warehouse, Orders, Payments, BizBox, or live Allegro write was executed.'
        : 'Dry-run only; no local Allegro projection, Catalog, Warehouse, Orders, Payments, BizBox, or live Allegro write was executed.',
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify(redactedError(error), null, 2));
  process.exit(1);
});
