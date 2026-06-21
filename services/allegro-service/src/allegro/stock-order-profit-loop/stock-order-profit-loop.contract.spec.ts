import { strict as assert } from 'assert';
import {
  STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION,
  buildPaymentReadOnlyContract,
  buildStockSyncAttempt,
  buildSupplierDryRunContract,
  classifyOrderForwarding,
  computeMarginCoverage,
} from './stock-order-profit-loop.contract';

async function testStockSyncAttemptIsDurableAndDeterministic() {
  const first = buildStockSyncAttempt({
    correlationId: 'corr-stock-1',
    observedAt: '2026-06-21T01:10:00Z',
    catalogProductId: 'catalog-1',
    offerId: 'offer-1',
    accountId: 'account-1',
    warehouseAvailable: 7,
    reservedQuantity: 2,
    allegroAvailable: 3,
    driftThreshold: 0,
    stockOutPolicy: 'set_zero_after_confirmation',
  });
  const second = buildStockSyncAttempt({
    correlationId: 'corr-stock-2',
    observedAt: '2026-06-21T01:11:00Z',
    catalogProductId: 'catalog-1',
    offerId: 'offer-1',
    accountId: 'account-1',
    warehouseAvailable: 7,
    reservedQuantity: 2,
    allegroAvailable: 3,
    driftThreshold: 0,
    stockOutPolicy: 'set_zero_after_confirmation',
  });

  assert.equal(first.contractVersion, STOCK_ORDER_PROFIT_LOOP_CONTRACT_VERSION);
  assert.equal(first.mode, 'durable_attempt_required');
  assert.equal(first.stock.targetAllegroAvailable, 5);
  assert.equal(first.nextAction, 'persist_attempt');
  assert.equal(first.accountRateLimit.maxOneRequestPerSecond, true);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
}

async function testStockOutManualReviewBlocksMutation() {
  const result = buildStockSyncAttempt({
    correlationId: 'corr-stock-2',
    observedAt: '2026-06-21T01:12:00Z',
    catalogProductId: 'catalog-2',
    offerId: 'offer-2',
    accountId: 'account-2',
    warehouseAvailable: 0,
    allegroAvailable: 4,
    stockOutPolicy: 'manual_review',
  });

  assert.equal(result.decision, 'BLOCKED');
  assert.equal(result.nextAction, 'manual_review');
}

async function testOrderForwardingKeepsOrdersOwnershipAndConflictSafety() {
  const result = classifyOrderForwarding({
    correlationId: 'corr-order-1',
    allegroOrderId: 'allegro-order-1',
    channelAccountId: null,
    lastForwardStatus: 'conflict',
    duplicateResponse: 'conflict_different_payload',
  });

  assert.equal(result.ownerService, 'orders-microservice');
  assert.equal(result.identity.channelAccountId, 'default');
  assert.equal(result.nextAction, 'manual_review');
  assert.ok(result.failureTaxonomy.includes('duplicate_conflict'));
  assert.equal(result.retryPolicy.requiresPayloadEqualityCheck, true);
}

async function testPaymentAndSupplierContractsAreNonMutating() {
  const payment = buildPaymentReadOnlyContract({
    externalOrderId: 'order-1',
    observedAt: '2026-06-21T01:13:00Z',
  });
  const supplier = buildSupplierDryRunContract({
    catalogProductId: 'catalog-1',
    supplierId: 'supplier-1',
    supplierCode: 'sku-1',
    availableQuantity: 0,
  });

  assert.equal(payment.mode, 'read_only');
  assert.ok(payment.forbiddenOperations.includes('refund'));
  assert.equal(supplier.mode, 'dry_run_only');
  assert.equal(supplier.resultState, 'unavailable');
  assert.ok(supplier.forbiddenOperations.includes('place_order'));
}

async function testMarginCoverageRequiresCompleteEconomics() {
  const unknown = computeMarginCoverage({
    revenue: { amount: 100, currency: 'PLN' },
    supplierCost: { amount: 60, currency: 'PLN' },
    shippingCost: null,
    paymentFee: { amount: 2, currency: 'PLN' },
    allegroFee: { amount: 8, currency: 'PLN' },
    marginFloorRate: 0.15,
  });
  const pass = computeMarginCoverage({
    revenue: { amount: 100, currency: 'PLN' },
    supplierCost: { amount: 60, currency: 'PLN' },
    shippingCost: { amount: 8, currency: 'PLN' },
    paymentFee: { amount: 2, currency: 'PLN' },
    allegroFee: { amount: 8, currency: 'PLN' },
    marginFloorRate: 0.15,
  });
  const warning = computeMarginCoverage({
    revenue: { amount: 100, currency: 'PLN' },
    supplierCost: { amount: 80, currency: 'PLN' },
    shippingCost: { amount: 8, currency: 'PLN' },
    paymentFee: { amount: 2, currency: 'PLN' },
    allegroFee: { amount: 8, currency: 'PLN' },
    marginFloorRate: 0.15,
  });

  assert.equal(unknown.decision, 'UNKNOWN');
  assert.ok(unknown.missingInputs.includes('shippingCost'));
  assert.equal(pass.decision, 'PASS');
  assert.equal(pass.marginAmount, 22);
  assert.equal(warning.decision, 'WARNING');
  assert.equal(warning.nextAction, 'margin_warning');
}

export async function runStockOrderProfitLoopContractSpec(): Promise<void> {
  await testStockSyncAttemptIsDurableAndDeterministic();
  await testStockOutManualReviewBlocksMutation();
  await testOrderForwardingKeepsOrdersOwnershipAndConflictSafety();
  await testPaymentAndSupplierContractsAreNonMutating();
  await testMarginCoverageRequiresCompleteEconomics();
}

if (require.main === module) {
  runStockOrderProfitLoopContractSpec()
    .then(() => process.stdout.write('stock-order-profit-loop.contract.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`stock-order-profit-loop.contract.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
