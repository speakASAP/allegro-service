#!/usr/bin/env node
/*
 * Harvest product/offer data from Allegro order line items.
 *
 * Default mode is read-only and prints JSON. Use --persist to upsert recovered
 * offers into allegro_offers without storing buyer personal data.
 */

const crypto = require('crypto');

function parseArgs(argv) {
  const args = {
    accountName: 'statexcz',
    userId: 'b5b3ad6e-079b-4971-b9da-b7c58cf5b454',
    limit: 100,
    maxOrders: 500,
    persist: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--persist') args.persist = true;
    else if (arg === '--account-name') args.accountName = argv[++i];
    else if (arg === '--user-id') args.userId = argv[++i];
    else if (arg === '--max-orders') args.maxOrders = Number(argv[++i]);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--help') {
      process.stdout.write('Usage: node scripts/harvest-order-offers.js [--account-name statexcz] [--user-id <auth-user-id>] [--max-orders 500] [--persist]\n');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function loadPrismaClient() {
  try {
    if (require('fs').existsSync('/app/shared/node_modules/@prisma/client')) {
      return require('/app/shared/node_modules/@prisma/client').PrismaClient;
    }
  } catch (_) {
    // Fall back to regular package resolution below.
  }

  try {
    return require('@prisma/client').PrismaClient;
  } catch (_) {
    return require('/app/shared/node_modules/@prisma/client').PrismaClient;
  }
}

function decrypt(encryptedText, encryptionKey) {
  const parts = String(encryptedText || '').split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted text format');

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKey.substring(0, 32), 'utf8'),
    Buffer.from(parts[0], 'hex'),
  );

  return Buffer.concat([
    decipher.update(Buffer.from(parts[1], 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

async function allegroGet(accessToken, path, params = {}) {
  const url = new URL(`https://api.allegro.pl${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.allegro.public.v1+json',
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_) {
    body = { raw: text.slice(0, 1000) };
  }

  if (!response.ok) {
    const message = body?.errors?.[0]?.userMessage || body?.errors?.[0]?.message || body?.message || text.slice(0, 300);
    const error = new Error(`${response.status} ${path}: ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function descriptionItems(description) {
  const items = [];
  for (const section of description?.sections || []) {
    for (const item of section.items || []) items.push(item);
  }
  return items;
}

function collectDescriptionText(description) {
  return descriptionItems(description)
    .filter((item) => item.type === 'TEXT' && item.content)
    .map((item) => String(item.content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n') || null;
}

function collectImageUrls(offer) {
  const urls = new Set();
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) urls.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object') {
      for (const key of ['url', 'src', 'original', 'thumbnail']) visit(value[key]);
      if (value.product) visit(value.product.images);
      if (value.items) visit(value.items);
      if (value.sections) visit(value.sections);
    }
  };

  visit(offer?.images);
  visit(offer?.productSet);
  for (const item of descriptionItems(offer?.description)) {
    if (item.type === 'IMAGE') visit(item.url || item);
  }

  return Array.from(urls);
}

function collectParameters(offer) {
  const parameters = [];
  for (const productSetItem of offer?.productSet || []) {
    for (const parameter of productSetItem?.product?.parameters || []) {
      parameters.push({
        id: parameter.id || null,
        name: parameter.name || null,
        values: parameter.values || parameter.valuesIds || [],
      });
    }
  }
  for (const parameter of offer?.parameters || []) {
    parameters.push({
      id: parameter.id || null,
      name: parameter.name || null,
      values: parameter.values || parameter.valuesIds || [],
    });
  }
  return parameters;
}

function summarizeOrderRefs(refs) {
  const orderDates = refs.map((ref) => ref.orderCreatedAt).filter(Boolean).sort();
  const prices = refs.map((ref) => ref.price).filter(Boolean);
  return {
    orderCount: refs.length,
    orderedQuantity: refs.reduce((sum, ref) => sum + (Number(ref.quantity) || 0), 0),
    firstOrderAt: orderDates[0] || null,
    lastOrderAt: orderDates[orderDates.length - 1] || null,
    samplePrices: prices.slice(0, 5),
  };
}

function projectFullOffer(offer, refs) {
  return {
    source: 'ALLEGRO_PRODUCT_OFFERS',
    allegroOfferId: offer.id,
    title: offer.name || refs[0]?.offerName || '',
    categoryId: offer.category?.id || null,
    status: offer.publication?.status || null,
    publicationStatus: offer.publication?.status || null,
    price: offer.sellingMode?.price?.amount || refs[0]?.price?.amount || '0',
    currency: offer.sellingMode?.price?.currency || refs[0]?.price?.currency || 'CZK',
    stockQuantity: offer.stock?.available ?? 0,
    externalId: offer.external?.id || null,
    descriptionText: collectDescriptionText(offer.description),
    descriptionRaw: offer.description || null,
    images: collectImageUrls(offer),
    parameters: collectParameters(offer),
    orderStats: summarizeOrderRefs(refs),
    orderEvidence: refs,
    rawData: offer,
    recoverability: 'FULL_OFFER_PAYLOAD',
  };
}

function projectOrderOnlyOffer(offerId, refs, error) {
  const latest = refs.slice().sort((a, b) => String(b.orderCreatedAt || '').localeCompare(String(a.orderCreatedAt || '')))[0] || refs[0];
  return {
    source: 'ALLEGRO_ORDER_LINE_ITEMS',
    allegroOfferId: offerId,
    title: latest?.offerName || '',
    categoryId: null,
    status: 'ORDER_HISTORY_ONLY',
    publicationStatus: 'UNKNOWN',
    price: latest?.price?.amount || '0',
    currency: latest?.price?.currency || 'CZK',
    stockQuantity: 0,
    externalId: null,
    descriptionText: null,
    descriptionRaw: null,
    images: [],
    parameters: [],
    orderStats: summarizeOrderRefs(refs),
    orderEvidence: refs,
    rawData: { orderEvidence: refs, fetchError: { message: error.message, status: error.status || null } },
    recoverability: 'ORDER_LINE_ONLY',
  };
}

async function fetchOrders(accessToken, options) {
  const orders = [];
  let offset = 0;
  while (orders.length < options.maxOrders) {
    const page = await allegroGet(accessToken, '/order/checkout-forms', {
      limit: options.limit,
      offset,
    });
    const checkoutForms = page.checkoutForms || [];
    orders.push(...checkoutForms);
    if (checkoutForms.length < options.limit) break;
    offset += options.limit;
  }
  return orders.slice(0, options.maxOrders);
}

function collectLineOfferRefs(orders) {
  const byOfferId = new Map();
  for (const order of orders) {
    for (const lineItem of order.lineItems || []) {
      const offerId = lineItem.offer?.id;
      if (!offerId) continue;
      if (!byOfferId.has(offerId)) byOfferId.set(offerId, []);
      byOfferId.get(offerId).push({
        orderId: order.id,
        orderCreatedAt: order.createdAt || null,
        quantity: lineItem.quantity || 1,
        offerName: lineItem.offer?.name || null,
        price: lineItem.price || null,
      });
    }
  }
  return byOfferId;
}

async function persistHarvest(prisma, accountId, item) {
  const data = {
    title: item.title || `Recovered Allegro offer ${item.allegroOfferId}`,
    description: item.descriptionText,
    categoryId: item.categoryId || 'ORDER_HISTORY',
    price: Number.parseFloat(item.price || '0') || 0,
    currency: item.currency || 'CZK',
    quantity: item.stockQuantity || 0,
    stockQuantity: item.stockQuantity || 0,
    status: item.status || 'ORDER_HISTORY_ONLY',
    publicationStatus: item.publicationStatus || 'UNKNOWN',
    images: item.images,
    rawData: {
      ...item.rawData,
      orderOfferHarvest: {
        source: item.source,
        recoverability: item.recoverability,
        orderStats: item.orderStats,
        orderEvidence: item.orderEvidence,
        parameters: item.parameters,
        descriptionRaw: item.descriptionRaw,
      },
    },
    accountId,
    syncStatus: item.recoverability === 'FULL_OFFER_PAYLOAD' ? 'SYNCED' : 'PARTIAL',
    syncSource: 'ORDER_HISTORY',
    lastSyncedAt: new Date(),
  };

  return prisma.allegroOffer.upsert({
    where: { allegroOfferId: item.allegroOfferId },
    update: data,
    create: {
      ...data,
      allegroOfferId: item.allegroOfferId,
    },
    select: { id: true, allegroOfferId: true, title: true, syncStatus: true },
  });
}

async function main() {
  const options = parseArgs(process.argv);
  if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is required');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const PrismaClient = loadPrismaClient();
  const prisma = new PrismaClient();

  try {
    const account = await prisma.allegroAccount.findFirst({
      where: { name: options.accountName, userId: options.userId },
      select: { id: true, name: true, userId: true, accessToken: true, tokenExpiresAt: true },
    });
    if (!account?.accessToken) throw new Error(`OAuth token not found for ${options.accountName}/${options.userId}`);

    const accessToken = decrypt(account.accessToken, process.env.ENCRYPTION_KEY);
    const orders = await fetchOrders(accessToken, options);
    const byOfferId = collectLineOfferRefs(orders);
    const harvested = [];
    const fetchErrors = [];

    for (const [offerId, refs] of byOfferId.entries()) {
      try {
        const offer = await allegroGet(accessToken, `/sale/product-offers/${offerId}`);
        harvested.push(projectFullOffer(offer, refs));
      } catch (error) {
        fetchErrors.push({ offerId, status: error.status || null, message: error.message });
        harvested.push(projectOrderOnlyOffer(offerId, refs, error));
      }
    }

    harvested.sort((a, b) => b.orderStats.orderCount - a.orderStats.orderCount || a.title.localeCompare(b.title));

    const persisted = [];
    if (options.persist) {
      for (const item of harvested) persisted.push(await persistHarvest(prisma, account.id, item));
    }

    process.stdout.write(JSON.stringify({
      mode: options.persist ? 'persist' : 'dry-run',
      account: {
        id: account.id,
        name: account.name,
        userId: account.userId,
        tokenExpiresAt: account.tokenExpiresAt,
      },
      ordersFetched: orders.length,
      uniqueLineOfferIds: byOfferId.size,
      fullOfferPayloads: harvested.filter((item) => item.recoverability === 'FULL_OFFER_PAYLOAD').length,
      orderLineOnly: harvested.filter((item) => item.recoverability === 'ORDER_LINE_ONLY').length,
      fetchErrors,
      persisted,
      items: harvested,
    }, null, 2));
    process.stdout.write('\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
