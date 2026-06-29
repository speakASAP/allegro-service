import * as crypto from 'crypto';
import * as path from 'path';
import { buildScriptSafety, redactedError } from './lib/script-safety';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require(path.resolve(process.cwd(), '../../shared/node_modules/.prisma/client'));

type Args = {
  accountId?: string;
  accountName?: string;
  allAccounts: boolean;
  detailLimit: number;
  listLimit: number;
  help: boolean;
};

type AccountReport = {
  accountId: string;
  accountName: string;
  userId: string;
  isActive: boolean;
  tokenState: string;
  listedOffers: number;
  listedByStatus: Record<string, number>;
  duplicateListedOffers: number;
  detailChecked: number;
  detailOk: number;
  detail404: number;
  detailErrors: number;
  stockAuthoritativeOffers: number;
  stockAuthoritativeTotal: number;
  listedStockTotal: number;
  localMappedOffers: number;
  localMappedStockTotal: number;
  stockAuthoritativeOfferIds: string[];
  samples: any[];
  errors: any[];
};

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  const user = encodeURIComponent(process.env.DB_USER || '');
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST || '';
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_NAME || '';
  if (user && host && db) {
    process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }
}

ensureDatabaseUrl();

const prisma = new PrismaClient();
const ALLEGRO_API_URL = (process.env.ALLEGRO_API_URL || 'https://api.allegro.pl').replace(/\/$/, '');
const PUBLICATION_STATUSES = ['ACTIVE', 'INACTIVE', 'ENDED', 'ACTIVATING'];

