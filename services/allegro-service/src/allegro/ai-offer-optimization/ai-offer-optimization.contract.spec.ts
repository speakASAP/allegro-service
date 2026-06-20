import { strict as assert } from 'assert';
import {
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  createSyntheticAiOfferOptimizationResponse,
} from './ai-offer-optimization.contract';

function createRequest(title = 'Premium headphones token=abc123') {
  return buildAiOfferOptimizationRequest({
    requestedByUserId: 'user-1',
    offer: {
      offerId: 'offer-1',
      catalogProductId: 'catalog-1',
      accountId: 'account-1',
      title,
      description: 'Contact owner@example.com with Bearer secret-token for replacement pads.',
      categoryId: 'audio-1',
      price: 199.99,
      currency: 'PLN',
      quantity: 7,
      attributes: [
        { name: 'color', values: ['black'] },
        { name: 'supportEmail', values: ['owner@example.com'] },
      ],
      imageUrls: ['https://example.invalid/item-1.jpg'],
      rawData: {
        authorizationHeader: 'Bearer secret-token',
      },
    },
    blockedReasons: ['manual-price-review-required'],
  });
}

async function testRequestShapeAndRedactionMetadata() {
  const request = createRequest();
  const serialized = JSON.stringify(request);

  assert.equal(request.mode, 'suggestion_only');
  assert.equal(request.redaction.classification, 'synthetic');
  assert.ok(request.redaction.omittedFields.includes('authorizationHeader'));
  assert.ok(!serialized.includes('owner@example.com'));
  assert.ok(!serialized.includes('secret-token'));
}

async function testSuggestionRecordStaysReviewGated() {
  const request = createRequest();
  const record = buildAiSuggestionRecord(
    request,
    createSyntheticAiOfferOptimizationResponse({
      suggestions: [
        {
          suggestionId: 's-1',
          kind: 'price-test',
          summary: 'Test a narrow lower price band with no automatic publish.',
          proposedValue: { price: 189.99, currency: 'PLN', mode: 'manual_experiment' },
          confidence: 0.61,
          expectedImpact: 'Can improve conversion if margin remains within limits.',
          evidence: ['Synthetic pricing fixture keeps margin warning visible.'],
          policyBlockers: ['requires-margin-review'],
          rollbackNotes: 'Rollback to the previous price band if margin or conversion regresses.',
        },
      ],
    }),
  );

  assert.equal(record.reviewState, 'pending_review');
  assert.equal(record.approvalPath.requiresHumanReview, true);
  assert.equal(record.approvalPath.requiresPolicyConfirmation, true);
  assert.equal(record.approvalPath.lifecycleAction, 'publish_lifecycle_required');
}

async function testSnapshotHashIsDeterministic() {
  const first = createRequest();
  const second = createRequest();
  const changed = createRequest('Changed synthetic title');
  const firstRecord = buildAiSuggestionRecord(first, createSyntheticAiOfferOptimizationResponse());
  const secondRecord = buildAiSuggestionRecord(second, createSyntheticAiOfferOptimizationResponse());
  const changedRecord = buildAiSuggestionRecord(changed, createSyntheticAiOfferOptimizationResponse());

  assert.equal(firstRecord.inputSnapshotHash, secondRecord.inputSnapshotHash);
  assert.notEqual(firstRecord.inputSnapshotHash, changedRecord.inputSnapshotHash);
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
