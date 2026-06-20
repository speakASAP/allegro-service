import { createHash } from 'crypto';

export type AiSuggestionTarget = 'title' | 'description' | 'attributes' | 'category' | 'images' | 'price' | 'quality';
export type AiSuggestionReviewState = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type AiOfferOptimizationRequest = {
  contractVersion: 'TASK-005.v1';
  mode: 'SUGGESTION_ONLY';
  reviewState: 'DRAFT';
  marketplace: 'allegro';
  inputSnapshotHash: string;
  offerSnapshot: Record<string, unknown>;
  policySnapshot: Record<string, unknown>;
  constraints: {
    draftOnly: true;
    requiresHumanApproval: true;
    autonomousPublishAllowed: false;
    redactSensitiveData: true;
  };
  requestedOptimizations: AiSuggestionTarget[];
  promptContext: {
    objective: string;
    locale: string;
    accountId: string | null;
  };
};

export type AiOfferOptimizationSuggestion = {
  target: AiSuggestionTarget;
  proposedValue: unknown;
  reason: string;
  confidence: number;
  expectedImpact: 'low' | 'medium' | 'high';
  rollbackNote: string;
  evidence: string[];
  requiresApproval: true;
};

export type AiOfferOptimizationResponse = {
  contractVersion: 'TASK-005.v1';
  mode: 'SUGGESTION_ONLY';
  reviewState: 'DRAFT';
  suggestions: AiOfferOptimizationSuggestion[];
  policyBlockers: string[];
  reviewChecklist: string[];
  redactionReport: {
    redactedKeys: string[];
    syntheticOnly: true;
  };
};

export type AiSuggestionRecord = {
  contractVersion: 'TASK-005.v1';
  inputSnapshotHash: string;
  reviewState: 'DRAFT';
  approvedChangeSet: [];
  response: AiOfferOptimizationResponse;
};

export type BuildAiOfferOptimizationRequestInput = {
  offer: Record<string, any>;
  policyEvaluation?: Record<string, any> | null;
  requestedOptimizations?: AiSuggestionTarget[];
  promptContext?: {
    objective?: string;
    locale?: string;
  } | null;
};

const DEFAULT_TARGETS: AiSuggestionTarget[] = ['title', 'description', 'attributes', 'category', 'images', 'price', 'quality'];
const REDACTED_KEYS = new Set([
  'accesstoken',
  'access_token',
  'authorization',
  'clientsecret',
  'client_secret',
  'cookie',
  'customeremail',
  'customer_email',
  'email',
  'jwt',
  'password',
  'paymentdetails',
  'payment_details',
  'phonenumber',
  'phone_number',
  'refreshtoken',
  'refresh_token',
  'secret',
  'token',
  'userid',
  'user_id',
]);

export function buildAiOfferOptimizationRequest(input: BuildAiOfferOptimizationRequestInput): AiOfferOptimizationRequest {
  const requestedOptimizations = input.requestedOptimizations?.length ? input.requestedOptimizations : DEFAULT_TARGETS;
  const offerSnapshot = sanitizeValue({
    offerId: input.offer?.id ?? null,
    catalogProductId: input.offer?.catalogProductId ?? null,
    accountId: input.offer?.accountId ?? null,
    title: input.offer?.title ?? null,
    description: input.offer?.description ?? null,
    categoryId: input.offer?.categoryId ?? null,
    attributes: input.offer?.attributes ?? [],
    price: input.offer?.price ?? null,
    currency: input.offer?.currency ?? null,
    stockQuantity: input.offer?.stockQuantity ?? input.offer?.quantity ?? null,
    images: input.offer?.images ?? [],
    rawData: {
      catalogSnapshot: input.offer?.rawData?.catalogSnapshot ?? null,
      delivery: input.offer?.rawData?.delivery ?? input.offer?.deliveryOptions ?? null,
      payments: input.offer?.rawData?.payments ?? input.offer?.paymentOptions ?? null,
      additionalContext: input.offer?.rawData?.additionalContext ?? null,
      tokens: input.offer?.rawData?.tokens ?? null,
      customerEmail: input.offer?.rawData?.customerEmail ?? null,
      authorization: input.offer?.rawData?.authorization ?? null,
    },
  }) as Record<string, unknown>;
  const policySnapshot = sanitizeValue(buildPolicySnapshot(input.policyEvaluation)) as Record<string, unknown>;
  const promptContext = {
    objective: input.promptContext?.objective || 'Improve Allegro listing quality without autonomous marketplace mutation.',
    locale: input.promptContext?.locale || 'pl-PL',
    accountId: typeof offerSnapshot.accountId === 'string' ? offerSnapshot.accountId : null,
  };

  return {
    contractVersion: 'TASK-005.v1',
    mode: 'SUGGESTION_ONLY',
    reviewState: 'DRAFT',
    marketplace: 'allegro',
    inputSnapshotHash: hashCanonical({ offerSnapshot, policySnapshot, promptContext, requestedOptimizations }),
    offerSnapshot,
    policySnapshot,
    constraints: {
      draftOnly: true,
      requiresHumanApproval: true,
      autonomousPublishAllowed: false,
      redactSensitiveData: true,
    },
    requestedOptimizations,
    promptContext,
  };
}

