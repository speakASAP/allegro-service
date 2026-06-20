import { createHash } from 'crypto';

export const AI_OFFER_OPTIMIZATION_CONTRACT_VERSION = 'TASK-005.v1' as const;
export const AI_SUGGESTION_KINDS = [
  'title-rewrite',
  'description-rewrite',
  'attribute-completion',
  'category-review',
  'image-upgrade',
  'price-test',
  'quality-risk',
] as const;

export type AiSuggestionKind = (typeof AI_SUGGESTION_KINDS)[number];

export type AiOptimizationRequest = {
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
  metrics: {
    views7d: number | null;
    clicks7d: number | null;
    conversions7d: number | null;
    addToCart7d: number | null;
    returnRate30d: number | null;
  };
  policyContext: {
    requiresHumanReview: true;
    requiresPolicyConfirmation: true;
    blockedReasons: string[];
    allowedMutationPath: 'publish_lifecycle_only';
  };
  snapshotHash: string;
};

export type AiOptimizationResponse = {
  contractVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
  mode: 'suggestion_only';
  model: {
    provider: string;
    name: string;
    version: string | null;
  };
  suggestions: Array<{
    suggestionId: string;
    kind: AiSuggestionKind;
    summary: string;
    proposedValue: unknown;
    confidence: number;
    expectedImpact: string;
    evidence: string[];
    policyBlockers: string[];
    rollbackNotes: string;
  }>;
};

export type LocalAiSuggestionRecord = {
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
  offerId: string | null;
  accountId: string | null;
  model: AiOptimizationResponse['model'];
  suggestedValue: unknown;
  confidence: number;
  expectedImpact: string;
  evidence: string[];
  policyBlockers: string[];
  rollbackNotes: string;
  createdAt: string;
};

export type ApprovedSuggestionPatch = {
  lifecycleInput: {
    action: 'UPDATE';
    offerId: string;
    accountId: string | null;
    requiresConfirmation: true;
    source: 'TASK-005';
    suggestionRecordVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
    approvedSuggestionIds: string[];
    changes: {
      title?: string;
      description?: string;
      categoryId?: string;
      price?: number;
      images?: string[];
      attributes?: Array<{ name: string; values: string[] }>;
    };
  };
  reviewState: 'APPROVED';
  reviewedByUserId: string;
};

type LegacyDraftOfferOptimizationInput = {
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
};

type SnapshotInput = {
  correlationId: string;
  requestedAt?: string;
  listingSnapshot: {
    catalogProductId: string;
    offerId: string | null;
    accountId: string | null;
    title: string;
    description: string | null;
    categoryId: string | null;
    images: string[];
    price: { amount: number; currency: string };
    quantity: number;
    attributes: Array<{ name: string; values: string[] }>;
    publicationStatus: string | null;
    product: {
      sku: string | null;
      brand: string | null;
      isAiCoCreated: boolean;
    };
    policySummary: {
      blockers: string[];
      warnings: string[];
      recommendations: string[];
    };
  };
};

type BuildAiOfferOptimizationRequestInput = LegacyDraftOfferOptimizationInput | SnapshotInput;

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
const TOKEN_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED_TOKEN]'],
  [/\b(api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED_SECRET]'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]'],
];

export function buildAiOfferOptimizationRequest(input: BuildAiOfferOptimizationRequestInput): AiOptimizationRequest {
  if ('listingSnapshot' in input) {
    return fromSnapshotInput(input);
  }
  return fromLegacyInput(input);
}

export function buildAiSuggestionRecord(
  request: AiOptimizationRequest,
  response: AiOptimizationResponse,
): LocalAiSuggestionRecord {
  validateResponseContract(response);
  const suggestion = response.suggestions[0];
  if (!suggestion) throw new Error('At least one suggestion is required');

  return {
    recordId: createRecordId(request.snapshotHash, 0),
    suggestionId: suggestion.suggestionId,
    kind: suggestion.kind,
    reviewState: 'pending_review',
    inputSnapshotHash: request.snapshotHash,
    approvalPath: {
      requiresHumanReview: true,
      requiresPolicyConfirmation: true,
      lifecycleAction: 'publish_lifecycle_required',
      nextAction: 'operator_review',
    },
    offerId: request.offerSnapshot.offerId,
    accountId: request.offerSnapshot.accountId,
    model: response.model,
    suggestedValue: suggestion.proposedValue,
    confidence: suggestion.confidence,
    expectedImpact: suggestion.expectedImpact,
    evidence: [...suggestion.evidence],
    policyBlockers: [...suggestion.policyBlockers],
    rollbackNotes: suggestion.rollbackNotes,
    createdAt: new Date().toISOString(),
  };
}

