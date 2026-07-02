import { strict as assert } from 'assert';
import { StockEventsSubscriber } from './stock-events.subscriber';

const productId = '33333333-3333-3333-3333-333333333333';
const offerId = '11111111-1111-1111-1111-111111111111';
const accountId = '22222222-2222-2222-2222-222222222222';

function createHarness() {
  const webhookEvents = new Map<string, any>();
  const attempts = new Map<string, any>();
  const offerUpdates: any[] = [];
  let attemptCounter = 0;
  const offer = {
    id: offerId,
    accountId,
    catalogProductId: productId,
    allegroOfferId: '123456789',
    stockQuantity: 6,
    quantity: 6,
    status: 'ACTIVE',
    publicationStatus: 'ACTIVE',
    syncStatus: 'SYNCED',
    account: { id: accountId, name: 'statex', userId: 'user-1', isActive: false, accessToken: null },
  };

  const prisma = {
    webhookEvent: {
      findUnique: async ({ where }: any) => webhookEvents.get(where.eventId) || null,
      create: async ({ data }: any) => {
        const row = { id: `event-${webhookEvents.size + 1}`, retryCount: 0, processedAt: null, processingError: null, ...data };
        webhookEvents.set(row.eventId, row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const current = webhookEvents.get(where.eventId);
        if (!current) throw new Error(`missing event ${where.eventId}`);
        const updated = {
          ...current,
          ...data,
          retryCount: typeof data.retryCount?.increment === 'number' ? current.retryCount + data.retryCount.increment : data.retryCount ?? current.retryCount,
        };
        webhookEvents.set(where.eventId, updated);
        return { ...updated };
      },
    },
    allegroOffer: {
      findMany: async ({ where }: any) => where.catalogProductId === productId ? [{ ...offer }] : [],
      update: async ({ where, data }: any) => {
        if (where.id !== offer.id) throw new Error(`missing offer ${where.id}`);
        Object.assign(offer, data);
        offerUpdates.push({ where, data });
        return { ...offer };
      },
    },
    allegroQuantityCommandAttempt: {
      findUnique: async ({ where }: any) => {
        if (where.id) return attempts.get(where.id) || null;
        if (where.idempotencyKey) return Array.from(attempts.values()).find((attempt) => attempt.idempotencyKey === where.idempotencyKey) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `qty-attempt-${++attemptCounter}`, ...data };
        attempts.set(row.id, row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const current = attempts.get(where.id);
        if (!current) throw new Error(`missing attempt ${where.id}`);
        const updated = { ...current, ...data };
        attempts.set(where.id, updated);
        return { ...updated };
      },
    },
  };
  const logger = { log: () => undefined, warn: () => undefined, error: () => undefined };
  const service = new StockEventsSubscriber(logger as any, prisma as any);
  return { service, webhookEvents, attempts, offerUpdates, offer };
}

async function testStockOutMarksLocalOfferInactiveAndBlocksUnsafeExternalCommand() {
  const harness = createHarness();
  await (harness.service as any).handleStockEvent({
    type: 'stock.out',
    eventId: 'stock-evt-1',
    productId,
    available: 0,
  });

  assert.equal(harness.offerUpdates[0].data.status, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.publicationStatus, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.stockQuantity, 0);
  assert.equal(harness.offerUpdates[0].data.quantity, 0);
  assert.equal(harness.offerUpdates[0].data.syncSource, 'WAREHOUSE_STOCK_OUT');
  const [attempt] = Array.from(harness.attempts.values());
  assert.equal(attempt.status, 'BLOCKED');
  assert.equal(attempt.targetQuantity, 0);
  assert.equal(attempt.commandPayload.outOfStockRemovesFromSaleSurface, true);
  assert.equal(harness.webhookEvents.get('WAREHOUSE:stock-evt-1').processed, true);
}

async function testZeroAvailableStockUpdatedMarksLocalOfferInactive() {
  const harness = createHarness();
  await (harness.service as any).handleStockEvent({
    type: 'stock.updated',
    eventId: 'stock-evt-2',
    productId,
    available: 0,
  });

  assert.equal(harness.offerUpdates[0].data.status, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.publicationStatus, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.syncSource, 'WAREHOUSE_ZERO_AVAILABLE');
}

async function testDuplicateStockEventIsSkipped() {
  const harness = createHarness();
  const event = { type: 'stock.out', eventId: 'stock-evt-3', productId, available: 0 };
  await (harness.service as any).handleStockEvent(event);
  const duplicate = await (harness.service as any).handleStockEvent(event);
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(harness.offerUpdates.length, 1);
  assert.equal(harness.attempts.size, 1);
}

export async function runStockEventsSubscriberSpec(): Promise<void> {
  await testStockOutMarksLocalOfferInactiveAndBlocksUnsafeExternalCommand();
  await testZeroAvailableStockUpdatedMarksLocalOfferInactive();
  await testDuplicateStockEventIsSkipped();
}

if (require.main === module) {
  runStockEventsSubscriberSpec()
    .then(() => process.stdout.write('stock-events.subscriber.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`stock-events.subscriber.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
