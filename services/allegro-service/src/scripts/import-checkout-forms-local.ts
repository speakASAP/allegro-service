import * as crypto from 'crypto';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require(path.resolve(process.cwd(), '../../shared/node_modules/.prisma/client'));

type Args = {
  accountId?: string;
  accountName?: string;
  userId?: string;
  apply: boolean;
  confirmLocalOnly: boolean;
  maxOrders: number;
  pageSize: number;
  language: string;
  help: boolean;
};

type Money = {
  amount: number;
  currency: string;
};

type SourceAttempt = {
  source: string;
  status: number | null;
  ok: boolean;
  message?: string;
};

const prisma = new PrismaClient();
const ALLEGRO_API_URL = process.env.ALLEGRO_API_URL || 'https://api.allegro.pl';

function printHelp(): void {
  console.log(`Import Allegro checkout forms into local order projection only.

Usage:
  node dist/scripts/import-checkout-forms-local.js --account-name statexcz --dry-run
  node dist/scripts/import-checkout-forms-local.js --account-name statexcz --apply --confirm-local-only

Options:
  --account-name <name>     Allegro account name. Use --account-id when ambiguous.
  --account-id <uuid>       Allegro account id.
  --user-id <uuid>          Restrict account-name lookup to this user.
  --dry-run                 Fetch and report only. Default.
  --apply                   Persist only allegro_orders and allegro_order_line_items.
  --confirm-local-only      Required with --apply. Confirms no forwarding/Catalog/Warehouse/Allegro writes.
  --max-orders <n>          Maximum checkout forms to fetch. Default: 500.
  --page-size <n>           Allegro checkout form page size, 1..100. Default: 100.
  --language <tag>          Accept-Language header. Default: cs-CZ.
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    confirmLocalOnly: false,
    maxOrders: 500,
    pageSize: 100,
    language: 'cs-CZ',
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
    else if (arg === '--account-id') args.accountId = next();
    else if (arg === '--account-name') args.accountName = next();
    else if (arg === '--user-id') args.userId = next();
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--confirm-local-only') args.confirmLocalOnly = true;
    else if (arg === '--max-orders') args.maxOrders = Number(next());
    else if (arg === '--page-size') args.pageSize = Number(next());
    else if (arg === '--language') args.language = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.maxOrders = normalizePositiveInteger(args.maxOrders, 500, 1, 5000);
  args.pageSize = normalizePositiveInteger(args.pageSize, 100, 1, 100);
  return args;
}

function normalizePositiveInteger(value: number, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function decrypt(value: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY must be configured and at least 32 characters.');
  const parts = String(value || '').split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted token format.');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32), 'utf8'), Buffer.from(parts[0], 'hex'));
  return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
}

function allegroHeaders(token: string, language: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.allegro.public.v1+json',
    'Accept-Language': language,
  };
}

async function requestJson(url: string, token: string, language: string): Promise<{ status: number; data: any }> {
  const response = await fetch(url, { headers: allegroHeaders(token, language) });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 1000) };
  }
  if (!response.ok) {
    const message = data?.errors?.[0]?.userMessage || data?.errors?.[0]?.message || data?.message || response.statusText;
    throw Object.assign(new Error(`${response.status} ${message}`), { status: response.status, data });
  }
  return { status: response.status, data };
}

async function resolveAccount(args: Args): Promise<any> {
  const select = { id: true, userId: true, name: true, accessToken: true, tokenExpiresAt: true, isActive: true } as const;
  if (args.accountId) {
    const account = await prisma.allegroAccount.findUnique({ where: { id: args.accountId }, select });
    if (!account) throw new Error(`Account not found: ${args.accountId}`);
    return account;
  }
  if (!args.accountName) throw new Error('Provide --account-id or --account-name.');

  const accounts = await prisma.allegroAccount.findMany({
    where: { name: { equals: args.accountName, mode: 'insensitive' }, ...(args.userId ? { userId: args.userId } : {}) },
    select,
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });
  if (accounts.length === 0) throw new Error(`Account not found by name: ${args.accountName}`);
  if (accounts.length > 1 && !accounts[0].isActive) {
    throw new Error(`Account name is ambiguous. Use --account-id. Matches: ${accounts.map((account: any) => `${account.name}:${account.id}:active=${account.isActive}`).join(', ')}`);
  }
  return accounts[0];
}

function parseMoney(value: any, fallback = 0): number {
  const amount = typeof value === 'object' && value !== null ? value.amount : value;
  const parsed = Number.parseFloat(String(amount ?? fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLineItems(form: any): any[] {
  return Array.isArray(form?.lineItems) ? form.lineItems : [];
}

function getOrderTotal(form: any): Money {
  const summaryTotal = form?.totalPrice || form?.summary?.totalToPay;
  if (summaryTotal) {
    return {
      amount: parseMoney(summaryTotal),
      currency: summaryTotal.currency || 'PLN',
    };
  }

  const lineItems = getLineItems(form);
  const amount = lineItems.reduce((sum, line) => sum + parseMoney(line?.price) * Number(line?.quantity || 1), 0);
  const currency = lineItems.find((line) => line?.price?.currency)?.price?.currency || 'PLN';
  return { amount, currency };
}

function getPaymentStatus(form: any): string | null {
  if (form?.payment?.status) return form.payment.status;
  return form?.payment?.finishedAt ? 'PAID' : null;
}

function getOrderDate(form: any): Date {
  const firstLine = getLineItems(form)[0] || {};
  return parseDate(form?.createdAt || firstLine?.boughtAt || form?.updatedAt) || new Date();
}

function buildLineItemPayload(lineItem: any, offer: any | undefined, index: number): any {
  const quantity = Number(lineItem?.quantity || 1);
  const price = parseMoney(lineItem?.price);
  const originalPrice = lineItem?.originalPrice ? parseMoney(lineItem.originalPrice) : null;
  const currency = lineItem?.price?.currency || lineItem?.originalPrice?.currency || 'PLN';
  const externalOfferId = lineItem?.offer?.id ? String(lineItem.offer.id) : null;

  return {
    allegroLineItemId: String(lineItem?.id || `${index}:${externalOfferId || 'unknown'}:${lineItem?.boughtAt || ''}`),
    allegroOfferExternalId: externalOfferId,
    allegroOfferId: offer?.id || null,
    catalogProductId: offer?.catalogProductId || null,
    title: String(lineItem?.offer?.name || offer?.title || 'Product').slice(0, 500),
    quantity,
    price,
    originalPrice,
    totalPrice: price * quantity,
    currency,
    tax: lineItem?.tax || null,
    discounts: lineItem?.discounts || null,
    vouchers: lineItem?.vouchers || null,
    selectedAdditionalServices: lineItem?.selectedAdditionalServices || null,
    rawData: lineItem || null,
    boughtAt: parseDate(lineItem?.boughtAt),
  };
}

async function fetchCheckoutForms(token: string, args: Args): Promise<{ forms: any[]; attempts: SourceAttempt[] }> {
  const forms: any[] = [];
  const attempts: SourceAttempt[] = [];
  let offset = 0;

  while (forms.length < args.maxOrders) {
    const listUrl = `${ALLEGRO_API_URL}/order/checkout-forms?limit=${args.pageSize}&offset=${offset}`;
    const { status, data } = await requestJson(listUrl, token, args.language);
    const listedForms = Array.isArray(data.checkoutForms) ? data.checkoutForms : [];
    attempts.push({ source: 'order.checkout-forms.list', status, ok: true });

    for (const listedForm of listedForms) {
      if (forms.length >= args.maxOrders) break;
      const detailUrl = `${ALLEGRO_API_URL}/order/checkout-forms/${listedForm.id}`;
      try {
        const detail = await requestJson(detailUrl, token, args.language);
        attempts.push({ source: 'order.checkout-forms.detail', status: detail.status, ok: true });
        forms.push(detail.data);
      } catch (error: any) {
        attempts.push({
          source: 'order.checkout-forms.detail',
          status: error?.status || null,
          ok: false,
          message: error?.message || String(error),
        });
        forms.push(listedForm);
      }
    }

    if (listedForms.length < args.pageSize) break;
    offset += args.pageSize;
  }

  return { forms, attempts };
}

function countBy<T>(items: T[], picker: (item: T) => string | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = picker(item) || '[UNKNOWN]';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function buildPlan(forms: any[]): Promise<any> {
  const orderIds = forms.map((form) => String(form.id)).filter(Boolean);
  const lineItems = forms.flatMap((form) => getLineItems(form));
  const lineOfferIds = Array.from(new Set(lineItems.map((line) => String(line?.offer?.id || '').trim()).filter(Boolean)));

  const [existingOrders, mappedOffers] = await Promise.all([
    orderIds.length > 0
      ? prisma.allegroOrder.findMany({ where: { allegroOrderId: { in: orderIds } }, select: { allegroOrderId: true } })
      : Promise.resolve([]),
    lineOfferIds.length > 0
      ? prisma.allegroOffer.findMany({
        where: { allegroOfferId: { in: lineOfferIds } },
        select: { id: true, allegroOfferId: true, catalogProductId: true, accountId: true, title: true },
      })
      : Promise.resolve([]),
  ]);

  const existingOrderIds = new Set(existingOrders.map((order: any) => order.allegroOrderId));
  const mappedOfferIds = new Set(mappedOffers.map((offer: any) => offer.allegroOfferId));
  const missingOfferIds = lineOfferIds.filter((offerId) => !mappedOfferIds.has(offerId));
  const offersWithCatalog = mappedOffers.filter((offer: any) => offer.catalogProductId).length;

  return {
    orderIds,
    lineItems,
    lineOfferIds,
    mappedOffers,
    existingOrderIds,
    missingOfferIds,
    offersWithCatalog,
  };
}

function summarize(forms: any[], plan: any, attempts: SourceAttempt[], mode: 'dry-run' | 'apply', applyStats?: any): any {
  const lineItems = plan.lineItems;
  const totalQuantity = lineItems.reduce((sum: number, line: any) => sum + Number(line?.quantity || 0), 0);
  const detailAttempts = attempts.filter((attempt) => attempt.source === 'order.checkout-forms.detail');
  const failedDetails = detailAttempts.filter((attempt) => !attempt.ok);

  return {
    done: true,
    mode,
    source: 'allegro-checkout-forms-local-only',
    safety: {
      writesAllowed: mode === 'apply' ? ['allegro_orders', 'allegro_order_line_items'] : [],
      writesForbidden: ['orders-microservice', 'catalog-microservice', 'warehouse-microservice', 'allegro-write-api', 'bizbox-import'],
      forwardsOrders: false,
      mutatesWarehouse: false,
      mutatesAllegro: false,
    },
    fetched: {
      checkoutForms: forms.length,
      detailAttempts: detailAttempts.length,
      detailFailures: failedDetails.length,
      lineItems: lineItems.length,
      totalOrderedQuantity: totalQuantity,
      uniqueOfferIds: plan.lineOfferIds.length,
      multiLineOrders: forms.filter((form: any) => getLineItems(form).length > 1).length,
      invoiceRequired: forms.filter((form: any) => Boolean(form?.invoice?.required)).length,
    },
    mapping: {
      existingOrders: plan.existingOrderIds.size,
      ordersToCreate: forms.length - plan.existingOrderIds.size,
      ordersToUpdate: plan.existingOrderIds.size,
      localOfferMappings: plan.mappedOffers.length,
      missingOfferMappings: plan.missingOfferIds.length,
      offersWithCatalogProduct: plan.offersWithCatalog,
      blockedForForwarding: plan.missingOfferIds.length > 0,
    },
    distributions: {
      orderStatus: countBy(forms, (form: any) => form?.status),
      fulfillmentStatus: countBy(forms, (form: any) => form?.fulfillment?.status),
      marketplace: countBy(forms, (form: any) => form?.marketplace?.id),
    },
    attempts: {
      list: attempts.filter((attempt) => attempt.source === 'order.checkout-forms.list').length,
      detailOk: detailAttempts.length - failedDetails.length,
      detailFailed: failedDetails.length,
    },
    apply: applyStats || null,
  };
}

async function applyLocalProjection(forms: any[], mappedOffers: any[]): Promise<any> {
  const offersByAllegroOfferId = new Map<string, any>(
    mappedOffers.map((offer: any) => [offer.allegroOfferId, offer]),
  );
  let ordersCreated = 0;
  let ordersUpdated = 0;
  let lineItemsDeleted = 0;
  let lineItemsCreated = 0;

  for (const form of forms) {
    const lineItems = getLineItems(form);
    const lineOfferIds = lineItems.map((line) => String(line?.offer?.id || '').trim()).filter(Boolean);
    const primaryOffer = lineOfferIds[0] ? offersByAllegroOfferId.get(lineOfferIds[0]) : null;
    const firstLinePrice = lineItems[0]?.price || {};
    const orderTotal = getOrderTotal(form);
    const aggregateQuantity = lineItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);

    await prisma.$transaction(async (tx: any) => {
      const existing = await tx.allegroOrder.findUnique({
        where: { allegroOrderId: form.id },
        select: { id: true },
      });

      const savedOrder = await tx.allegroOrder.upsert({
        where: { allegroOrderId: form.id },
        update: {
          allegroOfferId: primaryOffer?.id || null,
          catalogProductId: primaryOffer?.catalogProductId || null,
          quantity: aggregateQuantity,
          price: parseMoney(firstLinePrice),
          totalPrice: orderTotal.amount,
          currency: orderTotal.currency || firstLinePrice.currency || 'PLN',
          lineItemsCount: lineItems.length,
          status: form.status || 'NEW',
          paymentStatus: getPaymentStatus(form),
          fulfillmentStatus: form.fulfillment?.status,
          buyerId: form.buyer?.id,
          buyerEmail: form.buyer?.email,
          buyerLogin: form.buyer?.login,
          deliveryMethod: form.delivery?.method?.name,
          deliveryAddress: form.delivery?.address || null,
          trackingNumber: null,
          paymentMethod: form.payment?.provider || form.payment?.type,
          paidAt: parseDate(form.payment?.finishedAt),
          marketplaceId: form.marketplace?.id,
          revision: form.revision,
          invoiceRequired: Boolean(form.invoice?.required),
          rawData: form,
          updatedAt: new Date(),
        },
        create: {
          allegroOrderId: form.id,
          allegroOfferId: primaryOffer?.id || null,
          catalogProductId: primaryOffer?.catalogProductId || null,
          quantity: aggregateQuantity,
          price: parseMoney(firstLinePrice),
          totalPrice: orderTotal.amount,
          currency: orderTotal.currency || firstLinePrice.currency || 'PLN',
          lineItemsCount: lineItems.length,
          status: form.status || 'NEW',
          paymentStatus: getPaymentStatus(form),
          fulfillmentStatus: form.fulfillment?.status,
          buyerId: form.buyer?.id,
          buyerEmail: form.buyer?.email,
          buyerLogin: form.buyer?.login,
          deliveryMethod: form.delivery?.method?.name,
          deliveryAddress: form.delivery?.address || null,
          trackingNumber: null,
          paymentMethod: form.payment?.provider || form.payment?.type,
          paidAt: parseDate(form.payment?.finishedAt),
          marketplaceId: form.marketplace?.id,
          revision: form.revision,
          invoiceRequired: Boolean(form.invoice?.required),
          rawData: form,
          orderDate: getOrderDate(form),
        },
      });

      if (existing) ordersUpdated += 1;
      else ordersCreated += 1;

      const deleteResult = await tx.allegroOrderLineItem.deleteMany({
        where: { orderId: savedOrder.id },
      });
      lineItemsDeleted += deleteResult.count || 0;

      if (lineItems.length > 0) {
        const createResult = await tx.allegroOrderLineItem.createMany({
          data: lineItems.map((lineItem: any, index: number) => {
            const lineOfferId = String(lineItem?.offer?.id || '').trim();
            return {
              orderId: savedOrder.id,
              ...buildLineItemPayload(lineItem, lineOfferId ? offersByAllegroOfferId.get(lineOfferId) : undefined, index),
            };
          }),
        });
        lineItemsCreated += createResult.count || 0;
      }
    });
  }

  return {
    ordersCreated,
    ordersUpdated,
    lineItemsDeleted,
    lineItemsCreated,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.apply && !args.confirmLocalOnly) {
    throw new Error('--apply requires --confirm-local-only to prevent accidental forwarding/Catalog/Warehouse/Allegro writes.');
  }

  const account = await resolveAccount(args);
  if (!account.accessToken) throw new Error(`Account ${account.id} has no OAuth access token.`);
  const token = decrypt(account.accessToken);
  const { forms, attempts } = await fetchCheckoutForms(token, args);
  const plan = await buildPlan(forms);

  let applyStats: any = null;
  if (args.apply) {
    applyStats = await applyLocalProjection(forms, plan.mappedOffers);
  }

  console.log(JSON.stringify(summarize(forms, plan, attempts, args.apply ? 'apply' : 'dry-run', applyStats), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ done: false, message: error?.message || String(error), stack: error?.stack }, null, 2));
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
