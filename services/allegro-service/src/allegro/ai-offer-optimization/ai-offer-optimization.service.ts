import { createHash } from 'crypto';
import {
  AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
  AiOfferOptimizationFocusArea,
  AiOfferOptimizationRequest,
  AiOfferOptimizationResponse,
  AiSuggestionRecord,
  buildAiOfferOptimizationRequest,
  buildAiSuggestionRecord,
  buildApprovedSuggestionPatch,
} from './ai-offer-optimization.contract';

export interface DraftOfferOptimizationInput {
  correlationId?: string;
  requestedAt?: string;
  requestedByUserId: string;
  offer: {
    offerId?: string | null;
    catalogProductId?: string | null;
    accountId?: string | null;
    title: string;
    description?: string | null;
    categoryId?: string | null;
    price: number;
    currency?: string | null;
    quantity?: number | null;
    attributes?: Array<{ name: string; values: string[] }>;
    imageUrls?: string[];
  };
  catalog?: {
    sku?: string | null;
    brand?: string | null;
    isAiCoCreated?: boolean | null;
  };
  policySummary?: {
    blockers?: string[];
    warnings?: string[];
    recommendations?: string[];
  };
  requestedFocusAreas?: AiOfferOptimizationFocusArea[];
}

const DEFAULT_FOCUS_AREAS: AiOfferOptimizationFocusArea[] = [
  'title',
  'description',
  'attributes',
  'category',
  'images',
  'price',
  'quality',
];

export class AiOfferOptimizationService {
  createRequest(input: DraftOfferOptimizationInput): AiOfferOptimizationRequest {
    return buildAiOfferOptimizationRequest({
      correlationId: input.correlationId || this.createCorrelationId(input),
      requestedAt: input.requestedAt,
      listingSnapshot: {
        catalogProductId: input.offer.catalogProductId || 'UNKNOWN-CATALOG',
        offerId: input.offer.offerId || null,
        accountId: input.offer.accountId || null,
        title: input.offer.title,
        description: input.offer.description || null,
        categoryId: input.offer.categoryId || null,
        images: Array.isArray(input.offer.imageUrls) ? input.offer.imageUrls.slice(0, 8) : [],
        price: {
          amount: Number(input.offer.price),
          currency: input.offer.currency || 'PLN',
        },
        quantity: this.toNonNegativeInteger(input.offer.quantity),
        attributes: Array.isArray(input.offer.attributes)
          ? input.offer.attributes.map((attribute) => ({ name: attribute.name, values: [...attribute.values] }))
          : [],
        publicationStatus: null,
        product: {
          sku: input.catalog?.sku || null,
          brand: input.catalog?.brand || null,
          isAiCoCreated: Boolean(input.catalog?.isAiCoCreated),
        },
        policySummary: {
          blockers: [...(input.policySummary?.blockers || [])],
          warnings: [...(input.policySummary?.warnings || [])],
          recommendations: [
            ...(input.policySummary?.recommendations || []),
            ...this.resolveFocusAreas(input.requestedFocusAreas).map((focusArea) => `review ${focusArea} suggestion`),
          ],
        },
      },
    });
  }

  validateResponse(response: AiOfferOptimizationResponse): void {
    if (response.contractVersion !== AI_OFFER_OPTIMIZATION_CONTRACT_VERSION) {
      throw new Error(`Unsupported contract version: ${response.contractVersion}`);
    }
    if (typeof response.correlationId !== 'string' || response.correlationId.trim().length === 0) {
      throw new Error('AI response correlationId is required');
    }
    if (!response.model?.provider || !response.model?.model) {
      throw new Error('AI model metadata is required');
    }
    if (!Array.isArray(response.suggestions) || response.suggestions.length === 0) {
      throw new Error('At least one AI suggestion is required');
    }

    for (const suggestion of response.suggestions) {
      if (typeof suggestion.id !== 'string' || suggestion.id.trim().length === 0) {
        throw new Error('AI suggestions require stable ids');
      }
      if (!DEFAULT_FOCUS_AREAS.includes(suggestion.focusArea)) {
        throw new Error(`Unsupported focus area: ${String(suggestion.focusArea)}`);
      }
      if (!Number.isFinite(suggestion.confidence) || suggestion.confidence < 0 || suggestion.confidence > 1) {
        throw new Error(`Suggestion ${suggestion.id} has invalid confidence`);
      }
      if (typeof suggestion.summary !== 'string' || suggestion.summary.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.id} is missing a summary`);
      }
      if (typeof suggestion.rationale !== 'string' || suggestion.rationale.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.id} is missing a rationale`);
      }
      if (typeof suggestion.rollbackNotes !== 'string' || suggestion.rollbackNotes.trim().length === 0) {
        throw new Error(`Suggestion ${suggestion.id} is missing rollback notes`);
      }
    }
  }

  materializeSuggestionRecord(input: DraftOfferOptimizationInput, response: AiOfferOptimizationResponse): AiSuggestionRecord {
    const request = this.createRequest(input);
    this.validateResponse(response);
    return buildAiSuggestionRecord(request, response);
  }

  materializeSuggestionRecords(input: DraftOfferOptimizationInput, response: AiOfferOptimizationResponse): AiSuggestionRecord[] {
    return [this.materializeSuggestionRecord(input, response)];
  }

  buildLifecyclePatch(record: AiSuggestionRecord, approvedSuggestionIds: string[], reviewedByUserId: string) {
    return buildApprovedSuggestionPatch(record, approvedSuggestionIds, reviewedByUserId);
  }

  private resolveFocusAreas(focusAreas?: AiOfferOptimizationFocusArea[]): AiOfferOptimizationFocusArea[] {
    if (!Array.isArray(focusAreas) || focusAreas.length === 0) {
      return [...DEFAULT_FOCUS_AREAS];
    }
    return focusAreas.filter((focusArea, index) => DEFAULT_FOCUS_AREAS.includes(focusArea) && focusAreas.indexOf(focusArea) === index);
  }

  private toNonNegativeInteger(value: number | null | undefined): number {
    if (value == null || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.trunc(Number(value)));
  }

  private createCorrelationId(input: DraftOfferOptimizationInput): string {
    const base = JSON.stringify({
      requestedByUserId: input.requestedByUserId,
      offerId: input.offer.offerId || null,
      catalogProductId: input.offer.catalogProductId || null,
      title: input.offer.title,
    });
    return `task-005-${createHash('sha256').update(base).digest('hex').slice(0, 12)}`;
  }
}
