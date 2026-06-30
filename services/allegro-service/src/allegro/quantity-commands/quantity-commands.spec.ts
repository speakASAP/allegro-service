import { strict as assert } from 'assert';
import { QuantityCommandsService } from './quantity-commands.service';

function createHarness() {
  const attempts = new Map<string, any>();
  const offerUpdates: any[] = [];
  let idCounter = 0;
  const offer = {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: '22222222-2222-2222-2222-222222222222',
    catalogProductId: '33333333-3333-3333-3333-333333333333',
    allegroOfferId: '123456789',
    stockQuantity: 3,
    quantity: 3,
    account: { id: '22222222-2222-2222-2222-222222222222', userId: 'user-1', isActive: true, accessToken: 'iv:cipher' },
  };
  const prisma = {
    allegroOffer: {
      findUnique: async ({ where }: any) => where.id === offer.id ? { ...offer } : null,
      update: async ({ where, data }: any) => { offerUpdates.push({ where, data }); return { ...offer, ...data }; },
    },
    allegroQuantityCommandAttempt: {
      findUnique: async ({ where }: any) => {
        if (where.id) return attempts.get(where.id) || null;
        if (where.idempotencyKey) return Array.from(attempts.values()).find((attempt) => attempt.idempotencyKey === where.idempotencyKey) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const attempt = { id: `qty-attempt-${++idCounter}`, commandId: null, confirmedAt: null, queuedAt: null, startedAt: null, completedAt: null, commandResponse: null, failureContext: null, remediationContext: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        attempts.set(attempt.id, attempt);
        return { ...attempt };
      },
      update: async ({ where, data }: any) => {
        const current = attempts.get(where.id);
        if (!current) throw new Error(`missing attempt ${where.id}`);
        const updated = { ...current, ...data, updatedAt: new Date() };
        attempts.set(where.id, updated);
        return { ...updated };
      },
      findMany: async () => Array.from(attempts.values()),
      count: async () => attempts.size,
    },
  };
  const apiCalls: any[] = [];
  const api = {
    changeOfferQuantityWithOAuthToken: async (_token: string, commandId: string, changes: any[]) => { apiCalls.push({ commandId, changes }); return { id: commandId, taskCount: { total: changes.length } }; },
    getOfferQuantityCommandStatusWithOAuthToken: async () => ({ status: 'SUCCESS' }),
    getOfferQuantityCommandTasksWithOAuthToken: async () => ({ tasks: [{ status: 'SUCCESS' }] }),
  };
  const service = new QuantityCommandsService(prisma as any, { log: () => undefined, warn: () => undefined, error: () => undefined } as any, { get: () => '0123456789abcdef0123456789abcdef' } as any, api as any);
  (service as any).decryptToken = () => 'synthetic-token';
  return { service, apiCalls, offerUpdates };
}

async function testPrepareBindsPreviewToken() {
  const { service } = createHarness();
  const attempt = await service.prepare({ offerId: '11111111-1111-1111-1111-111111111111', targetQuantity: 7, idempotencyKey: 'qty-key-1' }, 'user-1');
  assert.equal(attempt.status, 'PREPARED');
  assert.equal(attempt.targetQuantity, 7);
  assert.equal(attempt.commandPayload.mutatesAllegro, true);
  assert.equal(attempt.commandPayload.mutatesWarehouse, false);
  assert.equal(typeof attempt.previewToken, 'string');
  assert.equal(attempt.previewToken.startsWith('alg-qty-preview-v1-'), true);
  assert.equal(attempt.previewTokenBinding.requiredForConfirm, true);
}

async function testConfirmRequiresPreviewToken() {
  const { service } = createHarness();
  const attempt = await service.prepare({ offerId: '11111111-1111-1111-1111-111111111111', targetQuantity: 7, idempotencyKey: 'qty-key-2' }, 'user-1');
  await assert.rejects(() => service.confirm(attempt.id, 'user-1'), (error: any) => error.getResponse?.().code === 'PREVIEW_TOKEN_REQUIRED');
}

async function testExecuteSubmitsCommandAndPollUpdatesLocalProjection() {
  const { service, apiCalls, offerUpdates } = createHarness();
  const prepared = await service.prepare({ offerId: '11111111-1111-1111-1111-111111111111', targetQuantity: 9, idempotencyKey: 'qty-key-3' }, 'user-1');
  const running = await service.confirmAndExecute(prepared.id, 'user-1', prepared.previewToken);
  assert.equal(running.status, 'RUNNING');
  assert.equal(apiCalls.length, 1);
  assert.deepEqual(apiCalls[0].changes, [{ offerId: '123456789', quantity: 9 }]);
  const terminal = await service.poll(prepared.id, 'user-1');
  assert.equal(terminal.status, 'SUCCEEDED');
  assert.deepEqual(offerUpdates[0].data, { stockQuantity: 9, quantity: 9 });
}

export async function runQuantityCommandsSpec(): Promise<void> {
  await testPrepareBindsPreviewToken();
  await testConfirmRequiresPreviewToken();
  await testExecuteSubmitsCommandAndPollUpdatesLocalProjection();
}

if (require.main === module) {
  runQuantityCommandsSpec()
    .then(() => process.stdout.write('quantity-commands.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`quantity-commands.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
