import { strict as assert } from 'assert';
import { AvailabilityReconciliationService } from './availability-reconciliation.service';

const catalogProductId = '33333333-3333-3333-3333-333333333333';
const offerId = '11111111-1111-1111-1111-111111111111';
const accountId = '22222222-2222-2222-2222-222222222222';

function createHarness(options: { product?: any; warehouseAvailable?: number; catalogThrows?: any } = {}) {
  const auditLogs: any[] = [];
  const publishAttempts = new Map<string, any>();
  const offerUpdates: any[] = [];
  let attemptCounter = 0;
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
    updatedAt: new Date('2026-07-02T08:00:00.000Z'),
    account: { id: accountId, userId: 'user-1', isActive: true },
  };

  const isCandidate = () => ['ACTIVE', 'ACTIVATING', 'PUBLISHED', 'SELLABLE', 'READY'].includes(String(offer.status || '').toUpperCase())
    || ['ACTIVE', 'ACTIVATING', 'PUBLISHED', 'SELLABLE', 'READY'].includes(String(offer.publicationStatus || '').toUpperCase())
    || Number(offer.quantity || 0) > 0
    || Number(offer.stockQuantity || 0) > 0;

  const prisma = {
    allegroOffer: {
      findMany: async ({ where }: any) => {
        const ids = where.catalogProductId?.in;
        const matchesProduct = Array.isArray(ids) ? ids.includes(catalogProductId) : where.catalogProductId?.not === null;
        return matchesProduct && isCandidate() ? [{ ...offer }] : [];
      },
      update: async ({ where, data }: any) => {
        if (where.id !== offer.id) throw new Error(`missing offer ${where.id}`);
        Object.assign(offer, data);
        offerUpdates.push({ where, data });
        return { ...offer };
      },
    },
    allegroProjectionAuditLog: {
      findFirst: async ({ where }: any) => auditLogs.find((row) => row.idempotencyKey === where.idempotencyKey) || null,
      create: async ({ data }: any) => {
        const row = { id: `audit-${auditLogs.length + 1}`, ...data };
        auditLogs.push(row);
        return { ...row };
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

  const catalogClient = {
    getProductById: async () => {
      if (options.catalogThrows) throw options.catalogThrows;
      return options.product === undefined ? { id: catalogProductId, isActive: true, isSellable: true } : options.product;
    },
  };
  const warehouseClient = {
    getTotalAvailable: async () => options.warehouseAvailable ?? 5,
  };
  const logger = { log: () => undefined, warn: () => undefined, error: () => undefined };
  const service = new AvailabilityReconciliationService(prisma as any, catalogClient as any, warehouseClient as any, logger as any);
  return { service, offer, offerUpdates, auditLogs, publishAttempts };
}

async function testInactiveCatalogProductFailClosesLocalOffer() {
  const harness = createHarness({ product: { id: catalogProductId, isActive: false, isSellable: true }, warehouseAvailable: 9 });
  const result = await harness.service.reconcile({ mode: 'apply', catalogProductIds: [catalogProductId] });

  assert.equal(result.disabledOffers, 1);
  assert.equal(result.auditLogsCreated, 1);
  assert.equal(result.blockedEndAttemptsCreated, 1);
  assert.equal(harness.offerUpdates[0].data.status, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.publicationStatus, 'INACTIVE');
  assert.equal(harness.offerUpdates[0].data.quantity, 0);
  assert.equal(harness.offerUpdates[0].data.stockQuantity, 0);
  assert.equal(harness.offerUpdates[0].data.syncSource, 'CATALOG_INACTIVE');
  assert.match(harness.offerUpdates[0].data.syncError, /MISSING: Allegro live offer deactivate/);
  assert.equal(harness.auditLogs[0].action, 'CATALOG_INACTIVE');
  const [attempt] = Array.from(harness.publishAttempts.values());
  assert.equal(attempt.action, 'END');
  assert.equal(attempt.status, 'BLOCKED');
  assert.equal(attempt.commandPayload.mutatesAllegro, false);
}

async function testZeroWarehouseStockFailClosesLocalOffer() {
  const harness = createHarness({ product: { id: catalogProductId, isActive: true, isSellable: true }, warehouseAvailable: 0 });
  const result = await harness.service.reconcile({ mode: 'apply', catalogProductIds: [catalogProductId] });

  assert.equal(result.disabledOffers, 1);
  assert.equal(harness.offerUpdates[0].data.syncSource, 'WAREHOUSE_ZERO_AVAILABLE');
  assert.equal(result.decisions[0].authority.warehouseAvailable, 0);
}

async function testDryRunDoesNotMutate() {
  const harness = createHarness({ product: { id: catalogProductId, archivedAt: '2026-07-02T08:00:00.000Z' }, warehouseAvailable: 5 });
  const result = await harness.service.reconcile({ mode: 'dry-run', catalogProductIds: [catalogProductId] });

  assert.equal(result.wouldDisableOffers, 1);
  assert.equal(result.disabledOffers, 0);
  assert.equal(harness.offerUpdates.length, 0);
  assert.equal(harness.auditLogs.length, 0);
  assert.equal(harness.publishAttempts.size, 0);
}

async function testIdempotentRerunDoesNotDuplicate() {
  const harness = createHarness({ product: { id: catalogProductId, isActive: false }, warehouseAvailable: 3 });
  const first = await harness.service.reconcile({ mode: 'apply', catalogProductIds: [catalogProductId] });
  const second = await harness.service.reconcile({ mode: 'apply', catalogProductIds: [catalogProductId] });

  assert.equal(first.disabledOffers, 1);
  assert.equal(second.scannedOffers, 0);
  assert.equal(harness.offerUpdates.length, 1);
  assert.equal(harness.auditLogs.length, 1);
  assert.equal(harness.publishAttempts.size, 1);
}

export async function runAvailabilityReconciliationSpec(): Promise<void> {
  await testInactiveCatalogProductFailClosesLocalOffer();
  await testZeroWarehouseStockFailClosesLocalOffer();
  await testDryRunDoesNotMutate();
  await testIdempotentRerunDoesNotDuplicate();
}

if (require.main === module) {
  runAvailabilityReconciliationSpec()
    .then(() => process.stdout.write('availability-reconciliation.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`availability-reconciliation.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
