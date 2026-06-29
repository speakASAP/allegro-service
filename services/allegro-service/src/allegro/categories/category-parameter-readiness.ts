export type CategoryParameterRequirement = {
  id?: string;
  parameterId?: string;
  name?: string;
  required?: boolean;
  requiredForProduct?: boolean;
  restrictions?: {
    required?: boolean;
    multipleChoices?: boolean;
    range?: boolean;
  };
};

export type DraftParameterValue = {
  id?: string;
  parameterId?: string;
  name?: string;
  values?: unknown[];
  valuesIds?: unknown[];
  rangeValue?: unknown;
};

export type CategoryParameterReadinessResult = {
  status: 'ready' | 'blocked';
  categoryId: string | null;
  requiredCount: number;
  providedRequiredCount: number;
  missingRequired: Array<{ parameterId: string; name: string | null; reason: string }>;
  warnings: string[];
  evidence: {
    source: string;
    liveAllegroCallRequired: boolean;
    categoryParametersEndpointReady: boolean;
  };
};

export function evaluateCategoryParameterReadiness(input: {
  categoryId?: string | null;
  categoryParametersPayload?: any;
  draftParameters?: DraftParameterValue[];
}): CategoryParameterReadinessResult {
  const categoryId = input.categoryId || null;
  const requirements = normalizeRequirements(input.categoryParametersPayload);
  const required = requirements.filter(isRequiredParameter);
  const draftById = new Map<string, DraftParameterValue>();

  for (const parameter of input.draftParameters || []) {
    const parameterId = parameterKey(parameter);
    if (parameterId) draftById.set(parameterId, parameter);
  }

  const missingRequired = required
    .map((requirement) => {
      const parameterId = parameterKey(requirement) || '[UNKNOWN]';
      const provided = draftById.get(parameterId);
      if (hasParameterValue(provided)) return null;
      return {
        parameterId,
        name: requirement.name || null,
        reason: '[MISSING: required Allegro category parameter value]',
      };
    })
    .filter(Boolean) as Array<{ parameterId: string; name: string | null; reason: string }>;

  const warnings: string[] = [];
  if (!categoryId) warnings.push('[MISSING: category id]');
  if (!input.categoryParametersPayload) warnings.push('[MISSING: category parameter payload]');
  if (requirements.length === 0) warnings.push('[MISSING: category parameter requirements]');

  return {
    status: missingRequired.length === 0 && categoryId && requirements.length > 0 ? 'ready' : 'blocked',
    categoryId,
    requiredCount: required.length,
    providedRequiredCount: Math.max(0, required.length - missingRequired.length),
    missingRequired,
    warnings,
    evidence: {
      source: 'offline-category-parameter-readiness.v1',
      liveAllegroCallRequired: false,
      categoryParametersEndpointReady: true,
    },
  };
}

function normalizeRequirements(payload: any): CategoryParameterRequirement[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.parameters)) return payload.parameters;
  return [];
}

function isRequiredParameter(parameter: CategoryParameterRequirement): boolean {
  return Boolean(parameter.required || parameter.requiredForProduct || parameter.restrictions?.required);
}

function parameterKey(parameter: CategoryParameterRequirement | DraftParameterValue | undefined): string | null {
  const value = parameter?.id || parameter?.parameterId;
  return value ? String(value) : null;
}

function hasParameterValue(parameter: DraftParameterValue | undefined): boolean {
  if (!parameter) return false;
  if (Array.isArray(parameter.values) && parameter.values.length > 0) return true;
  if (Array.isArray(parameter.valuesIds) && parameter.valuesIds.length > 0) return true;
  if (parameter.rangeValue && typeof parameter.rangeValue === 'object') return Object.keys(parameter.rangeValue).length > 0;
  return parameter.rangeValue !== null && parameter.rangeValue !== undefined && parameter.rangeValue !== '';
}