export function createSyntheticAiOfferOptimizationResponse(overrides: Partial<AiOfferOptimizationResponse> = {}): AiOfferOptimizationResponse {
  const base: AiOfferOptimizationResponse = {
    contractVersion: 'TASK-005.v1',
    mode: 'SUGGESTION_ONLY',
    reviewState: 'DRAFT',
    suggestions: [
      {
        target: 'title',
        proposedValue: 'Synthetic upgraded title with brand + core attribute',
        reason: 'Improves clarity and search relevance while preserving catalog ownership.',
        confidence: 0.84,
        expectedImpact: 'medium',
        rollbackNote: 'Restore the previous approved title from the local draft history.',
        evidence: ['synthetic-keyword-gap', 'synthetic-attribute-coverage'],
        requiresApproval: true,
      },
      {
        target: 'description',
        proposedValue: 'Synthetic operator-reviewed description with bullet benefits and safe disclaimers.',
        reason: 'Adds structure and buyer reassurance without introducing unsupported claims.',
        confidence: 0.79,
        expectedImpact: 'medium',
        rollbackNote: 'Restore the previous approved description from the local draft history.',
        evidence: ['synthetic-formatting-check', 'synthetic-policy-check'],
        requiresApproval: true,
      },
    ],
    policyBlockers: [],
    reviewChecklist: [
      'Confirm every suggestion against catalog-backed facts.',
      'Approve or reject each suggestion before lifecycle mutation.',
      'Do not expose raw customer, payment, or token data to ai-microservice.',
    ],
    redactionReport: {
      redactedKeys: ['authorization', 'customerEmail', 'tokens'],
      syntheticOnly: true,
    },
  };

  return {
    ...base,
    ...overrides,
    suggestions: overrides.suggestions || base.suggestions,
    reviewChecklist: overrides.reviewChecklist || base.reviewChecklist,
    redactionReport: overrides.redactionReport || base.redactionReport,
  };
}

export function buildAiSuggestionRecord(
  request: AiOfferOptimizationRequest,
  response: AiOfferOptimizationResponse,
): AiSuggestionRecord {
  return {
    contractVersion: 'TASK-005.v1',
    inputSnapshotHash: request.inputSnapshotHash,
    reviewState: 'DRAFT',
    approvedChangeSet: [],
    response: {
      ...response,
      contractVersion: 'TASK-005.v1',
      mode: 'SUGGESTION_ONLY',
      reviewState: 'DRAFT',
      suggestions: response.suggestions.map((suggestion) => ({
        ...suggestion,
        requiresApproval: true,
      })),
    },
  };
}

function buildPolicySnapshot(policyEvaluation?: Record<string, any> | null): Record<string, unknown> {
  const results = Array.isArray(policyEvaluation?.results) ? policyEvaluation.results : [];
  return {
    version: policyEvaluation?.version || null,
    summary: policyEvaluation?.summary || {
      blockers: results.filter((entry: any) => entry?.status === 'BLOCK').length,
      warnings: results.filter((entry: any) => entry?.status === 'WARN').length,
      recommendations: results.filter((entry: any) => entry?.status === 'RECOMMEND').length,
    },
    results: results.map((entry: any) => ({
      gate: entry?.gate || null,
      status: entry?.status || null,
      ownerService: entry?.ownerService || null,
      reason: entry?.reason || null,
      remediation: entry?.remediation || null,
    })),
  };
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (REDACTED_KEYS.has(normalized)) {
      next[key] = '[REDACTED]';
      continue;
    }

    if (entry === undefined) {
      continue;
    }

    next[key] = sanitizeValue(entry);
  }

  return next;
}

function hashCanonical(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}
