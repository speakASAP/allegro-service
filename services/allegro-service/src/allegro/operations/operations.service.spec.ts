import 'reflect-metadata';
import { strict as assert } from 'assert';
import { OperationsService } from './operations.service';

function createFixture() {
  const rawPayloadFindQueries: any[] = [];
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
  };
  const logs: any[] = [];
  const logger = { log: (...args: any[]) => logs.push(args), warn: () => undefined, error: () => undefined };
  return { service: new OperationsService(prisma as any, logger as any), rawPayloadFindQueries, logs };
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

export async function runOperationsServiceSpec(): Promise<void> {
  await testSummaryIsReadOnlyAndCountsEvidenceTables();
  await testRawPayloadListDoesNotSelectPayloadJson();
}

if (require.main === module) {
  runOperationsServiceSpec()
    .then(() => process.stdout.write('operations.service.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write('operations.service.spec: FAIL\n' + (error.stack || error.message) + '\n');
      process.exitCode = 1;
    });
}
