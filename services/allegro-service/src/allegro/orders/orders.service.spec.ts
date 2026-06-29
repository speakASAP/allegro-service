import 'reflect-metadata';
import { strict as assert } from 'assert';
import { ALLEGRO_ORDER_FORWARDING_CONFIRMATION, OrdersService } from './orders.service';

type OfferFixture = {
  id: string;
  allegroOfferId: string;
  accountId?: string | null;
  catalogProductId?: string | null;
  title?: string | null;
};

function createServiceFixture(orders: any[], offers: OfferFixture[]) {
  const orderClientCalls: any[] = [];
  const warnings: any[] = [];
  const errors: any[] = [];
  const logs: any[] = [];
  const captured: any = {};

  const prisma = {
    allegroOffer: {
      findMany: async (query: any) => {
        captured.offerFindMany = query;
        const requestedIds = query.where.allegroOfferId.in;
        return offers.filter((offer) => requestedIds.includes(offer.allegroOfferId));
      },
    },
    allegroOrder: {
      upsert: async (args: any) => {
        captured.orderUpsert = args;
        return { id: 'local-' + args.where.allegroOrderId };
      },
    },
    allegroOrderLineItem: {
      deleteMany: async (args: any) => {
        captured.lineItemDeleteMany = args;
        return { count: 0 };
      },
      createMany: async (args: any) => {
        captured.lineItemCreateMany = args;
        return { count: args.data.length };
      },
    },
  };

  const logger = {
    log: (...args: any[]) => logs.push(args),
    warn: (...args: any[]) => warnings.push(args),
    error: (...args: any[]) => errors.push(args),
  };

  const allegroApi = {
    getOrders: async () => ({ checkoutForms: orders }),
  };

  const configService = {
    get: () => 'PLN',
  };

  const orderClient = {
    createOrder: async (payload: any) => {
      orderClientCalls.push(payload);
      return { id: 'central-order-1' };
    },
  };

  const service = new OrdersService(
    prisma as any,
    logger as any,
    allegroApi as any,
    configService as any,
    orderClient as any,
  );

  return { service, orderClientCalls, warnings, errors, logs, captured };
}

function buildAllegroOrder(lineItems: any[]) {
  return {
    id: 'allegro-order-1',
    lineItems,
    summary: { totalToPay: { amount: '25.00', currency: 'PLN' } },
    status: 'READY_FOR_PROCESSING',
    payment: { finishedAt: '2026-06-26T10:01:00.000Z', provider: 'ONLINE' },
    fulfillment: { status: 'NEW' },
    delivery: {
      method: { name: 'Allegro Automaty Paczkowe One' },
      address: { city: 'Synthetic' },
    },
    invoice: { required: false },
    marketplace: { id: 'allegro-cz' },
    revision: '1',
    buyer: { email: 'buyer@example.invalid', login: 'buyer-login' },
    createdAt: '2026-06-26T10:00:00.000Z',
  };
}

async function testDefaultSyncProjectsLocallyWithoutCentralForwarding() {
  const order = buildAllegroOrder([
    { offer: { id: 'offer-1', name: 'Mapped line' }, quantity: 1, price: { amount: '10.00' } },
  ]);
  const fixture = createServiceFixture([order], [
    { id: 'db-offer-1', allegroOfferId: 'offer-1', accountId: 'account-a', catalogProductId: 'catalog-a', title: 'Stored first' },
  ]);

  const result = await fixture.service.syncOrdersFromAllegro();

  assert.equal(result.totalSynced, 1);
  assert.equal(result.forwarding.enabled, false);
  assert.equal(result.forwarding.forwarded, 0);
  assert.equal(result.forwarding.skipped, 1);
  assert.equal(fixture.orderClientCalls.length, 0);
  assert.equal(fixture.logs.some((entry) => entry[0] === 'Projected Allegro order locally; central orders forwarding is disabled'), true);
}

