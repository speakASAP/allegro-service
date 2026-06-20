import {
  AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
  AI_SUGGESTION_KINDS,
  AiSuggestionKind,
  AiOptimizationRequest,
  AiOptimizationResponse,
  LocalAiSuggestionRecord,
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  buildApprovedSuggestionPatch,
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
  };
  catalog?: {
    sku?: string | null;
    brand?: string | null;
    categoryPath?: string[];
    sellable?: boolean | null;
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

export class AiOfferOptimizationService {
  createRequest(input: DraftOfferOptimizationInput): AiOptimizationRequest {
    return buildAiOfferOptimizationRequest({
      requestedByUserId: input.requestedByUserId,
      offer: {
        ...input.offer,
        currency: input.offer.currency || 'PLN',
      },
      catalog: input.catalog,
      metrics: input.metrics,
      blockedReasons: input.blockedReasons,
      requestedSuggestionKinds: this.resolveSuggestionKinds(input.requestedSuggestionKinds),
    });
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
      throw new Error('At least one AI suggestion is required');
    }

    for (const suggestion of response.suggestions) {
      if (typeof suggestion.suggestionId !== 'string' || suggestion.suggestionId.trim().length === 0) {
        throw new Error('AI suggestions require stable ids');
      }
      if (!DEFAULT_SUGGESTION_KINDS.includes(suggestion.kind)) {
        throw new Error(`Unsupported suggestion kind: ${String(suggestion.kind)}`);
      }
      if (!Number.isFinite(suggestion.confidence) || suggestion.confidence < 0 || suggestion.confidence > 1) {
        throw new Error(`Suggestion ${suggestion.suggestionId} has invalid confidence`);
      }
      if (typeof suggestion.summary !== 'string' || suggestion.summary.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.suggestionId} is missing a summary`);
      }
      if (typeof suggestion.expectedImpact !== 'string' || suggestion.expectedImpact.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.suggestionId} is missing expectedImpact`);
      }
      if (typeof suggestion.rollbackNotes !== 'string' || suggestion.rollbackNotes.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.suggestionId} is missing rollback notes`);
      }
    }
  }

  materializeSuggestionRecord(input: DraftOfferOptimizationInput, response: AiOptimizationResponse): LocalAiSuggestionRecord {
    const request = this.createRequest(input);
    this.validateResponse(response);
    return buildAiSuggestionRecord(request, response);
  }

  materializeSuggestionRecords(input: DraftOfferOptimizationInput, response: AiOptimizationResponse): LocalAiSuggestionRecord[] {
    return [this.materializeSuggestionRecord(input, response)];
  }

  buildLifecyclePatch(record: LocalAiSuggestionRecord, approvedSuggestionIds: string[], reviewedByUserId: string) {
    return buildApprovedSuggestionPatch(record, approvedSuggestionIds, reviewedByUserId);
  }

  private resolveSuggestionKinds(kinds?: AiSuggestionKind[]): AiSuggestionKind[] {
    if (!Array.isArray(kinds) || kinds.length === 0) {
      return [...DEFAULT_SUGGESTION_KINDS];
    }
    return kinds.filter((kind, index) => DEFAULT_SUGGESTION_KINDS.includes(kind) && kinds.indexOf(kind) === index);
  }
}
