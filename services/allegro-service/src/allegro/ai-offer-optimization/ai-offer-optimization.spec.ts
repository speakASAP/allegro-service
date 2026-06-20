import { strict as assert } from 'assert';
import {
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  buildApprovedSuggestionPatch,
} from './ai-offer-optimization.contract';

function createRequest() {
  return buildAiOfferOptimizationRequest({
    correlationId: 'corr-task-005',
    requestedAt: '2026-06-20T07:20:46Z',
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

async function testRequestBuilderRedactsSensitiveText() {
  const request = createRequest();

  assert.equal(request.advisoryOnly, true);
  assert.equal(request.requiresHumanReview, true);
  assert.equal(request.constraints.allowAutonomousPublish, false);
  assert.match(request.listingSnapshot.title, /\[REDACTED_SECRET\]/);
  assert.match(request.listingSnapshot.description || '', /\[REDACTED_EMAIL\]/);
  assert.match(request.listingSnapshot.description || '', /\[REDACTED_TOKEN\]/);
  assert.equal(request.redaction.strategy, 'TASK-005.v1');
}

async function testSuggestionRecordUsesDeterministicSnapshotHash() {
  const request = createRequest();
  const secondRequest = createRequest();
  assert.equal(request.snapshotHash, secondRequest.snapshotHash);

  const record = buildAiSuggestionRecord(request, {
    contractVersion: 'TASK-005.v1',
    correlationId: 'corr-task-005',
    model: {
      provider: 'openai',
      model: 'gpt-5',
      modelVersion: '2026-06-01',
    },
    suggestions: [
      {
        id: 's1',
        focusArea: 'title',
        confidence: 0.82,
        summary: 'Shorten the title',
        rationale: 'Lead with the strongest buyer keyword.',
        proposedValue: 'Premium wireless headphones with ANC',
        policyBlockers: [],
        rollbackNotes: 'Restore the previous title if CTR falls.',
      },
    ],
  });

  assert.equal(record.reviewState, 'NEEDS_REVIEW');
  assert.equal(record.approvalRequired, true);
  assert.equal(record.snapshotHash, request.snapshotHash);
  assert.equal(record.suggestions[0].status, 'DRAFT');
}

async function testApprovedPatchStaysLifecycleGated() {
  const request = createRequest();
  const record = buildAiSuggestionRecord(request, {
    contractVersion: 'TASK-005.v1',
    correlationId: 'corr-task-005',
    model: {
      provider: 'openai',
      model: 'gpt-5',
      modelVersion: '2026-06-01',
    },
    suggestions: [
      {
        id: 's1',
        focusArea: 'title',
        confidence: 0.82,
        summary: 'Shorten the title',
        rationale: 'Lead with the strongest buyer keyword.',
        proposedValue: 'Premium wireless headphones with ANC',
        policyBlockers: [],
        rollbackNotes: 'Restore the previous title if CTR falls.',
      },
      {
        id: 's2',
        focusArea: 'price',
        confidence: 0.55,
        summary: 'Test a lower price',
        rationale: 'Margin headroom exists.',
        proposedValue: 189.99,
        policyBlockers: ['requires margin review'],
        rollbackNotes: 'Rollback to the previous price if margin alert fires.',
      },
    ],
  });

  const patch = buildApprovedSuggestionPatch(record, ['s1'], 'reviewer-1');
  assert.equal(patch.lifecycleInput.action, 'UPDATE');
  assert.equal(patch.lifecycleInput.requiresConfirmation, true);
  assert.equal(patch.lifecycleInput.source, 'TASK-005');
  assert.deepEqual(patch.lifecycleInput.approvedSuggestionIds, ['s1']);
  assert.equal(patch.lifecycleInput.changes.title, 'Premium wireless headphones with ANC');
  assert.equal(patch.lifecycleInput.changes.price, undefined);
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
