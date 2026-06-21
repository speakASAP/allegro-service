import { createHash } from 'crypto';

export const STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION = 'TASK-006.v1' as const;

export type ContractDecision = 'PASS' | 'WARNING' | 'UNKNOWN' | 'BLOCKED';

export type StockSyncAttemptInput = {
  correlationId: string;
  observedAt: string;
  catalogProductId: string;
  offerId: string;
  accountId: string;
  warehouseAvailable: number;
  allegroAvailable: number;
  reservedQuantity?: number | null;
  driftThreshold?: number | null;
  stockOutPolicy?: 'set_zero_after_confirmation' | 'manual_review';
};

export type StockSyncAttemptContract = {
  contractVersion: typeof STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION;
  source: 'warehouse-microservice';
  target: 'allegro-service';
  mode: 'durable_attempt_required';
  idempotencyKey: string;
  correlationId: string;
  accountRateLimit: {
    accountId: string;
    maxOneRequestPerSecond: true;
  };
  stock: {
    catalogProductId: string;
    offerId: string;
    warehouseAvailable: number;
    allegroAvailable: number;
    reservedQuantity: number;
    targetAllegroAvailable: number;
    driftQuantity: number;
    driftThreshold: number;
  };
  decision: ContractDecision;
  nextAction: 'persist_attempt' | 'skip_no_drift' | 'manual_review';
  terminalStates: Array<'SUCCEEDED' | 'FAILED' | 'STALE' | 'CANCELLED'>;
};

export type OrderForwardingInput = {
  correlationId: string;
  allegroOrderId: string;
  channelAccountId: string | null;
  centralOrderId?: string | null;
  lastForwardStatus?: 'never_forwarded' | 'accepted' | 'conflict' | 'failed' | null;
  duplicateResponse?: 'accepted_same_payload' | 'conflict_different_payload' | 'unknown' | null;
};

export type OrderForwardingContract = {
  contractVersion: typeof STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION;
  ownerService: 'orders-microservice';
  identity: {
    channel: 'allegro';
    channelAccountId: string;
    externalOrderId: string;
  };
  idempotencyKey: string;
  decision: ContractDecision;
  nextAction: 'forward_order' | 'mark_forwarded' | 'reconcile' | 'manual_review';
  failureTaxonomy: Array<'duplicate_conflict' | 'transport_error' | 'payload_rejected' | 'missing_offer' | 'unknown'>;
  retryPolicy: {
    replaySafe: true;
    requiresPayloadEqualityCheck: true;
  };
};

export type PaymentReadOnlyContract = {
  contractVersion: typeof STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION;
  ownerService: 'payments-microservice';
  mode: 'read_only';
  lookupKey: {
    channel: 'allegro';
    externalOrderId: string;
    channelAccountId: string;
  };
  allowedOperations: Array<'read_status' | 'read_settlement' | 'read_fees'>;
  forbiddenOperations: Array<'capture' | 'refund' | 'payout' | 'settlement_write'>;
  freshness: {
    observedAt: string;
    maxAgeSeconds: number;
  };
};

export type SupplierDryRunContract = {
  contractVersion: typeof STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION;
  ownerService: 'suppliers-microservice';
  mode: 'dry_run_only';
  lookupKey: {
    catalogProductId: string;
    supplierId: string;
    supplierCode: string;
  };
  allowedOperations: Array<'read_availability' | 'read_cost' | 'read_lead_time' | 'simulate_reservation'>;
  forbiddenOperations: Array<'place_order' | 'reserve_stock' | 'decrement_stock' | 'supplier_write'>;
  resultState: 'available' | 'unavailable' | 'unknown';
};

export type MarginCoverageInput = {
  revenue: { amount: number; currency: string };
  supplierCost?: { amount: number; currency: string } | null;
  shippingCost?: { amount: number; currency: string } | null;
  paymentFee?: { amount: number; currency: string } | null;
  allegroFee?: { amount: number; currency: string } | null;
  taxAmount?: { amount: number; currency: string } | null;
  fxRateToRevenueCurrency?: number | null;
  marginFloorRate: number;
};

