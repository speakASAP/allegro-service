import { strict as assert } from 'assert';
import { AI_OFFER_OPTIMIZATION_CONTRACT_VERSION, AiOptimizationResponse } from './ai-offer-optimization.contract';
import { AiOfferOptimizationService } from './ai-offer-optimization.service';

function buildInput() {
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
  };
}

function buildResponse(): AiOptimizationResponse {
  return {
    contractVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
    mode: 'suggestion_only',
    model: {
      provider: 'openai',
      name: 'gpt-synthetic',
      version: '2026-06-20',
    },
    suggestions: [
      {
        suggestionId: 's-1',
        kind: 'title',
        summary: 'Shorten the title and lead with the strongest search term.',
        proposedValue: 'Synthetic title with stronger keyword order',
        confidence: 0.82,
        expectedImpact: 'Higher click-through rate from search results.',
        evidence: ['Search term order improved in similar synthetic fixtures.'],
        policyBlockers: [],
        rollbackNotes: 'Restore the prior title from the draft history if CTR drops.',
      },
      {
        suggestionId: 's-2',
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
  };
}

async function testCreateRequestRedactsSensitiveFields() {
  const service = new AiOfferOptimizationService();
  const request = service.createRequest(buildInput());
  const serialized = JSON.stringify(request);

  assert.equal(request.mode, 'suggestion_only');
  assert.equal(request.redaction.classification, 'synthetic');
  assert.ok(request.redaction.omittedFields.includes('authorizationHeader'));
  assert.ok(!serialized.includes('buyer@example.invalid'));
  assert.ok(!serialized.includes('secret-token'));
  assert.ok(!serialized.includes('super-secret'));
}

async function testValidateResponseRejectsDirectMutation() {
  const service = new AiOfferOptimizationService();
  const response = buildResponse();
  response.mode = 'suggestion_only';
  response.suggestions[0].proposedValue = { directOfferUpdate: true };

  assert.throws(() => service.validateResponse(response), /direct mutation/);
}

async function testMaterializeSuggestionRecordsKeepsReviewGate() {
  const service = new AiOfferOptimizationService();
  const records = service.materializeSuggestionRecords(buildInput(), buildResponse());

  assert.equal(records.length, 2);
  assert.equal(records[0].reviewState, 'pending_review');
  assert.equal(records[0].approvalPath.requiresHumanReview, true);
  assert.equal(records[0].approvalPath.requiresPolicyConfirmation, true);
  assert.equal(records[0].approvalPath.lifecycleAction, 'publish_lifecycle_required');
  assert.equal(records[0].inputSnapshotHash, records[1].inputSnapshotHash);
  assert.ok(records[0].recordId.startsWith('ai-suggestion-'));
}

async function testValidateResponseRejectsInvalidConfidence() {
  const service = new AiOfferOptimizationService();
  const response = buildResponse();
  response.suggestions[0].confidence = 1.5;

  assert.throws(() => service.validateResponse(response), /invalid confidence/);
}

export async function runAiOfferOptimizationSpec(): Promise<void> {
  await testCreateRequestRedactsSensitiveFields();
  await testValidateResponseRejectsDirectMutation();
  await testMaterializeSuggestionRecordsKeepsReviewGate();
  await testValidateResponseRejectsInvalidConfidence();
}

if (require.main === module) {
  runAiOfferOptimizationSpec()
    .then(() => process.stdout.write('ai-offer-optimization.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`ai-offer-optimization.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
