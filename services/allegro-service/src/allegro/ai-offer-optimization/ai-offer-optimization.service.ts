import { createHash } from 'crypto';
import {
  AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
  AI_SUGGESTION_KINDS,
  AiOptimizationRequest,
  AiOptimizationResponse,
  AiSuggestionKind,
  LocalAiSuggestionRecord,
} from './ai-offer-optimization.contract';

export interface DraftOfferOptimizationInput {
  requestedByUserId: string;
  offer: {
    offerId?: string | null;
    catalogProductId?: string | null;
    accountId?: string | null;
    title: string;
    description?: string | null;
    categoryId: string;
    price: number;
    currency?: string | null;
    quantity?: number | null;
    attributes?: Array<{ name: string; values: string[] }>;
    imageUrls?: string[];
    rawData?: Record<string, unknown>;
  };
  catalog?: {
    sku?: string | null;
    brand?: string | null;
    categoryPath?: string[];
    sellable?: boolean | null;
    rawData?: Record<string, unknown>;
  };
  metrics?: {
    views7d?: number | null;
    clicks7d?: number | null;
    conversions7d?: number | null;
    addToCart7d?: number | null;
    returnRate30d?: number | null;
  };
  blockedReasons?: string[];
  requestedSuggestionKinds?: AiSuggestionKind[];
}

const DEFAULT_SUGGESTION_KINDS: AiSuggestionKind[] = [...AI_SUGGESTION_KINDS];
const REDACTION_RULES = [
  'exclude_customer_and_order_data',
  'exclude_oauth_tokens_and_secrets',
  'exclude_authorization_headers',
  'whitelist_offer_fields_only',
] as const;
const OMITTED_FIELDS = [
  'buyerEmail',
  'buyerLogin',
  'customerNotes',
  'oauthToken',
  'authorizationHeader',
  'clientSecret',
  'paymentDetails',
  'rawData',
] as const;

export class AiOfferOptimizationService {
  createRequest(input: DraftOfferOptimizationInput): AiOptimizationRequest {
    const requestedKinds = this.resolveSuggestionKinds(input.requestedSuggestionKinds);

    return {
      contractVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
      mode: 'suggestion_only',
      generatedAt: new Date().toISOString(),
      requestedByUserId: input.requestedByUserId,
      requestedSuggestionKinds: requestedKinds,
      redaction: {
        classification: 'synthetic',
        appliedRules: [...REDACTION_RULES],
        omittedFields: [...OMITTED_FIELDS],
      },
      offerSnapshot: {
        offerId: input.offer.offerId || null,
        catalogProductId: input.offer.catalogProductId || null,
        accountId: input.offer.accountId || null,
        title: input.offer.title,
        description: input.offer.description || null,
        categoryId: input.offer.categoryId,
        price: Number(input.offer.price),
        currency: input.offer.currency || 'PLN',
        quantity: this.toNonNegativeInteger(input.offer.quantity),
        attributes: Array.isArray(input.offer.attributes)
          ? input.offer.attributes.map((attribute) => ({
              name: attribute.name,
              values: [...attribute.values],
            }))
          : [],
        imageUrls: Array.isArray(input.offer.imageUrls) ? input.offer.imageUrls.slice(0, 8) : [],
      },
      catalogSnapshot: {
        sku: input.catalog?.sku || null,
        brand: input.catalog?.brand || null,
        categoryPath: Array.isArray(input.catalog?.categoryPath) ? [...input.catalog!.categoryPath!] : [],
        sellable: typeof input.catalog?.sellable === 'boolean' ? input.catalog.sellable : null,
      },
      metrics: {
        views7d: this.toMetric(input.metrics?.views7d),
        clicks7d: this.toMetric(input.metrics?.clicks7d),
        conversions7d: this.toMetric(input.metrics?.conversions7d),
        addToCart7d: this.toMetric(input.metrics?.addToCart7d),
        returnRate30d: this.toMetric(input.metrics?.returnRate30d),
      },
      policyContext: {
        requiresHumanReview: true,
        requiresPolicyConfirmation: true,
        blockedReasons: [...(input.blockedReasons || [])],
        allowedMutationPath: 'publish_lifecycle_only',
      },
    };
  }