export type MarginCoverageContract = {
  contractVersion: typeof STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION;
  calculationMode: 'coverage_based';
  decision: ContractDecision;
  missingInputs: string[];
  revenueCurrency: string;
  marginAmount: number | null;
  marginRate: number | null;
  marginFloorRate: number;
  nextAction: 'allow_profit_signal' | 'margin_warning' | 'collect_missing_inputs';
};

export function buildStockSyncAttempt(input: StockSyncAttemptInput): StockSyncAttemptContract {
  const reservedQuantity = normalizeQuantity(input.reservedQuantity ?? 0);
  const warehouseAvailable = normalizeQuantity(input.warehouseAvailable);
  const allegroAvailable = normalizeQuantity(input.allegroAvailable);
  const targetAllegroAvailable = Math.max(warehouseAvailable - reservedQuantity, 0);
  const driftQuantity = targetAllegroAvailable - allegroAvailable;
  const driftThreshold = normalizeQuantity(input.driftThreshold ?? 0);
  const stockOutPolicy = input.stockOutPolicy ?? 'manual_review';
  const hasMaterialDrift = Math.abs(driftQuantity) > driftThreshold;
  const requiresManualReview = targetAllegroAvailable === 0 && stockOutPolicy === 'manual_review';

  return {
    contractVersion: STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
    source: 'warehouse-microservice',
    target: 'allegro-service',
    mode: 'durable_attempt_required',
    idempotencyKey: stableKey('stock-sync', input.accountId, input.offerId, input.catalogProductId, targetAllegroAvailable),
    correlationId: input.correlationId,
    accountRateLimit: {
      accountId: input.accountId,
      maxOneRequestPerSecond: true,
    },
    stock: {
      catalogProductId: input.catalogProductId,
      offerId: input.offerId,
      warehouseAvailable,
      allegroAvailable,
      reservedQuantity,
      targetAllegroAvailable,
      driftQuantity,
      driftThreshold,
    },
    decision: !hasMaterialDrift ? 'PASS' : requiresManualReview ? 'BLOCKED' : 'WARNING',
    nextAction: !hasMaterialDrift ? 'skip_no_drift' : requiresManualReview ? 'manual_review' : 'persist_attempt',
    terminalStates: ['SUCCEEDED', 'FAILED', 'STALE', 'CANCELLED'],
  };
}

export function classifyOrderForwarding(input: OrderForwardingInput): OrderForwardingContract {
  const channelAccountId = input.channelAccountId?.trim() || 'default';
  const duplicateResponse = input.duplicateResponse ?? 'unknown';
  const lastForwardStatus = input.lastForwardStatus ?? 'never_forwarded';
  let decision: ContractDecision = 'PASS';
  let nextAction: OrderForwardingContract['nextAction'] = 'forward_order';
  const failureTaxonomy: OrderForwardingContract['failureTaxonomy'] = [];

  if (lastForwardStatus === 'accepted' || duplicateResponse === 'accepted_same_payload') {
    nextAction = 'mark_forwarded';
  } else if (lastForwardStatus === 'conflict' || duplicateResponse === 'conflict_different_payload') {
    decision = 'BLOCKED';
    nextAction = 'manual_review';
    failureTaxonomy.push('duplicate_conflict');
  } else if (lastForwardStatus === 'failed') {
    decision = 'WARNING';
    nextAction = 'reconcile';
    failureTaxonomy.push('transport_error');
  }

  if (failureTaxonomy.length === 0) failureTaxonomy.push('unknown');

  return {
    contractVersion: STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
    ownerService: 'orders-microservice',
    identity: {
      channel: 'allegro',
      channelAccountId,
      externalOrderId: input.allegroOrderId,
    },
    idempotencyKey: stableKey('order-forward', channelAccountId, input.allegroOrderId),
    decision,
    nextAction,
    failureTaxonomy,
    retryPolicy: {
      replaySafe: true,
      requiresPayloadEqualityCheck: true,
    },
  };
}

