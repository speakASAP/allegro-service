import { strict as assert } from 'assert';
import {
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
} from './ai-offer-optimization.contract';

function createRequest() {
  return buildAiOfferOptimizationRequest({
    correlationId: 'corr-task-005-contract',
    requestedAt: '2026-06-20T07:45:00Z',
    listingSnapshot: {
      catalogProductId: 'catalog-1',
      offerId: 'offer-1',
      accountId: 'account-1',
      title: 'Premium headphones token=abc123',
      description: 'Contact owner@example.com with Bearer secret-token for replacement pads.',
      categoryId: 'audio-1',
      images: ['https://example.invalid/item-1.jpg'],
      price: { amount: 199.99, currency: 'PLN' },
      quantity: 7,
      attributes: [
        { name: 'color', values: ['black'] },
        { name: 'supportEmail', values: ['owner@example.com'] },
      ],
      publicationStatus: 'INACTIVE',
      product: {
        sku: 'SKU-1',
        brand: 'Synthetic Audio',
        isAiCoCreated: false,
      },
      policySummary: {
        blockers: [],
        warnings: ['missing lifestyle image'],
        recommendations: ['consider shorter title'],
      },
    },
  });
}

async function testRequestShapeAndRedactionMetadata() {
  const request = createRequest();
  const serialized = JSON.stringify(request);

  assert.equal(request.advisoryOnly, true);
  assert.equal(request.requiresHumanReview, true);
  assert.equal(request.lifecycleActionOnApproval, 'UPDATE');
  assert.equal(request.redaction.strategy, 'TASK-005.v1');
  assert.ok(request.redaction.maskedFields.includes('title'));
  assert.ok(!serialized.includes('owner@example.com'));
  assert.ok(!serialized.includes('secret-token'));
}

async function testSuggestionRecordStaysReviewGated() {
  const request = createRequest();
  const record = buildAiSuggestionRecord(request, {
    contractVersion: 'TASK-005.v1',
    correlationId: request.correlationId,
    model: {
      provider: 'openai',
      model: 'gpt-5',
      modelVersion: '2026-06-01',
    },
    suggestions: [
      {
        id: 's1',
        focusArea: 'price',
        confidence: 0.61,
        summary: 'Test a narrow lower price band with no automatic publish.',
        rationale: 'Synthetic pricing fixture keeps the margin warning visible.',
        proposedValue: 189.99,
        policyBlockers: ['requires margin review'],
        rollbackNotes: 'Rollback to the previous price band if margin or conversion regresses.',
      },
    ],
  });

  assert.equal(record.reviewState, 'NEEDS_REVIEW');
  assert.equal(record.approvalRequired, true);
  assert.equal(record.approvedSuggestionIds.length, 0);
  assert.equal(record.snapshotHash, request.snapshotHash);
}

async function testSnapshotHashIsDeterministic() {
  const first = createRequest();
  const second = createRequest();
  const changed = buildAiOfferOptimizationRequest({
    correlationId: 'corr-task-005-contract',
    requestedAt: '2026-06-20T07:45:00Z',
    listingSnapshot: {
      ...first.listingSnapshot,
      title: 'Changed synthetic title',
    },
  });

  assert.equal(first.snapshotHash, second.snapshotHash);
  assert.notEqual(first.snapshotHash, changed.snapshotHash);
}

export async function runAiOfferOptimizationContractSpec(): Promise<void> {
  await testRequestShapeAndRedactionMetadata();
  await testSuggestionRecordStaysReviewGated();
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