export function createSyntheticAiOfferOptimizationResponse(
  overrides: Partial<AiOptimizationResponse> & { suggestions?: AiOptimizationResponse['suggestions'] } = {},
): AiOptimizationResponse {
  return {
    contractVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
    mode: 'suggestion_only',
    model: {
      provider: 'openai',
      name: 'gpt-5',
      version: '2026-06-01',
      ...(overrides.model || {}),
    },
    suggestions: overrides.suggestions || [
      {
        suggestionId: 's-1',
        kind: 'title-rewrite',
        summary: 'Lead with the strongest buyer keyword.',
        proposedValue: { title: 'Synthetic optimized title' },
        confidence: 0.81,
        expectedImpact: 'Can improve click-through rate.',
        evidence: ['Synthetic listing CTR fixture.'],
        policyBlockers: [],
        rollbackNotes: 'Restore the previous title if CTR falls.',
      },
    ],
    ...overrides,
  };
}

export function buildApprovedSuggestionPatch(
  record: LocalAiSuggestionRecord,
  approvedSuggestionIds: string[],
  reviewedByUserId: string,
): ApprovedSuggestionPatch {
  if (!record.offerId) {
    throw new Error('offerId is required before approved AI suggestions can enter lifecycle-gated updates');
  }
  if (!approvedSuggestionIds.includes(record.suggestionId)) {
    throw new Error('the supplied suggestion record is not approved');
  }

  const changes: ApprovedSuggestionPatch['lifecycleInput']['changes'] = {};
  if (record.kind === 'title-rewrite' && isRecord(record.suggestedValue) && typeof record.suggestedValue.title === 'string') {
    changes.title = record.suggestedValue.title;
  }
  if (record.kind === 'description-rewrite' && isRecord(record.suggestedValue) && typeof record.suggestedValue.description === 'string') {
    changes.description = record.suggestedValue.description;
  }
  if (record.kind === 'category-review' && isRecord(record.suggestedValue) && typeof record.suggestedValue.categoryId === 'string') {
    changes.categoryId = record.suggestedValue.categoryId;
  }
  if (record.kind === 'price-test' && isRecord(record.suggestedValue) && typeof record.suggestedValue.price === 'number') {
    changes.price = record.suggestedValue.price;
  }
  if (record.kind === 'image-upgrade' && isRecord(record.suggestedValue) && Array.isArray(record.suggestedValue.images)) {
    changes.images = record.suggestedValue.images as string[];
  }
  if (record.kind === 'attribute-completion' && isRecord(record.suggestedValue) && Array.isArray(record.suggestedValue.attributes)) {
    changes.attributes = record.suggestedValue.attributes as Array<{ name: string; values: string[] }>;
  }

  return {
    lifecycleInput: {
      action: 'UPDATE',
      offerId: record.offerId,
      accountId: record.accountId,
      requiresConfirmation: true,
      source: 'TASK-005',
      suggestionRecordVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
      approvedSuggestionIds,
      changes,
    },
    reviewState: 'APPROVED',
    reviewedByUserId,
  };
}