function printHelp(): void {
  console.log(`Read-only audit of current Allegro stock-authoritative offer coverage.

Usage:
  npm run audit:current-stock-source -- --all-accounts
  npm run audit:current-stock-source -- --account-name FlipFlop
  npm run audit:current-stock-source -- --account-id <uuid> --detail-limit 500

This script does not import offers, write Warehouse stock, activate accounts, refresh tokens, or mutate local rows.
It reads Allegro /sale/offers and /sale/product-offers/{offerId}; only product-offers stock.available is treated as current physical stock evidence.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { allAccounts: false, detailLimit: 500, listLimit: 100, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--account-id') args.accountId = next();
    else if (arg === '--account-name') args.accountName = next();
    else if (arg === '--all-accounts') args.allAccounts = true;
    else if (arg === '--detail-limit') args.detailLimit = Math.max(0, Number(next()));
    else if (arg === '--list-limit') args.listLimit = Math.max(1, Math.min(1000, Number(next())));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.help && !args.allAccounts && !args.accountId && !args.accountName) {
    throw new Error('Provide --all-accounts, --account-id, or --account-name.');
  }
  return args;
}

function decrypt(value: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY must be configured and at least 32 characters.');
  const parts = String(value || '').split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted token format.');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32), 'utf8'), Buffer.from(parts[0], 'hex'));
  return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
}

function tokenState(account: any): string {
  if (!account.accessToken) return 'missing_access_token';
  if (!account.tokenExpiresAt) return 'present_without_expiry';
  return new Date(account.tokenExpiresAt).getTime() <= Date.now() ? 'expired_not_refreshed' : 'present';
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.allegro.public.v1+json',
    'Accept-Language': 'cs-CZ',
  };
}

async function requestJson(url: string, token: string, allow404 = false): Promise<{ status: number; data: any }> {
  const response = await fetch(url, { headers: headers(token) });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }
  if (!response.ok && !(allow404 && response.status === 404)) {
    const message = data?.errors?.[0]?.userMessage || data?.errors?.[0]?.message || data?.message || response.statusText;
    throw Object.assign(new Error(`${response.status} ${message}`), { status: response.status, data });
  }
  return { status: response.status, data };
}

async function resolveAccounts(args: Args): Promise<any[]> {
  const select = {
    id: true,
    userId: true,
    name: true,
    isActive: true,
    accessToken: true,
    tokenExpiresAt: true,
    updatedAt: true,
  };
  if (args.allAccounts) {
    return prisma.allegroAccount.findMany({ select, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
  }
  if (args.accountId) {
    const account = await prisma.allegroAccount.findUnique({ where: { id: args.accountId }, select });
    return account ? [account] : [];
  }
  return prisma.allegroAccount.findMany({
    where: { name: { equals: args.accountName, mode: 'insensitive' } },
    select,
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });
}

function nonNegative(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.floor(number);
}

async function auditAccount(account: any, args: Args): Promise<AccountReport> {
  const report: AccountReport = {
    accountId: account.id,
    accountName: account.name,
    userId: account.userId,
    isActive: Boolean(account.isActive),
    tokenState: tokenState(account),
    listedOffers: 0,
    listedByStatus: {},
    duplicateListedOffers: 0,
    detailChecked: 0,
    detailOk: 0,
    detail404: 0,
    detailErrors: 0,
    stockAuthoritativeOffers: 0,
    stockAuthoritativeTotal: 0,
    listedStockTotal: 0,
    localMappedOffers: 0,
    localMappedStockTotal: 0,
    stockAuthoritativeOfferIds: [],
    samples: [],
    errors: [],
  };

  const localOffers = await prisma.allegroOffer.findMany({
    where: { accountId: account.id },
    select: { allegroOfferId: true, catalogProductId: true, stockQuantity: true, status: true, publicationStatus: true },
  });
  report.localMappedOffers = localOffers.length;
  report.localMappedStockTotal = localOffers.reduce((sum: number, offer: any) => sum + Number(offer.stockQuantity || 0), 0);

  if (report.tokenState !== 'present' && report.tokenState !== 'present_without_expiry') {
    report.errors.push({ source: 'local-token', message: report.tokenState });
    return report;
  }

  let token: string;
  try {
    token = decrypt(account.accessToken);
  } catch (error: any) {
    report.tokenState = 'decrypt_failed';
    report.errors.push({ source: 'local-token', message: error?.message || String(error) });
    return report;
  }

  const seen = new Map<string, any>();
  for (const status of PUBLICATION_STATUSES) {
    let offset = 0;
    let statusCount = 0;
    while (true) {
      const url = `${ALLEGRO_API_URL}/sale/offers?${new URLSearchParams({
        limit: String(args.listLimit),
        offset: String(offset),
        'publication.status': status,
      }).toString()}`;
      let data: any;
      try {
        data = (await requestJson(url, token)).data;
      } catch (error: any) {
        report.errors.push({ source: 'sale.offers', status, offset, httpStatus: error.status || null, message: error.message });
        break;
      }
      const offers = Array.isArray(data?.offers) ? data.offers : [];
      statusCount += offers.length;
      for (const offer of offers) {
        const offerId = String(offer?.id || '').trim();
        if (!offerId) continue;
        if (seen.has(offerId)) {
          report.duplicateListedOffers += 1;
          continue;
        }
        seen.set(offerId, offer);
        const listedStock = nonNegative(offer?.stock?.available);
        if (listedStock !== null) report.listedStockTotal += listedStock;
      }
      if (offers.length < args.listLimit) break;
      offset += args.listLimit;
    }
    report.listedByStatus[status] = statusCount;
  }

  report.listedOffers = seen.size;
  const detailOfferIds = Array.from(seen.keys()).slice(0, args.detailLimit);
  for (const offerId of detailOfferIds) {
    report.detailChecked += 1;
    try {
      const { status, data } = await requestJson(`${ALLEGRO_API_URL}/sale/product-offers/${encodeURIComponent(offerId)}`, token, true);
      if (status === 404) {
        report.detail404 += 1;
        continue;
      }
      report.detailOk += 1;
      const stock = nonNegative(data?.stock?.available);
      if (stock !== null) {
        report.stockAuthoritativeOffers += 1;
        report.stockAuthoritativeTotal += stock;
        report.stockAuthoritativeOfferIds.push(offerId);
      }
      if (report.samples.length < 12) {
        const listed = seen.get(offerId);
        report.samples.push({
          offerId,
          title: data?.name || listed?.name || null,
          publicationStatus: data?.publication?.status || listed?.publication?.status || null,
          listedStock: nonNegative(listed?.stock?.available),
          currentStock: stock,
          detailStatus: status,
          hasCatalogProduct: Boolean(localOffers.find((offer: any) => offer.allegroOfferId === offerId)?.catalogProductId),
        });
      }
    } catch (error: any) {
      report.detailErrors += 1;
      report.errors.push({ source: 'sale.product-offers', offerId, httpStatus: error.status || null, message: error.message });
    }
  }

  return report;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const accounts = await resolveAccounts(args);
  if (!accounts.length) throw new Error('No matching Allegro accounts found.');

  const reports: AccountReport[] = [];
  for (const account of accounts) {
    reports.push(await auditAccount(account, args));
  }

  const uniqueStockByOfferId = new Map<string, number>();
  for (const report of reports) {
    for (const sample of report.samples) {
      if (report.stockAuthoritativeOfferIds.includes(sample.offerId) && sample.currentStock !== null && sample.currentStock !== undefined) {
        uniqueStockByOfferId.set(sample.offerId, Number(sample.currentStock));
      }
    }
  }

  const totals = reports.reduce((acc, item) => {
    acc.listedOffers += item.listedOffers;
    acc.detailChecked += item.detailChecked;
    acc.detailOk += item.detailOk;
    acc.detail404 += item.detail404;
    acc.detailErrors += item.detailErrors;
    acc.stockAuthoritativeOffers += item.stockAuthoritativeOffers;
    acc.stockAuthoritativeTotal += item.stockAuthoritativeTotal;
    acc.localMappedOffers += item.localMappedOffers;
    acc.localMappedStockTotal += item.localMappedStockTotal;
    return acc;
  }, {
    listedOffers: 0,
    detailChecked: 0,
    detailOk: 0,
    detail404: 0,
    detailErrors: 0,
    stockAuthoritativeOffers: 0,
    stockAuthoritativeTotal: 0,
    localMappedOffers: 0,
    localMappedStockTotal: 0,
  });

  const uniqueStockAuthoritativeOffers = uniqueStockByOfferId.size;
  const uniqueStockAuthoritativeTotal = Array.from(uniqueStockByOfferId.values()).reduce((sum, value) => sum + value, 0);
  const duplicateStockAuthoritativeAppearances = Math.max(0, totals.stockAuthoritativeOffers - uniqueStockAuthoritativeOffers);

  console.log(JSON.stringify({
    status: 'ok',
    generatedAt: new Date().toISOString(),
    source: 'allegro-current-stock-audit.v1',
    mode: 'audit',
    taskId: 'TASK-010',
    mutates: false,
    safety: buildScriptSafety({
      mode: 'audit',
      mutates: false,
      mutatesLocalAllegroProjection: false,
      mutatesCatalog: false,
      mutatesWarehouse: false,
      mutatesOrders: false,
      mutatesAllegro: false,
      mutatesBizBox: false,
      forwardsOrders: false,
      writesAllowed: [],
      writesForbidden: ['orders-microservice', 'catalog-microservice', 'warehouse-microservice', 'allegro-write-api', 'bizbox-import', 'local-database'],
    }),
    apiBaseUrl: ALLEGRO_API_URL,
    publicationStatuses: PUBLICATION_STATUSES,
    detailLimit: args.detailLimit,
    accountCount: reports.length,
    totals: {
      ...totals,
      uniqueStockAuthoritativeOffers,
      uniqueStockAuthoritativeTotal,
      duplicateStockAuthoritativeAppearances,
    },
    uniqueStockAuthoritativeOfferIds: Array.from(uniqueStockByOfferId.keys()).sort(),
    accounts: reports,
    interpretation: {
      stockAuthoritative: 'Only successful /sale/product-offers/{offerId}.stock.available rows are treated as current physical stock evidence.',
      listedStock: '/sale/offers stock is listed for comparison only; final import should use product-offers current stock or owner-approved external stock source.',
      tokenRefresh: 'This audit does not refresh OAuth tokens or activate accounts.',
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
