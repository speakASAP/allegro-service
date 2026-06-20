import { strict as assert } from 'assert';
import {
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  createSyntheticAiOfferOptimizationResponse,
} from './ai-offer-optimization.contract';

function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    requestedByUserId: 'user-1',
    offer: {
      offerId: 'offer-1',
      catalogProductId: 'catalog-1',
      accountId: 'account-1',
      title: 'Synthetic title',
      description: 'Synthetic offer description',
      categoryId: 'cat-123',
      price: 129.99,
      currency: 'PLN',
      quantity: 4,
      attributes: [{ name: 'color', values: ['black'] }],
      imageUrls: ['https://example.invalid/offer-1.jpg'],
      rawData: {
        buyerEmail: 'buyer@example.invalid',
        authorizationHeader: 'Bearer secret-token',
      },
    },
    catalog: {
      sku: 'SKU-1',
      brand: 'Synthetic',
      categoryPath: ['Electronics', 'Audio'],
      sellable: true,
      rawData: {
        clientSecret: 'super-secret',
      },
    },
    metrics: {
      views7d: 120,
      clicks7d: 25,
      conversions7d: 2,
      addToCart7d: 4,
      returnRate30d: 0.01,
    },
    blockedReasons: ['manual-price-review-required'],
    ...overrides,
  };
}

async function testRequestIsSuggestionOnlyAndRedacted() {
  const request = buildAiOfferOptimizationRequest(buildInput());
  const serialized = JSON.stringify(request);

  assert.equal(request.mode, 'suggestion_only');
  assert.equal(request.redaction.classification, 'synthetic');
  assert.ok(request.redaction.omittedFields.includes('authorizationHeader'));
  assert.ok(!serialized.includes('buyer@example.invalid'));
  assert.ok(!serialized.includes('secret-token'));
  assert.ok(!serialized.includes('super-secret'));
}

async function testSuggestionRecordStaysReviewGated() {
  const request = buildAiOfferOptimizationRequest(buildInput());
  const response = createSyntheticAiOfferOptimizationResponse({
    suggestions: [
      {
        suggestionId: 's-1',
        kind: 'price-test',
        summary: 'Test a narrow lower price band with no automatic publish.',
        proposedValue: { price: 124.99, currency: 'PLN', mode: 'manual_experiment' },
        confidence: 0.61,
        expectedImpact: 'Can improve conversion if margin remains within limits.',
        evidence: ['Synthetic pricing fixture keeps margin warning visible.'],
        policyBlockers: ['requires-margin-review'],
        rollbackNotes: 'Return to the prior price band if margin or conversion regresses.',
      },
    ],
  });
  const record = buildAiSuggestionRecord(request, response);

  assert.equal(record.reviewState, 'pending_review');
  assert.equal(record.approvalPath.requiresHumanReview, true);
  assert.equal(record.approvalPath.requiresPolicyConfirmation, true);
  assert.equal(record.approvalPath.lifecycleAction, 'publish_lifecycle_required');
}

async function testSnapshotHashIsDeterministic() {
  const first = buildAiOfferOptimizationRequest(buildInput());
  const second = buildAiOfferOptimizationRequest(buildInput());
  const changed = buildAiOfferOptimizationRequest(buildInput({ offer: { ...buildInput().offer, title: 'Changed synthetic title' } }));
  const firstRecord = buildAiSuggestionRecord(first, createSyntheticAiOfferOptimizationResponse());
  const secondRecord = buildAiSuggestionRecord(second, createSyntheticAiOfferOptimizationResponse());
  const changedRecord = buildAiSuggestionRecord(changed, createSyntheticAiOfferOptimizationResponse());

  assert.equal(firstRecord.inputSnapshotHash, secondRecord.inputSnapshotHash);
  assert.notEqual(firstRecord.inputSnapshotHash, changedRecord.inputSnapshotHash);
}

export async function runAiOfferOptimizationContractSpec(): Promise<void> {
  await testRequestIsSuggestionOnlyAndRedacted();
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
