export const AI_OFFER_OPTIMIZATION_CONTRACT_VERSION = 'ai-offer-optimization.v1';

export const AI_SUGGESTION_KINDS = [
  'title',
  'description',
  'attributes',
  'category',
  'images',
  'price-test',
  'quality-check',
] as const;

export type AiSuggestionKind = (typeof AI_SUGGESTION_KINDS)[number];

export const AI_SUGGESTION_REVIEW_STATES = [
  'pending_review',
  'approved',
  'rejected',
  'applied',
  'rolled_back',
] as const;

export type AiSuggestionReviewState = (typeof AI_SUGGESTION_REVIEW_STATES)[number];

export interface AiOptimizationMetricSnapshot {
  views7d?: number | null;
  clicks7d?: number | null;
  conversions7d?: number | null;
  addToCart7d?: number | null;
  returnRate30d?: number | null;
}

export interface AiOptimizationPolicyContext {
  requiresHumanReview: true;
  requiresPolicyConfirmation: true;
  blockedReasons: string[];
  allowedMutationPath: 'publish_lifecycle_only';
}

export interface AiOptimizationRequest {
  contractVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
  mode: 'suggestion_only';
  generatedAt: string;
  requestedByUserId: string;
  requestedSuggestionKinds: AiSuggestionKind[];
  redaction: {
    classification: 'synthetic';
    appliedRules: string[];
    omittedFields: string[];
  };
  offerSnapshot: {
    offerId: string | null;
    catalogProductId: string | null;
    accountId: string | null;
    title: string;
    description: string | null;
    categoryId: string;
    price: number;
    currency: string;
    quantity: number;
    attributes: Array<{ name: string; values: string[] }>;
    imageUrls: string[];
  };
  catalogSnapshot: {
    sku: string | null;
    brand: string | null;
    categoryPath: string[];
    sellable: boolean | null;
  };
  metrics: AiOptimizationMetricSnapshot;
  policyContext: AiOptimizationPolicyContext;
}

export interface AiSuggestionResponseItem {
  suggestionId: string;
  kind: AiSuggestionKind;
  summary: string;
  proposedValue: string | string[] | Record<string, unknown>;
  confidence: number;
  expectedImpact: string;
  evidence: string[];
  policyBlockers: string[];
  rollbackNotes: string;
}

export interface AiOptimizationResponse {
  contractVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
  mode: 'suggestion_only';
  model: {
    provider: string;
    name: string;
    version: string | null;
  };
  suggestions: AiSuggestionResponseItem[];
}

export interface LocalAiSuggestionRecord {
  recordId: string;
  suggestionId: string;
  kind: AiSuggestionKind;
  reviewState: 'pending_review';
  inputSnapshotHash: string;
  approvalPath: {
    requiresHumanReview: true;
    requiresPolicyConfirmation: true;
    lifecycleAction: 'publish_lifecycle_required';
    nextAction: 'operator_review';
  };
  model: {
    provider: string;
    name: string;
    version: string | null;
  };
  suggestedValue: AiSuggestionResponseItem['proposedValue'];
  confidence: number;
  expectedImpact: string;
  evidence: string[];
  policyBlockers: string[];
  rollbackNotes: string;
  createdAt: string;
}
