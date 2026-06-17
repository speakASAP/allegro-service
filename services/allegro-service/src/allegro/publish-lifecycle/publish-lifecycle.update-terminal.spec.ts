import { strict as assert } from 'assert';
import { PublishLifecycleService } from './publish-lifecycle.service';
import { MarketplacePolicyEngineService } from '../policy/policy-engine.service';

type AttemptRecord = Record<string, any>;

function createServiceHarness() {
  const attempts = new Map<string, AttemptRecord>();
  let idCounter = 0;

  const offerRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: '22222222-2222-2222-2222-222222222222',
    catalogProductId: '33333333-3333-3333-3333-333333333333',
    allegroOfferId: 'allegro-123',
    title: 'Synthetic title',
    categoryId: 'cat-1',
    price: 99,
    stockQuantity: 4,
    images: ['https://example.com/image.jpg'],
    rawData: { delivery: true, payments: true },
    account: {
      id: '22222222-2222-2222-2222-222222222222',
      userId: 'user-1',
      isActive: true,
      tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };

  const prisma = {
    allegroOffer: {
      findUnique: async ({ where }: any) => (where.id === offerRecord.id ? { ...offerRecord } : null),
    },
    allegroAccount: {
      findFirst: async ({ where }: any) => {
        if (where.id && where.id !== offerRecord.accountId) return null;
        if (where.userId !== 'user-1') return null;
        return {
          id: offerRecord.accountId,
          isActive: true,
          tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      },
      count: async ({ where }: any) => (where.id === offerRecord.accountId ? 1 : 0),
    },
    allegroPublishAttempt: {
      findUnique: async ({ where }: any) => {
        if (where.idempotencyKey) {
          return Array.from(attempts.values()).find((attempt) => attempt.idempotencyKey === where.idempotencyKey) ?? null;
        }
        if (where.id) {
          return attempts.get(where.id) ?? null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const attempt = {
          id: `attempt-${++idCounter}`,
          commandId: null,
          failureContext: null,
          remediationContext: null,
          confirmedAt: null,
          queuedAt: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        attempts.set(attempt.id, attempt);
        return { ...attempt };
      },
      update: async ({ where, data }: any) => {
        const current = attempts.get(where.id);
        if (!current) throw new Error(`Unknown attempt ${where.id}`);
        const updated = { ...current, ...data, updatedAt: new Date() };
        attempts.set(where.id, updated);
        return { ...updated };
      },
    },
  };

  const logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  const catalogClient = {
    getProductById: async (catalogProductId: string) => ({ id: catalogProductId, name: 'Synthetic product' }),
  };

  const updateCalls: any[] = [];
  const terminalCalls: any[] = [];
  let terminalFailure: any = null;

  const offersService = {
    publishOffersToAllegro: async () => ({ successful: 1, failed: 0, results: [] }),
    updateOffer: async (offerId: string, dto: Record<string, unknown>, userId: string) => {
      updateCalls.push({ offerId, dto, userId });
      return { id: offerId };
    },
    syncOfferUpdateToAllegroTerminal: async (userId: string, offerId: string, requestId?: string) => {
      terminalCalls.push({ userId, offerId, requestId });
      if (terminalFailure) {
        return terminalFailure;
      }
      return {
        terminal: true,
        status: 'SUCCEEDED' as const,
        offerId,
        allegroOfferId: offerRecord.allegroOfferId,
        requestId,
        result: { successful: 1, failed: 0, results: [{ offerId, status: 'ok' }] },
      };
    },
  };

  const policyEngine = new MarketplacePolicyEngineService(prisma as any, catalogClient as any);
  const service = new PublishLifecycleService(prisma as any, logger as any, offersService as any, policyEngine as any);

  return {
    service,
    updateCalls,
    terminalCalls,
    setTerminalFailure: (value: any) => {
      terminalFailure = value;
    },
  };
}

async function testUpdateAttemptPreparesWithoutBlocking() {
  const harness = createServiceHarness();
  const attempt = await harness.service.prepare(
    {
      action: 'UPDATE',
      offerId: '11111111-1111-1111-1111-111111111111',
      idempotencyKey: 'prepare-update-terminal-success',
      commandPayload: {
        title: 'Updated title',
        syncToAllegro: true,
        accessToken: 'should-not-leak',
      },
    },
    'user-1',
  );

  assert.equal(attempt.status, 'PREPARED');
  assert.deepEqual(attempt.blockedReasons, []);
  const updateGate = attempt.policySnapshot.results.find((entry: any) => entry.gate === 'update-terminal-contract');
  assert.equal(updateGate?.status, 'PASS');
  assert.equal(updateGate?.evidence?.terminalStatuses?.join(','), 'SUCCEEDED,FAILED');
  assert.equal(attempt.commandPayload.accessToken, '[REDACTED]');
}

async function testUpdateAttemptExecutesToSucceededTerminalResult() {
  const harness = createServiceHarness();
  const attempt = await harness.service.prepareConfirmAndExecute(
    {
      action: 'UPDATE',
      offerId: '11111111-1111-1111-1111-111111111111',
      idempotencyKey: 'execute-update-terminal-success',
      commandPayload: {
        title: 'Updated title',
        syncToAllegro: true,
      },
    },
    'user-1',
    'req-success',
  );

  assert.equal(attempt.status, 'SUCCEEDED');
  assert.equal(harness.updateCalls.length, 1);
  assert.deepEqual(harness.updateCalls[0], {
    offerId: '11111111-1111-1111-1111-111111111111',
    dto: { title: 'Updated title', syncToAllegro: false },
    userId: 'user-1',
  });
  assert.equal(harness.terminalCalls.length, 1);
  assert.deepEqual(harness.terminalCalls[0], {
    userId: 'user-1',
    offerId: '11111111-1111-1111-1111-111111111111',
    requestId: 'req-success',
  });
}

async function testUpdateAttemptExecutesToFailedTerminalResult() {
  const harness = createServiceHarness();
  harness.setTerminalFailure({
    terminal: true,
    status: 'FAILED',
    offerId: '11111111-1111-1111-1111-111111111111',
    allegroOfferId: 'allegro-123',
    error: {
      code: 'ALLEGRO_UPDATE_SYNC_FAILED',
      message: 'Synthetic sync failure',
      details: { accessToken: 'should-not-leak' },
    },
  });

  const attempt = await harness.service.prepareConfirmAndExecute(
    {
      action: 'UPDATE',
      offerId: '11111111-1111-1111-1111-111111111111',
      idempotencyKey: 'execute-update-terminal-failure',
    },
    'user-1',
    'req-failure',
  );

  assert.equal(attempt.status, 'FAILED');
  assert.equal(attempt.failureContext.code, 'ALLEGRO_UPDATE_SYNC_FAILED');
  assert.equal(attempt.failureContext.details.error.details.accessToken, '[REDACTED]');
  assert.equal(attempt.remediationContext.nextAction.includes('Review policy snapshot'), true);
}

export async function runPublishLifecycleUpdateTerminalSpec(): Promise<void> {
  await testUpdateAttemptPreparesWithoutBlocking();
  await testUpdateAttemptExecutesToSucceededTerminalResult();
  await testUpdateAttemptExecutesToFailedTerminalResult();
}

if (require.main === module) {
  runPublishLifecycleUpdateTerminalSpec()
    .then(() => {
      process.stdout.write('publish-lifecycle.update-terminal.spec: PASS\n');
    })
    .catch((error) => {
      process.stderr.write(`publish-lifecycle.update-terminal.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