  validateResponse(response: AiOptimizationResponse): void {
    if (response.contractVersion !== AI_OFFER_OPTIMIZATION_CONTRACT_VERSION) {
      throw new Error(`Unsupported contract version: ${response.contractVersion}`);
    }

    if (response.mode !== 'suggestion_only') {
      throw new Error('AI offer optimization must remain suggestion_only');
    }

    if (!response.model?.provider || !response.model?.name) {
      throw new Error('AI model metadata is required');
    }

    if (!Array.isArray(response.suggestions) || response.suggestions.length === 0) {
      throw new Error('At least one suggestion is required');
    }

    for (const suggestion of response.suggestions) {
      if (!AI_SUGGESTION_KINDS.includes(suggestion.kind)) {
        throw new Error(`Unsupported suggestion kind: ${String(suggestion.kind)}`);
      }
      if (typeof suggestion.summary !== 'string' || suggestion.summary.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.suggestionId} is missing a summary`);
      }
      if (!Number.isFinite(suggestion.confidence) || suggestion.confidence < 0 || suggestion.confidence > 1) {
        throw new Error(`Suggestion ${suggestion.suggestionId} has invalid confidence`);
      }
      if (!Array.isArray(suggestion.evidence) || suggestion.evidence.length === 0) {
        throw new Error(`Suggestion ${suggestion.suggestionId} must include evidence`);
      }
      if (typeof suggestion.rollbackNotes !== 'string' || suggestion.rollbackNotes.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.suggestionId} must include rollback notes`);
      }
      const serialized = JSON.stringify(suggestion.proposedValue);
      if (serialized.includes('publishCommand') || serialized.includes('directOfferUpdate')) {
        throw new Error(`Suggestion ${suggestion.suggestionId} attempts a direct mutation`);
      }
    }
  }

  materializeSuggestionRecords(
    input: DraftOfferOptimizationInput,
    response: AiOptimizationResponse,
  ): LocalAiSuggestionRecord[] {
    const request = this.createRequest(input);
    this.validateResponse(response);
    const snapshotHash = this.hashSnapshot(request);
    const createdAt = new Date().toISOString();

    return response.suggestions.map((suggestion, index) => ({
      recordId: this.createRecordId(snapshotHash, index),
      suggestionId: suggestion.suggestionId,
      kind: suggestion.kind,
      reviewState: 'pending_review',
      inputSnapshotHash: snapshotHash,
      approvalPath: {
        requiresHumanReview: true,
        requiresPolicyConfirmation: true,
        lifecycleAction: 'publish_lifecycle_required',
        nextAction: 'operator_review',
      },
      model: response.model,
      suggestedValue: suggestion.proposedValue,
      confidence: suggestion.confidence,
      expectedImpact: suggestion.expectedImpact,
      evidence: [...suggestion.evidence],
      policyBlockers: [...suggestion.policyBlockers],
      rollbackNotes: suggestion.rollbackNotes,
      createdAt,
    }));
  }

  private resolveSuggestionKinds(kinds?: AiSuggestionKind[]): AiSuggestionKind[] {
    if (!Array.isArray(kinds) || kinds.length === 0) {
      return [...DEFAULT_SUGGESTION_KINDS];
    }

    return kinds.filter((kind, index) => AI_SUGGESTION_KINDS.includes(kind) && kinds.indexOf(kind) === index);
  }

  private toMetric(value: number | null | undefined): number | null {
    if (value == null) return null;
    return Number.isFinite(value) ? Number(value) : null;
  }

  private toNonNegativeInteger(value: number | null | undefined): number {
    if (value == null || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.trunc(Number(value)));
  }

  private hashSnapshot(request: AiOptimizationRequest): string {
    return createHash('sha256').update(JSON.stringify(request)).digest('hex');
  }

  private createRecordId(snapshotHash: string, index: number): string {
    return `ai-suggestion-${snapshotHash.slice(0, 12)}-${index + 1}`;
  }
}
