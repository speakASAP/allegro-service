import { strict as assert } from 'assert';
import {
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  buildApprovedSuggestionPatch,
  createSyntheticAiOfferOptimizationResponse,
} from './ai-offer-optimization.contract';

function createRequest() {
  return buildAiOfferOptimizationRequest({
    requestedByUserId: 'user-1',
    offer: {
      offerId: 'offer-1',
      catalogProductId: 'catalog-1',
      accountId: 'account-1',
      title: 'Premium headphones token=abc123',
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
        clientSecret: 'super-secret',
      },
    },
    blockedReasons: ['requires-manual-review'],
  });
}

async function testRequestBuilderRedactsSensitiveText() {
  const request = createRequest();
  const serialized = JSON.stringify(request);

  assert.equal(request.mode, 'suggestion_only');
  assert.equal(request.policyContext.requiresHumanReview, true);
  assert.equal(request.policyContext.allowedMutationPath, 'publish_lifecycle_only');
  assert.match(request.offerSnapshot.title, /\[REDACTED_SECRET\]/);
  assert.match(request.offerSnapshot.description || '', /\[REDACTED_EMAIL\]/);
  assert.match(request.offerSnapshot.description || '', /\[REDACTED_TOKEN\]/);
  assert.ok(!serialized.includes('super-secret'));
}

async function testSuggestionRecordUsesDeterministicSnapshotHash() {
  const request = createRequest();
  const secondRequest = createRequest();
  assert.equal(request.snapshotHash, secondRequest.snapshotHash);

  const record = buildAiSuggestionRecord(request, createSyntheticAiOfferOptimizationResponse());

  assert.equal(record.reviewState, 'pending_review');
  assert.equal(record.approvalPath.requiresHumanReview, true);
  assert.equal(record.inputSnapshotHash, request.snapshotHash);
}

async function testApprovedPatchStaysLifecycleGated() {
  const request = createRequest();
  const record = buildAiSuggestionRecord(
    request,
    createSyntheticAiOfferOptimizationResponse({
      suggestions: [
        {
          suggestionId: 's-1',
          kind: 'title-rewrite',
          summary: 'Shorten the title',
          proposedValue: { title: 'Premium wireless headphones with ANC' },
          confidence: 0.82,
          expectedImpact: 'Can improve CTR.',
          evidence: ['Synthetic listing CTR fixture.'],
          policyBlockers: [],
          rollbackNotes: 'Restore the previous title if CTR falls.',
        },
      ],
    }),
  );

  const patch = buildApprovedSuggestionPatch(record, ['s-1'], 'reviewer-1');
  assert.equal(patch.lifecycleInput.action, 'UPDATE');
  assert.equal(patch.lifecycleInput.requiresConfirmation, true);
  assert.equal(patch.lifecycleInput.source, 'TASK-005');
  assert.deepEqual(patch.lifecycleInput.approvedSuggestionIds, ['s-1']);
  assert.equal(patch.lifecycleInput.changes.title, 'Premium wireless headphones with ANC');
  assert.equal(patch.reviewState, 'APPROVED');
}

export async function runAiOfferOptimizationSpec(): Promise<void> {
  await testRequestBuilderRedactsSensitiveText();
  await testSuggestionRecordUsesDeterministicSnapshotHash();
  await testApprovedPatchStaysLifecycleGated();
}

if (require.main === module) {
  runAiOfferOptimizationSpec()
    .then(() => process.stdout.write('ai-offer-optimization.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`ai-offer-optimization.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
