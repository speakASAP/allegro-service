import 'reflect-metadata';
import { strict as assert } from 'assert';
import { OperationsService } from './operations.service';

function createFixture() {
  const rawPayloadFindQueries: any[] = [];
  const orderForwardingAttemptFindQueries: any[] = [];
  const prisma = {
    allegroSyncRun: {
      count: async () => 2,
      findMany: async () => [],
      findUnique: async () => null,
    },
    allegroSyncCursor: {
      count: async () => 1,
      findMany: async () => [],
    },
    allegroRawPayload: {
      count: async () => 3,
      findMany: async (query: any) => {
        rawPayloadFindQueries.push(query);
        return [{ id: 'raw-1', payloadHash: 'hash-1' }];
      },
    },
    allegroProjectionAuditLog: {
      count: async () => 4,
      findMany: async () => [],
    },
    allegroOfferStockSnapshot: {
      count: async () => 5,
      findMany: async () => [],
    },
    allegroOrderForwardingAttempt: {
      count: async () => 6,
      findMany: async (query: any) => {
        orderForwardingAttemptFindQueries.push(query);
        return [{
          id: 'attempt-1',
          status: 'FORWARDED',
          payloadHash: 'payload-hash-1',
          requestSummary: { itemCount: 1 },
          responseSummary: { id: 'central-order-1' },
        }];
      },
    },
  };
  const logs: any[] = [];
  const logger = { log: (...args: any[]) => logs.push(args), warn: () => undefined, error: () => undefined };
  return { service: new OperationsService(prisma as any, logger as any), rawPayloadFindQueries, orderForwardingAttemptFindQueries, logs };
}

async function testSummaryIsReadOnlyAndCountsEvidenceTables() {
  const fixture = createFixture();
  const summary = await fixture.service.getSummary({ accountId: 'account-1' });

  assert.equal(summary.safety.readOnly, true);
  assert.equal(summary.safety.returnsRawPayload, false);
  assert.equal(summary.counts.syncRuns, 2);
  assert.equal(summary.counts.rawPayloads, 3);
  assert.equal(summary.counts.projectionAuditLogs, 4);
  assert.equal(summary.counts.stockSnapshots, 5);
  assert.equal(summary.counts.orderForwardingAttempts, 6);
}

async function testRawPayloadListDoesNotSelectPayloadJson() {
  const fixture = createFixture();
  await fixture.service.listRawPayloads({ accountId: 'account-1', domain: 'order.checkout-forms', limit: 10 });
  const select = fixture.rawPayloadFindQueries[0].select;

  assert.equal(select.payload, undefined);
  assert.equal(select.payloadHash, true);
  assert.equal(select.piiClass, true);
  assert.deepEqual(fixture.rawPayloadFindQueries[0].where, {
    accountId: 'account-1',
    domain: 'order.checkout-forms',
  });
}

async function testOrderForwardingAttemptsExposeSummariesOnly() {
  const fixture = createFixture();
  const result = await fixture.service.listOrderForwardingAttempts({
    accountId: 'account-1',
    allegroOrderId: 'allegro-order-1',
    status: 'FORWARDED',
    payloadEqualityStatus: 'FIRST_SEEN',
    limit: 10,
  });
  const query = fixture.orderForwardingAttemptFindQueries[0];
  const select = query.select;

  assert.equal(result.items.length, 1);
  assert.deepEqual(query.where, {
    accountId: 'account-1',
    allegroOrderId: 'allegro-order-1',
    status: 'FORWARDED',
    payloadEqualityStatus: 'FIRST_SEEN',
  });
  assert.equal(select.requestSummary, true);
  assert.equal(select.responseSummary, true);
  assert.equal(select.errorSummary, true);
  assert.equal(select.payloadHash, true);
  assert.equal(select.rawPayload, undefined);
  assert.equal(select.payload, undefined);
}

export async function runOperationsServiceSpec(): Promise<void> {
  await testSummaryIsReadOnlyAndCountsEvidenceTables();
  await testRawPayloadListDoesNotSelectPayloadJson();
  await testOrderForwardingAttemptsExposeSummariesOnly();
}

if (require.main === module) {
  runOperationsServiceSpec()
    .then(() => process.stdout.write('operations.service.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write('operations.service.spec: FAIL\n' + (error.stack || error.message) + '\n');
      process.exitCode = 1;
    });
}
