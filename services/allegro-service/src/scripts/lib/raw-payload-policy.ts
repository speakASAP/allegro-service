export const RAW_PAYLOAD_RETENTION_POLICY_VERSION = 'raw-payload-retention-v1';
export const RAW_PAYLOAD_REDACTION_VERSION = 'v1';

export type RawPayloadPiiClass =
  | 'sensitive_order_payload'
  | 'offer_stock_payload'
  | 'offer_catalog_payload'
  | 'category_parameter_payload'
  | 'unknown_payload';

type RawPayloadPolicy = {
  piiClass: RawPayloadPiiClass;
  retentionDays: number;
  accessScope: string;
  deletionMode: string;
  rationale: string;
};

export const RAW_PAYLOAD_POLICIES: Record<RawPayloadPiiClass, RawPayloadPolicy> = {
  sensitive_order_payload: {
    piiClass: 'sensitive_order_payload',
    retentionDays: 90,
    accessScope: 'trusted_order_debug_and_replay_only',
    deletionMode: 'manual_or_owner_approved_maintenance_job',
    rationale: 'Checkout forms can contain buyer, delivery, invoice, and payment-context data.',
  },
  offer_stock_payload: {
    piiClass: 'offer_stock_payload',
    retentionDays: 180,
    accessScope: 'trusted_offer_stock_reconciliation',
    deletionMode: 'manual_or_owner_approved_maintenance_job',
    rationale: 'Offer stock payloads are lower-PII but still channel operational evidence.',
  },
  offer_catalog_payload: {
    piiClass: 'offer_catalog_payload',
    retentionDays: 180,
    accessScope: 'trusted_offer_catalog_replay',
    deletionMode: 'manual_or_owner_approved_maintenance_job',
    rationale: 'Offer and product payloads are needed for export/import replay and mapping audits.',
  },
  category_parameter_payload: {
    piiClass: 'category_parameter_payload',
    retentionDays: 365,
    accessScope: 'category_parameter_validation_cache',
    deletionMode: 'manual_or_owner_approved_maintenance_job',
    rationale: 'Category and parameter metadata is public-ish marketplace metadata and changes slowly.',
  },
  unknown_payload: {
    piiClass: 'unknown_payload',
    retentionDays: 30,
    accessScope: 'quarantine_until_classified',
    deletionMode: 'manual_or_owner_approved_maintenance_job',
    rationale: 'Unknown payload classes must be short-lived until classified.',
  },
};

export function policyForPiiClass(piiClass: string | null | undefined): RawPayloadPolicy {
  if (piiClass && Object.prototype.hasOwnProperty.call(RAW_PAYLOAD_POLICIES, piiClass)) {
    return RAW_PAYLOAD_POLICIES[piiClass as RawPayloadPiiClass];
  }
  return RAW_PAYLOAD_POLICIES.unknown_payload;
}

export function retentionCutoffForPiiClass(piiClass: string | null | undefined, now = new Date()): Date {
  const policy = policyForPiiClass(piiClass);
  return new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
}

export function retentionExpiresAt(piiClass: string | null | undefined, receivedAt: Date): Date {
  const policy = policyForPiiClass(piiClass);
  return new Date(receivedAt.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000);
}

export function buildRawPayloadPolicySnapshot(): Record<string, unknown> {
  return {
    version: RAW_PAYLOAD_RETENTION_POLICY_VERSION,
    redactionVersion: RAW_PAYLOAD_REDACTION_VERSION,
    deletionMode: 'report_only_until_owner_approved_cleanup_job',
    policies: RAW_PAYLOAD_POLICIES,
  };
}
