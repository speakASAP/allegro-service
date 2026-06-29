import * as path from 'path';
import { buildRawPayloadPolicySnapshot, policyForPiiClass, retentionCutoffForPiiClass, retentionExpiresAt } from './lib/raw-payload-policy';
import { buildScriptSafety, redactedError } from './lib/script-safety';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require(path.resolve(process.cwd(), '../../shared/node_modules/.prisma/client'));

type Args = {
  limit: number;
  help: boolean;
};

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  const user = encodeURIComponent(process.env.DB_USER || "");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const host = process.env.DB_HOST || "";
  const port = process.env.DB_PORT || "5432";
  const db = process.env.DB_NAME || "";
  if (user && host && db) {
    process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }
}

ensureDatabaseUrl();
const prisma = new PrismaClient();

function printHelp(): void {
  console.log(`Read-only audit of Allegro raw payload retention exposure.

Usage:
  node dist/scripts/audit-raw-payload-retention.js
  node dist/scripts/audit-raw-payload-retention.js --limit 25

This script reads allegro_raw_payloads only. It does not delete rows, redact rows,
apply migrations, call Allegro APIs, mutate Warehouse/BizBox, or deploy cleanup jobs.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 20, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--limit') args.limit = Math.max(0, Math.min(100, Number(next())));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const now = new Date();
  const rows = await prisma.allegroRawPayload.groupBy({
    by: ['piiClass'],
    _count: { _all: true },
    _min: { receivedAt: true },
    _max: { receivedAt: true },
  });

  const classes = rows.map((row: any) => row.piiClass).filter(Boolean);
  const expiredCounts = new Map<string, number>();
  for (const piiClass of classes) {
    const cutoff = retentionCutoffForPiiClass(piiClass, now);
    const count = await prisma.allegroRawPayload.count({
      where: { piiClass, receivedAt: { lt: cutoff } },
    });
    expiredCounts.set(piiClass, count);
  }

  const sampleRows = args.limit > 0
    ? await prisma.allegroRawPayload.findMany({
      orderBy: { receivedAt: 'asc' },
      take: args.limit,
      select: {
        id: true,
        accountId: true,
        domain: true,
        endpoint: true,
        externalId: true,
        payloadHash: true,
        piiClass: true,
        redactionVersion: true,
        receivedAt: true,
      },
    })
    : [];

  console.log(JSON.stringify({
    status: 'ok',
    generatedAt: now.toISOString(),
    source: 'allegro-raw-payload-retention-audit.v1',
    mode: 'audit',
    taskId: 'TASK-010',
    mutates: false,
    safety: buildScriptSafety({
      mode: 'audit',
      mutates: false,
      mutatesLocalAllegroProjection: false,
      mutatesLocalSyncEvidence: false,
      mutatesCatalog: false,
      mutatesWarehouse: false,
      mutatesOrders: false,
      mutatesAllegro: false,
      mutatesBizBox: false,
      forwardsOrders: false,
      writesAllowed: [],
      writesForbidden: ['local-database-write', 'row-delete', 'row-redaction', 'allegro-write-api', 'warehouse-microservice', 'bizbox-import', 'deploy'],
    }),
    policy: buildRawPayloadPolicySnapshot(),
    totals: {
      classes: rows.length,
      payloads: rows.reduce((sum: number, row: any) => sum + Number(row._count?._all || 0), 0),
      expiredPayloads: Array.from(expiredCounts.values()).reduce((sum, value) => sum + value, 0),
    },
    byPiiClass: rows.map((row: any) => {
      const policy = policyForPiiClass(row.piiClass);
      return {
        piiClass: row.piiClass,
        count: row._count?._all || 0,
        retentionDays: policy.retentionDays,
        deletionMode: policy.deletionMode,
        oldestReceivedAt: row._min?.receivedAt || null,
        newestReceivedAt: row._max?.receivedAt || null,
        expiredCount: expiredCounts.get(row.piiClass) || 0,
        cutoffBefore: retentionCutoffForPiiClass(row.piiClass, now).toISOString(),
      };
    }),
    oldestSamples: sampleRows.map((row: any) => ({
      id: row.id,
      accountId: row.accountId,
      domain: row.domain,
      endpoint: row.endpoint,
      externalId: row.externalId,
      payloadHash: row.payloadHash,
      piiClass: row.piiClass,
      redactionVersion: row.redactionVersion,
      receivedAt: row.receivedAt,
      retentionExpiresAt: retentionExpiresAt(row.piiClass, row.receivedAt).toISOString(),
    })),
    interpretation: {
      reportOnly: true,
      cleanupStatus: 'not_implemented',
      cleanupRequirement: 'Any delete/redaction job must be owner-approved and separate from TASK-010 validation.',
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify(redactedError(error), null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