async function testMultiLineOrderForwardsEachLineCatalogProductId() {
  const order = buildAllegroOrder([
    { offer: { id: 'offer-1', name: 'First line' }, quantity: 2, price: { amount: '10.00' } },
    { offer: { id: 'offer-2', name: 'Second line' }, quantity: 1, price: { amount: '5.00' } },
  ]);
  const fixture = createServiceFixture([order], [
    { id: 'db-offer-1', allegroOfferId: 'offer-1', accountId: 'account-a', catalogProductId: 'catalog-a', title: 'Stored first' },
    { id: 'db-offer-2', allegroOfferId: 'offer-2', accountId: 'account-a', catalogProductId: 'catalog-b', title: 'Stored second' },
  ]);

  const result = await fixture.service.syncOrdersFromAllegro({
    forwardToOrdersMicroservice: true,
    confirmForwarding: ALLEGRO_ORDER_FORWARDING_CONFIRMATION,
  });

  assert.equal(result.totalSynced, 1);
  assert.equal(result.forwarding.enabled, true);
  assert.equal(result.forwarding.forwarded, 1);
  assert.deepEqual(fixture.captured.offerFindMany.where.allegroOfferId.in.sort(), ['offer-1', 'offer-2']);
  assert.equal(fixture.captured.orderUpsert.create.catalogProductId, 'catalog-a');
  assert.equal(fixture.captured.orderUpsert.create.lineItemsCount, 2);
  assert.equal(fixture.captured.orderUpsert.create.marketplaceId, 'allegro-cz');
  assert.equal(fixture.captured.orderUpsert.create.paymentStatus, 'PAID');
  assert.equal(fixture.captured.lineItemCreateMany.data.length, 2);
  assert.equal(fixture.captured.lineItemCreateMany.data[0].allegroOfferExternalId, 'offer-1');
  assert.equal(fixture.captured.lineItemCreateMany.data[1].catalogProductId, 'catalog-b');
  assert.equal(fixture.orderClientCalls.length, 1);
  assert.equal(fixture.orderClientCalls[0].externalOrderId, 'allegro-order-1');
  assert.equal(fixture.orderClientCalls[0].channel, 'allegro');
  assert.equal(fixture.orderClientCalls[0].channelAccountId, 'account-a');
  assert.equal(fixture.orderClientCalls[0].items.length, 2);
  assert.equal(fixture.orderClientCalls[0].items[0].productId, 'catalog-a');
  assert.equal(fixture.orderClientCalls[0].items[0].quantity, 2);
  assert.equal(fixture.orderClientCalls[0].items[0].totalPrice, 20);
  assert.equal(fixture.orderClientCalls[0].items[1].productId, 'catalog-b');
  assert.equal(fixture.orderClientCalls[0].items[1].quantity, 1);
  assert.equal(fixture.orderClientCalls[0].items[1].totalPrice, 5);
  assert.equal(fixture.orderClientCalls[0].total, 25);
  assert.equal(fixture.warnings.length, 0);
}

async function testMissingPrimaryOfferStillPersistsCheckoutFormButSkipsCentralForward() {
  const order = buildAllegroOrder([
    { offer: { id: 'offer-missing', name: 'Missing first line' }, quantity: 1, price: { amount: '10.00' } },
    { offer: { id: 'offer-2', name: 'Mapped second line' }, quantity: 1, price: { amount: '15.00' } },
  ]);
  const fixture = createServiceFixture([order], [
    { id: 'db-offer-2', allegroOfferId: 'offer-2', accountId: 'account-a', catalogProductId: 'catalog-b' },
  ]);

  const result = await fixture.service.syncOrdersFromAllegro({
    forwardToOrdersMicroservice: true,
    confirmForwarding: ALLEGRO_ORDER_FORWARDING_CONFIRMATION,
  });

  assert.equal(result.totalSynced, 1);
  assert.equal(result.forwarding.enabled, true);
  assert.equal(result.forwarding.skipped, 1);
  assert.equal(fixture.captured.orderUpsert.create.allegroOfferId, null);
  assert.equal(fixture.captured.orderUpsert.create.catalogProductId, null);
  assert.equal(fixture.captured.lineItemCreateMany.data.length, 2);
  assert.equal(fixture.captured.lineItemCreateMany.data[0].allegroOfferId, null);
  assert.equal(fixture.captured.lineItemCreateMany.data[1].allegroOfferId, 'db-offer-2');
  assert.equal(fixture.orderClientCalls.length, 0);
  assert.equal(fixture.warnings.length, 1);
  assert.equal(fixture.warnings[0][0], 'Skipped forwarding Allegro order to orders-microservice because catalog mapping is incomplete');
  assert.deepEqual(fixture.warnings[0][1].missingOfferIds, ['offer-missing']);
}

async function testMissingCatalogProductSkipsMalformedCentralForward() {
  const order = buildAllegroOrder([
    { offer: { id: 'offer-1', name: 'First line' }, quantity: 1, price: { amount: '10.00' } },
    { offer: { id: 'offer-2', name: 'Unmapped catalog line' }, quantity: 1, price: { amount: '15.00' } },
  ]);
  const fixture = createServiceFixture([order], [
    { id: 'db-offer-1', allegroOfferId: 'offer-1', accountId: 'account-a', catalogProductId: 'catalog-a' },
    { id: 'db-offer-2', allegroOfferId: 'offer-2', accountId: 'account-a', catalogProductId: null },
  ]);

  await fixture.service.syncOrdersFromAllegro({
    forwardToOrdersMicroservice: true,
    confirmForwarding: ALLEGRO_ORDER_FORWARDING_CONFIRMATION,
  });

  assert.equal(fixture.orderClientCalls.length, 0);
  assert.equal(fixture.warnings.length, 1);
  assert.ok(fixture.warnings[0][1].blockedReasons.includes('missing_catalog_product:line_1_missing_catalog_product_id'));
  assert.deepEqual(fixture.warnings[0][1].missingCatalogOfferIds, ['offer-2']);
}

export async function runOrdersServiceSpec(): Promise<void> {
  await testDefaultSyncProjectsLocallyWithoutCentralForwarding();
  await testMultiLineOrderForwardsEachLineCatalogProductId();
  await testMissingPrimaryOfferStillPersistsCheckoutFormButSkipsCentralForward();
  await testMissingCatalogProductSkipsMalformedCentralForward();
}

if (require.main === module) {
  runOrdersServiceSpec()
    .then(() => process.stdout.write('orders.service.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write('orders.service.spec: FAIL\n' + (error.stack || error.message) + '\n');
      process.exitCode = 1;
    });
}
