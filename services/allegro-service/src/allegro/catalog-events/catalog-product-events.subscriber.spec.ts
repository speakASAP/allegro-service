import { strict as assert } from 'assert';
import { CatalogProductEventsSubscriber } from './catalog-product-events.subscriber';

const catalogProductId = '33333333-3333-3333-3333-333333333333';
const offerId = '11111111-1111-1111-1111-111111111111';
const accountId = '22222222-2222-2222-2222-222222222222';

function createHarness() {
  const webhookEvents = new Map<string, any>();
  const publishAttempts = new Map<string, any>();
  const auditLogs: any[] = [];
  const offerUpdates: any[] = [];
  const offer = {
    id: offerId,
    accountId,
    catalogProductId,
    allegroOfferId: '123456789',
    status: 'ACTIVE',
    publicationStatus: 'ACTIVE',
    stockQuantity: 8,
    quantity: 8,
    syncStatus: 'SYNCED',
    syncSource: 'ALLEGRO_API',
    syncError: null,
    account: { id: accountId, userId: 'user-1', isActive: true },
  };
  let attemptCounter = 0;

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
      findMany: async ({ where }: any) => where.catalogProductId === catalogProductId ? [{ ...offer }] : [],
      update: async ({ where, data }: any) => {
        if (where.id !== offer.id) throw new Error(`missing offer ${where.id}`);
        Object.assign(offer, data);
        offerUpdates.push({ where, data });
        return { ...offer };
      },
    },
    allegroProjectionAuditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: `audit-${auditLogs.length}`, ...data };
      },
    },
    allegroPublishAttempt: {
      findUnique: async ({ where }: any) => publishAttempts.get(where.idempotencyKey) || null,
      create: async ({ data }: any) => {
        const row = { id: `attempt-${++attemptCounter}`, ...data };
        publishAttempts.set(row.idempotencyKey, row);
        return { ...row };
      },
    },
  };

  const logger = { log: () => undefined, warn: () => undefined, error: () => undefined };
  const service = new CatalogProductEventsSubscriber(logger as any, prisma as any);
  return { service, webhookEvents, publishAttempts, auditLogs, offerUpdates, offer };
}

async function testArchivedDisablesLocalOfferAndCreatesBlockedEndIntent() {
  const harness = createHarness();
  const result = await harness.service.handleCatalogProductEvent({
    type: 'catalog.product.archived.v1',
    eventId: 'catalog-evt-1',
    productId: catalogProductId,
    occurredAt: '2026-07-02T08:00:00.000Z',
  });

  assert.equal(result.status, 'processed');
  assert.equal(result.disabledOffers, 1);
  assert.equal(harness.offerUpdates.length, 1);
  assert.equal(harness.offerUpdates[0].data.status, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.publicationStatus, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.stockQuantity, 0);
  assert.equal(harness.offerUpdates[0].data.quantity, 0);
  assert.equal(harness.offerUpdates[0].data.syncSource, 'CATALOG_ARCHIVED');
  assert.match(harness.offerUpdates[0].data.syncError, /MISSING: Allegro live offer deactivate/);
  assert.equal(harness.auditLogs.length, 1);
  const [attempt] = Array.from(harness.publishAttempts.values());
  assert.equal(attempt.action, 'END');
  assert.equal(attempt.status, 'BLOCKED');
  assert.equal(attempt.commandPayload.mutatesAllegro, false);
  assert.match(attempt.blockedReasons[0].reason, /MISSING: Allegro live offer deactivate/);
  assert.equal(harness.webhookEvents.get('CATALOG:catalog-evt-1').processed, true);
}

async function testDeletedUsesDeletedReason() {
  const harness = createHarness();
  await harness.service.handleCatalogProductEvent({
    type: 'catalog.product.deleted.v1',
    eventId: 'catalog-evt-2',
    productId: catalogProductId,
  });
  assert.equal(harness.offerUpdates[0].data.syncSource, 'CATALOG_DELETED');
}

async function testSellabilityFalseDisablesOffer() {
  const harness = createHarness();
  const result = await harness.service.handleCatalogProductEvent({
    type: 'catalog.product.sellability_changed.v1',
    eventId: 'catalog-evt-3',
    payload: { productId: catalogProductId, afterSellable: false },
  });
  assert.equal(result.status, 'processed');
  assert.equal(harness.offerUpdates[0].data.syncSource, 'CATALOG_NOT_SELLABLE');
}

async function testContractEnvelopeSellabilityFalseDisablesOffer() {
  const harness = createHarness();
  const result = await harness.service.handleCatalogProductEvent({
    eventType: 'catalog.product.sellability_changed.v1',
    eventId: 'catalog-evt-contract-1',
    occurredAt: '2026-07-02T08:05:00.000Z',
    data: {
      product: { id: catalogProductId, isActive: false, updatedAt: '2026-07-02T08:05:00.000Z' },
      change: { afterSellable: false },
    },
  });
  assert.equal(result.status, 'processed');
  assert.equal(harness.offerUpdates[0].data.syncSource, 'CATALOG_NOT_SELLABLE');
}

async function testSellabilityTrueIsIgnored() {
  const harness = createHarness();
  const result = await harness.service.handleCatalogProductEvent({
    type: 'catalog.product.sellability_changed.v1',
    eventId: 'catalog-evt-4',
    productId: catalogProductId,
    afterSellable: true,
  });
  assert.equal(result.status, 'ignored');
  assert.equal(result.reason, 'sellability_after_state_is_not_false');
  assert.equal(harness.offerUpdates.length, 0);
}

async function testDuplicateEventIdIsSkipped() {
  const harness = createHarness();
  const event = {
    type: 'catalog.product.deleted.v1',
    eventId: 'catalog-evt-5',
    productId: catalogProductId,
  };
  await harness.service.handleCatalogProductEvent(event);
  const duplicate = await harness.service.handleCatalogProductEvent(event);
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(harness.offerUpdates.length, 1);
  assert.equal(harness.auditLogs.length, 1);
}

export async function runCatalogProductEventsSpec(): Promise<void> {
  await testArchivedDisablesLocalOfferAndCreatesBlockedEndIntent();
  await testDeletedUsesDeletedReason();
  await testSellabilityFalseDisablesOffer();
  await testContractEnvelopeSellabilityFalseDisablesOffer();
  await testSellabilityTrueIsIgnored();
  await testDuplicateEventIdIsSkipped();
}

if (require.main === module) {
  runCatalogProductEventsSpec()
    .then(() => process.stdout.write('catalog-product-events.subscriber.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`catalog-product-events.subscriber.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
