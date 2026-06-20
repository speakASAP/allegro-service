import { strict as assert } from 'assert';
import {
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  createSyntheticAiOfferOptimizationResponse,
} from './ai-offer-optimization.contract';

function createOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: '22222222-2222-2222-2222-222222222222',
    catalogProductId: '33333333-3333-3333-3333-333333333333',
    title: 'Synthetic title',
    description: 'Synthetic description',
    categoryId: 'cat-123',
    attributes: [{ name: 'color', value: 'blue' }],
    price: 109,
    currency: 'PLN',
    stockQuantity: 5,
    images: ['https://example.invalid/product.jpg'],
    rawData: {
      catalogSnapshot: {
        id: '33333333-3333-3333-3333-333333333333',
        sku: 'SKU-1',
        title: 'Synthetic title',
      },
      delivery: { method: 'locker' },
      payments: { installments: false },
      tokens: { accessToken: 'super-secret-token' },
      customerEmail: 'buyer@example.com',
      authorization: 'Bearer top-secret',
    },
    ...overrides,
  };
}

async function testRequestIsSuggestionOnlyAndRedacted() {
  const request = buildAiOfferOptimizationRequest({
    offer: createOffer(),
    policyEvaluation: {
      version: 'TASK-003.v1',
      results: [
        { gate: 'catalog-validation', status: 'PASS', ownerService: 'catalog-microservice', remediation: 'none' },
      ],
      summary: { blockers: 0, warnings: 0, recommendations: 0 },
    },
  });

  assert.equal(request.contractVersion, 'TASK-005.v1');
  assert.equal(request.mode, 'SUGGESTION_ONLY');
  assert.equal(request.reviewState, 'DRAFT');
  assert.equal(request.constraints.autonomousPublishAllowed, false);
  assert.equal(request.constraints.requiresHumanApproval, true);

  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes('super-secret-token'), false);
  assert.equal(serialized.includes('buyer@example.com'), false);
  assert.equal(serialized.includes('Bearer top-secret'), false);
  assert.equal(serialized.includes('[REDACTED]'), true);
}

async function testSuggestionRecordStaysDraftOnly() {
  const request = buildAiOfferOptimizationRequest({ offer: createOffer() });
  const response = createSyntheticAiOfferOptimizationResponse();
  const record = buildAiSuggestionRecord(request, response);

  assert.equal(record.reviewState, 'DRAFT');
  assert.deepEqual(record.approvedChangeSet, []);
  assert.equal(record.response.suggestions.every((entry) => entry.requiresApproval), true);
  assert.equal(record.response.reviewChecklist.includes('Approve or reject each suggestion before lifecycle mutation.'), true);
}

async function testSnapshotHashIsDeterministic() {
  const first = buildAiOfferOptimizationRequest({ offer: createOffer() });
  const second = buildAiOfferOptimizationRequest({ offer: createOffer() });
  const changed = buildAiOfferOptimizationRequest({ offer: createOffer({ title: 'Changed synthetic title' }) });

  assert.equal(first.inputSnapshotHash, second.inputSnapshotHash);
  assert.notEqual(first.inputSnapshotHash, changed.inputSnapshotHash);
}

export async function runAiOfferOptimizationContractSpec(): Promise<void> {
  await testRequestIsSuggestionOnlyAndRedacted();
  await testSuggestionRecordStaysDraftOnly();
  await testSnapshotHashIsDeterministic();
}

if (require.main === module) {
  runAiOfferOptimizationContractSpec()
    .then(() => process.stdout.write('ai-offer-optimization.contract.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`ai-offer-optimization.contract.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