function fromLegacyInput(input: LegacyDraftOfferOptimizationInput): AiOptimizationRequest {
  const requestedKinds = resolveSuggestionKinds(input.requestedSuggestionKinds);
  const request: AiOptimizationRequest = {
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
      title: redactFreeText(input.offer.title),
      description: redactNullableText(input.offer.description || null),
      categoryId: input.offer.categoryId,
      price: Number(input.offer.price),
      currency: input.offer.currency || 'PLN',
      quantity: toNonNegativeInteger(input.offer.quantity),
      attributes: Array.isArray(input.offer.attributes)
        ? input.offer.attributes.map((attribute) => ({
            name: redactFreeText(attribute.name),
            values: attribute.values.map((value) => redactFreeText(value)),
          }))
        : [],
      imageUrls: Array.isArray(input.offer.imageUrls) ? input.offer.imageUrls.slice(0, 8) : [],
    },
    catalogSnapshot: {
      sku: input.catalog?.sku || null,
      brand: input.catalog?.brand || null,
      categoryPath: Array.isArray(input.catalog?.categoryPath) ? [...input.catalog.categoryPath] : [],
      sellable: typeof input.catalog?.sellable === 'boolean' ? input.catalog.sellable : null,
    },
    metrics: {
      views7d: toMetric(input.metrics?.views7d),
      clicks7d: toMetric(input.metrics?.clicks7d),
      conversions7d: toMetric(input.metrics?.conversions7d),
      addToCart7d: toMetric(input.metrics?.addToCart7d),
      returnRate30d: toMetric(input.metrics?.returnRate30d),
    },
    policyContext: {
      requiresHumanReview: true,
      requiresPolicyConfirmation: true,
      blockedReasons: [...(input.blockedReasons || [])],
      allowedMutationPath: 'publish_lifecycle_only',
    },
    snapshotHash: '',
  };
  request.snapshotHash = hashSnapshot(request);
  return request;
}

function fromSnapshotInput(input: SnapshotInput): AiOptimizationRequest {
  const request: AiOptimizationRequest = {
    contractVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
    mode: 'suggestion_only',
    generatedAt: input.requestedAt || new Date().toISOString(),
    requestedByUserId: input.correlationId,
    requestedSuggestionKinds: [...AI_SUGGESTION_KINDS],
    redaction: {
      classification: 'synthetic',
      appliedRules: [...REDACTION_RULES],
      omittedFields: [...OMITTED_FIELDS],
    },
    offerSnapshot: {
      offerId: input.listingSnapshot.offerId,
      catalogProductId: input.listingSnapshot.catalogProductId,
      accountId: input.listingSnapshot.accountId,
      title: redactFreeText(input.listingSnapshot.title),
      description: redactNullableText(input.listingSnapshot.description),
      categoryId: input.listingSnapshot.categoryId || 'UNASSIGNED',
      price: Number(input.listingSnapshot.price.amount),
      currency: input.listingSnapshot.price.currency,
      quantity: toNonNegativeInteger(input.listingSnapshot.quantity),
      attributes: input.listingSnapshot.attributes.map((attribute) => ({
        name: redactFreeText(attribute.name),
        values: attribute.values.map((value) => redactFreeText(value)),
      })),
      imageUrls: input.listingSnapshot.images.slice(0, 8),
    },
    catalogSnapshot: {
      sku: input.listingSnapshot.product.sku,
      brand: input.listingSnapshot.product.brand,
      categoryPath: [],
      sellable: true,
    },
    metrics: {
      views7d: null,
      clicks7d: null,
      conversions7d: null,
      addToCart7d: null,
      returnRate30d: null,
    },
    policyContext: {
      requiresHumanReview: true,
      requiresPolicyConfirmation: true,
      blockedReasons: [...input.listingSnapshot.policySummary.blockers],
      allowedMutationPath: 'publish_lifecycle_only',
    },
    snapshotHash: '',
  };
  request.snapshotHash = hashSnapshot(request);
  return request;
}

function validateResponseContract(response: AiOptimizationResponse): void {
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
  }
}

function resolveSuggestionKinds(kinds?: AiSuggestionKind[]): AiSuggestionKind[] {
  if (!Array.isArray(kinds) || kinds.length === 0) return [...AI_SUGGESTION_KINDS];
  return kinds.filter((kind, index) => AI_SUGGESTION_KINDS.includes(kind) && kinds.indexOf(kind) === index);
}

function hashSnapshot(request: Omit<AiOptimizationRequest, 'snapshotHash'> | AiOptimizationRequest): string {
  const clone = { ...request } as Record<string, unknown>;
  delete clone.snapshotHash;
  return createHash('sha256').update(JSON.stringify(clone)).digest('hex');
}

function createRecordId(snapshotHash: string, index: number): string {
  return `ai-suggestion-${snapshotHash.slice(0, 12)}-${index + 1}`;
}

function redactNullableText(value: string | null): string | null {
  return value === null ? null : redactFreeText(value);
}

function redactFreeText(value: string): string {
  return TOKEN_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function toMetric(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? Number(value) : null;
}

function toNonNegativeInteger(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(Number(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