export function buildPaymentReadOnlyContract(input: {
  externalOrderId: string;
  channelAccountId?: string | null;
  observedAt: string;
  maxAgeSeconds?: number | null;
}): PaymentReadOnlyContract {
  return {
    contractVersion: STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
    ownerService: 'payments-microservice',
    mode: 'read_only',
    lookupKey: {
      channel: 'allegro',
      externalOrderId: input.externalOrderId,
      channelAccountId: input.channelAccountId?.trim() || 'default',
    },
    allowedOperations: ['read_status', 'read_settlement', 'read_fees'],
    forbiddenOperations: ['capture', 'refund', 'payout', 'settlement_write'],
    freshness: {
      observedAt: input.observedAt,
      maxAgeSeconds: normalizeQuantity(input.maxAgeSeconds ?? 900),
    },
  };
}

export function buildSupplierDryRunContract(input: {
  catalogProductId: string;
  supplierId: string;
  supplierCode: string;
  availableQuantity?: number | null;
}): SupplierDryRunContract {
  const availableQuantity = input.availableQuantity ?? null;
  return {
    contractVersion: STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
    ownerService: 'suppliers-microservice',
    mode: 'dry_run_only',
    lookupKey: {
      catalogProductId: input.catalogProductId,
      supplierId: input.supplierId,
      supplierCode: input.supplierCode,
    },
    allowedOperations: ['read_availability', 'read_cost', 'read_lead_time', 'simulate_reservation'],
    forbiddenOperations: ['place_order', 'reserve_stock', 'decrement_stock', 'supplier_write'],
    resultState: availableQuantity == null ? 'unknown' : availableQuantity > 0 ? 'available' : 'unavailable',
  };
}

export function computeMarginCoverage(input: MarginCoverageInput): MarginCoverageContract {
  const missingInputs = collectMissingMarginInputs(input);
  const revenueCurrency = input.revenue.currency;
  if (missingInputs.length > 0) {
    return {
      contractVersion: STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
      calculationMode: 'coverage_based',
      decision: 'UNKNOWN',
      missingInputs,
      revenueCurrency,
      marginAmount: null,
      marginRate: null,
      marginFloorRate: input.marginFloorRate,
      nextAction: 'collect_missing_inputs',
    };
  }

  const costs = [
    input.supplierCost!,
    input.shippingCost!,
    input.paymentFee!,
    input.allegroFee!,
    input.taxAmount ?? { amount: 0, currency: revenueCurrency },
  ].map((money) => convertToRevenueCurrency(money.amount, money.currency, revenueCurrency, input.fxRateToRevenueCurrency));
  const marginAmount = roundMoney(input.revenue.amount - costs.reduce((sum, amount) => sum + amount, 0));
  const marginRate = input.revenue.amount > 0 ? roundRate(marginAmount / input.revenue.amount) : 0;
  const warning = marginRate < input.marginFloorRate;

  return {
    contractVersion: STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
    calculationMode: 'coverage_based',
    decision: warning ? 'WARNING' : 'PASS',
    missingInputs: [],
    revenueCurrency,
    marginAmount,
    marginRate,
    marginFloorRate: input.marginFloorRate,
    nextAction: warning ? 'margin_warning' : 'allow_profit_signal',
  };
}

function collectMissingMarginInputs(input: MarginCoverageInput): string[] {
  const missing: string[] = [];
  for (const [name, value] of [
    ['supplierCost', input.supplierCost],
    ['shippingCost', input.shippingCost],
    ['paymentFee', input.paymentFee],
    ['allegroFee', input.allegroFee],
  ] as const) {
    if (!value || !Number.isFinite(value.amount)) missing.push(name);
  }
  const currencies = [input.supplierCost, input.shippingCost, input.paymentFee, input.allegroFee, input.taxAmount]
    .filter(Boolean)
    .map((money) => money!.currency);
  if (currencies.some((currency) => currency !== input.revenue.currency) && !input.fxRateToRevenueCurrency) {
    missing.push('fxRateToRevenueCurrency');
  }
  if (!Number.isFinite(input.marginFloorRate)) missing.push('marginFloorRate');
  return missing;
}

function normalizeQuantity(value: number): number {
  return Number.isFinite(value) ? Math.max(Math.trunc(value), 0) : 0;
}

function convertToRevenueCurrency(amount: number, currency: string, revenueCurrency: string, fxRate?: number | null): number {
  if (currency === revenueCurrency) return amount;
  return amount * (fxRate ?? 1);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function stableKey(...parts: Array<string | number>): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}
