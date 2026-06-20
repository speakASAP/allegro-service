import { createHash } from 'crypto';

export const AI_OFFER_OPTIMIZATION_CONTRACT_VERSION = 'TASK-005.v1' as const;

export type AiOfferOptimizationFocusArea =
  | 'title'
  | 'description'
  | 'attributes'
  | 'category'
  | 'images'
  | 'price'
  | 'quality';

export type AiOfferOptimizationReviewState =
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLIED'
  | 'EXPIRED';

export type AiSuggestionStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export type AiListingAttribute = {
  name: string;
  values: string[];
};

export type AiOfferListingSnapshot = {
  catalogProductId: string;
  offerId: string | null;
  accountId: string | null;
  title: string;
  description: string | null;
  categoryId: string | null;
  images: string[];
  price: {
    amount: number;
    currency: string;
  };
  quantity: number;
  attributes: AiListingAttribute[];
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

export type AiOfferOptimizationRequest = {
  contractVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
  sourceService: 'allegro-service';
  correlationId: string;
  advisoryOnly: true;
  requiresHumanReview: true;
  lifecycleActionOnApproval: 'UPDATE';
  snapshotHash: string;
  requestedAt: string;
  listingSnapshot: AiOfferListingSnapshot;
  redaction: {
    strategy: 'TASK-005.v1';
    maskedFields: string[];
  };
  constraints: {
    allowAutonomousPublish: false;
    allowDirectMarketplaceMutation: false;
    allowUnreviewedPriceChange: false;
  };
};

export type AiOfferOptimizationSuggestion = {
  id: string;
  focusArea: AiOfferOptimizationFocusArea;
  confidence: number;
  summary: string;
  rationale: string;
  proposedValue: string | number | string[] | Record<string, unknown>;
  policyBlockers: string[];
  rollbackNotes: string;
};

export type AiOfferOptimizationResponse = {
  contractVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
  correlationId: string;
  model: {
    provider: string;
    model: string;
    modelVersion: string | null;
  };
  suggestions: AiOfferOptimizationSuggestion[];
};

export type AiSuggestionRecord = {
  recordVersion: typeof AI_OFFER_OPTIMIZATION_CONTRACT_VERSION;
  correlationId: string;
  snapshotHash: string;
  reviewState: AiOfferOptimizationReviewState;
  approvalRequired: true;
  offerId: string | null;
  catalogProductId: string;
  accountId: string | null;
  requestedAt: string;
  model: AiOfferOptimizationResponse['model'];
  suggestions: Array<AiOfferOptimizationSuggestion & { status: AiSuggestionStatus }>;
  approvedSuggestionIds: string[];
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
      attributes?: AiListingAttribute[];
    };
  };
  reviewState: 'APPROVED';
  reviewedByUserId: string;
};

export type BuildAiOfferOptimizationRequestInput = {
  correlationId: string;
  requestedAt?: string;
  listingSnapshot: Omit<AiOfferListingSnapshot, 'description' | 'title'> & {
    title: string;
    description: string | null;
  };
};

const TOKEN_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED_TOKEN]'],
  [/\b(api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED_SECRET]'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]'],
];

export function buildAiOfferOptimizationRequest(input: BuildAiOfferOptimizationRequestInput): AiOfferOptimizationRequest {
  const sanitizedSnapshot: AiOfferListingSnapshot = {
    ...input.listingSnapshot,
    title: redactFreeText(input.listingSnapshot.title),
    description: redactNullableText(input.listingSnapshot.description),
    attributes: input.listingSnapshot.attributes.map((attribute) => ({
      name: redactFreeText(attribute.name),
      values: attribute.values.map((value) => redactFreeText(value)),
    })),
  };
  const snapshotHash = hashValue(sanitizedSnapshot);

  return {
    contractVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
    sourceService: 'allegro-service',
    correlationId: input.correlationId,
    advisoryOnly: true,
    requiresHumanReview: true,
    lifecycleActionOnApproval: 'UPDATE',
    snapshotHash,
    requestedAt: input.requestedAt || new Date().toISOString(),
    listingSnapshot: sanitizedSnapshot,
    redaction: {
      strategy: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
      maskedFields: ['title', 'description', 'attributes[].name', 'attributes[].values[]'],
    },
    constraints: {
      allowAutonomousPublish: false,
      allowDirectMarketplaceMutation: false,
      allowUnreviewedPriceChange: false,
    },
  };
}

export function buildAiSuggestionRecord(
  request: AiOfferOptimizationRequest,
  response: AiOfferOptimizationResponse,
): AiSuggestionRecord {
  return {
    recordVersion: AI_OFFER_OPTIMIZATION_CONTRACT_VERSION,
    correlationId: response.correlationId,
    snapshotHash: request.snapshotHash,
    reviewState: 'NEEDS_REVIEW',
    approvalRequired: true,
    offerId: request.listingSnapshot.offerId,
    catalogProductId: request.listingSnapshot.catalogProductId,
    accountId: request.listingSnapshot.accountId,
    requestedAt: request.requestedAt,
    model: response.model,
    suggestions: response.suggestions.map((suggestion) => ({
      ...suggestion,
      status: 'DRAFT',
    })),
    approvedSuggestionIds: [],
  };
}

export function buildApprovedSuggestionPatch(
  record: AiSuggestionRecord,
  approvedSuggestionIds: string[],
  reviewedByUserId: string,
): ApprovedSuggestionPatch {
  if (!record.offerId) {
    throw new Error('offerId is required before approved AI suggestions can enter lifecycle-gated updates');
  }

  const approvedSuggestions = record.suggestions.filter((suggestion) => approvedSuggestionIds.includes(suggestion.id));
  if (approvedSuggestions.length === 0) {
    throw new Error('at least one approved suggestion is required');
  }

  const changes: ApprovedSuggestionPatch['lifecycleInput']['changes'] = {};
  for (const suggestion of approvedSuggestions) {
    if (suggestion.focusArea === 'title' && typeof suggestion.proposedValue === 'string') changes.title = suggestion.proposedValue;
    if (suggestion.focusArea === 'description' && typeof suggestion.proposedValue === 'string') changes.description = suggestion.proposedValue;
    if (suggestion.focusArea === 'category' && typeof suggestion.proposedValue === 'string') changes.categoryId = suggestion.proposedValue;
    if (suggestion.focusArea === 'price' && typeof suggestion.proposedValue === 'number') changes.price = suggestion.proposedValue;
    if (suggestion.focusArea === 'images' && Array.isArray(suggestion.proposedValue)) changes.images = suggestion.proposedValue as string[];
    if (suggestion.focusArea === 'attributes' && isAttributeArray(suggestion.proposedValue)) changes.attributes = suggestion.proposedValue;
  }

  return {
    lifecycleInput: {
      action: 'UPDATE',
      offerId: record.offerId,
      accountId: record.accountId,
      requiresConfirmation: true,
      source: 'TASK-005',
      suggestionRecordVersion: record.recordVersion,
      approvedSuggestionIds,
      changes,
    },
    reviewState: 'APPROVED',
    reviewedByUserId,
  };
}

function redactNullableText(value: string | null): string | null {
  return value === null ? null : redactFreeText(value);
}

function redactFreeText(value: string): string {
  return TOKEN_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isAttributeArray(value: unknown): value is AiListingAttribute[] {
  return Array.isArray(value) && value.every((entry) => typeof entry?.name === 'string' && Array.isArray(entry?.values));
}
