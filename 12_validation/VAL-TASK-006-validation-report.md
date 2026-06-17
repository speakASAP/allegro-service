# VAL-TASK-006: Stock Order Profit Loop Validation Report

```yaml
id: VAL-TASK-006
status: partial
owner: TASK-006-E integration owner
created: 2026-06-13
last_updated: 2026-06-15
source_task: ../11_tasks/TASK-006-plan-stock-order-profit-loop.md
execution_plan: ../21_execution_plans/EP-TASK-006-plan-stock-order-profit-loop.md
classification: synthetic
```

Validation id: VAL-TASK-006  
Target: TASK-006  
Date: 2026-06-15  
Validator: AI agent

## Summary

TASK-006 contract-discovery lanes A-D were integrated at the planning level. The work remains partial because no external payments, suppliers, order-idempotency, Allegro fee, shipping-cost, or stock-sync attempt contracts are approved yet. No runtime code, schema, production data, deployment, payment write, supplier write, stock mutation, or local order ownership change was introduced by this validation update.

## Upstream goal

TASK-006 supports FEAT-006 and roadmap Stage 4: close stock, order, payment, supplier, and profit feedback loops so Allegro sales can be fulfilled profitably while preserving warehouse ownership of stock, orders-microservice ownership of orders, read-only-first payment and supplier boundaries, account-aware Allegro rate limits, and sensitive-data controls.

## Criteria checked

| Criterion | Result | Evidence |
|---|---|---|
| Stock drift and publishable quantity lane | Partial | TASK-006-A found local offer stock fields, warehouse stock event handling, and existing Allegro stock mutation paths, but no durable account-rate-limited stock sync attempt contract or stock drift fixture exists yet. |
| Order retry and reconciliation lane | Partial | TASK-006-B confirmed `orders.create.v1` forwarding inputs and local Allegro order projection, but duplicate/idempotency response behavior and durable reconciliation storage remain missing. |
| Payments and suppliers read-only lane | Blocked | TASK-006-C found no dedicated payments client or supplier client; supplier runtime is placeholder-only and includes write-like methods that are not approved for this task. |
| Margin computation lane | Blocked | TASK-006-D found offer price, order revenue, catalog pricing hooks, supplier placeholder cost fields, and delivery/payment JSON anchors, but no fee, settlement, deterministic shipping-cost, or approved margin-floor contract. |
| Sensitive-data handling | Partial | All lane handoffs used synthetic examples and avoided runtime rows/logs; full closure still needs a final sensitive-data scan after any future contract artifacts are added. |
| Parallel execution recovery | Pass | A-D lane handoffs have been reviewed and summarized here after earlier concurrent shared-file overwrites. Future lanes must avoid shared report writes unless assigned integration ownership. |

## Gate evidence

- `npm run ips:audit`: pending rerun after this TASK-006-E integration update.
- `npm run ips:pre-coding`: pending rerun after this TASK-006-E integration update.
- `python3 scripts/deployment_readiness_gate.py --root . --target TASK-002`: pending rerun after this TASK-006-E integration update.
- Targeted runtime tests: not run because TASK-006-E integrated contract-discovery documentation only and did not change runtime code.

## Invariant evidence

- ALG-INV-002: Stock and Allegro mutation planning remains account/rate-limit gated; no direct stock-to-Allegro implementation was added.
- ALG-INV-003: Order ownership remains with orders-microservice; Allegro local records remain channel projection and forwarding evidence only.
- ALG-INV-004: Validation examples are synthetic; no OAuth tokens, secrets, raw production logs, real buyers, real payments, or production supplier data were added.
- ALG-INV-005: No ownership boundary change or ADR-level decision was made.
- ALG-INV-006: TASK-006 remains linked through feature, goal impact, execution plan, and this validation report before coding.
- ALG-INV-007: Closure is not claimed; validation evidence remains partial and blockers are explicit.

## Sensitive-data scan evidence

Lane handoffs used synthetic identifiers such as synthetic order IDs, synthetic account IDs, synthetic supplier IDs, and example.invalid email addresses. No production payloads, OAuth tokens, Authorization headers, payment details, raw customer records, raw order logs, or supplier secrets were intentionally inspected or recorded. A final automated sensitive-data scan remains required before TASK-006 closure if any contract files, fixtures, or tests are added later.

## Replay and determinism evidence

- Stock lane: future stock sync must use durable idempotent account-rate-limited attempt records before writing to Allegro; no such contract exists yet.
- Order lane: existing replay relies on order upsert by Allegro order ID plus `orders.create.v1` idempotency fields, but duplicate-response behavior must be confirmed with the orders owner.
- Payments/suppliers lane: proposed reads require contract versions, source service names, observation timestamps, and idempotency keys; no runtime client exists yet.
- Margin lane: proposed calculation is coverage-based and deterministic: return UNKNOWN when required economics are unavailable rather than inventing fee, settlement, shipping, currency, or margin-floor rules.

## Integrated lane findings

### TASK-006-A Stock

Current evidence: warehouse stock events update local offers, local offer stock fields exist, and Allegro stock mutation paths exist elsewhere. The safe contract is not direct event-to-Allegro propagation; it is a durable, idempotent, account-rate-limited stock sync attempt with observable terminal results.

Integration decision: warehouse availability remains authoritative. Reverse warehouse writes from inventory/import flows require owner review before stock automation is approved.

Missing facts:

- [MISSING: warehouse stock event schema and accepted stock semantics for Allegro publishable quantity]
- [MISSING: stock drift threshold and reconciliation cadence]
- [MISSING: durable stock sync attempt or queue contract]
- [MISSING: terminal Allegro stock update result contract]
- [MISSING: synthetic stock drift fixtures and stock subscriber tests]
- [MISSING: stock-out deactivation or quantity-zero policy]
- [UNKNOWN: authoritative remote Allegro quantity reconciliation source for production accounts]

### TASK-006-B Orders

Current evidence: `shared/clients/order-client.service.ts` forwards `orders.create.v1` with `externalOrderId`, `channel`, and `channelAccountId`; `OrdersService.syncOrdersFromAllegro()` upserts local Allegro order projection and forwards mapped order data when a related offer exists. No order RabbitMQ subscriber was found; `WebhookEvent` exists but is not proven as an order-forward retry ledger.

Integration decision: preserve orders-microservice as source of truth. Treat `(channel, channelAccountId, externalOrderId)` as the candidate idempotency identity, but do not code reconciliation until duplicate-response behavior is confirmed.

Missing facts:

- [MISSING: orders-microservice authoritative `orders.create.v1` duplicate/idempotency response contract]
- [MISSING: durable order-forward attempt record or approved reuse of `WebhookEvent`]
- [MISSING: reconciliation endpoint or job contract for pending, failed, or blocked Allegro order forwards]
- [MISSING: approved redacted order-forward failure taxonomy]
- [MISSING: confirmed order-events versus order-list polling source of truth]
- [UNKNOWN: whether orders-microservice validates payload equality on idempotency conflict]
- [UNKNOWN: expected central order status mapping for Allegro payment status values]

### TASK-006-C Payments And Suppliers

Current evidence: no dedicated payments client, supplier client, payment DTO contract, or supplier DTO contract exists in shared clients. Allegro local order records contain payment status evidence only. Supplier-related code is placeholder-only; the placeholder includes write-like methods and is not an approved integration contract.

Integration decision: payments and suppliers remain contract-blocked. TASK-006 may define read-only or dry-run contracts, but must not add payment writes, supplier purchase automation, refund/capture/settlement behavior, or real reservation behavior.

Missing facts:

- [MISSING: payments-microservice read-only status, settlement, fee, and refund contract]
- [MISSING: canonical payment lookup key and payment status enum]
- [MISSING: payment redaction contract and freshness semantics]
- [MISSING: suppliers-microservice read-only availability, cost, lead-time, and dry-run reservation contracts]
- [MISSING: supplier identity, stock semantics, cost basis, and dry-run semantics]
- [UNKNOWN: whether suppliers service can simulate reservation without creating supplier-side state]

### TASK-006-D Margin

Current evidence: offer price, order revenue, catalog pricing hooks, supplier placeholder cost fields, and delivery/payment JSON fields exist. Current order forwarding sets shipping and tax values to zero, so those values cannot be treated as known economics. No Allegro fee client, payment settlement client, deterministic shipping-cost source, approved margin floor, or FX source exists in the inspected runtime paths.

Integration decision: margin planning must be coverage-based. Profitability is UNKNOWN when required inputs are missing; WARNING/PASS are allowed only when all required inputs and currency semantics are approved.

Missing facts:

- [MISSING: Allegro fee or commission formula, or read-only fee endpoint contract]
- [MISSING: payments-microservice settlement, payment-fee, refund, and chargeback contract]
- [MISSING: deterministic shipping-cost source]
- [MISSING: catalog pricing DTO shape]
- [MISSING: approved margin floor by product, category, account, or currency]
- [MISSING: supplier terms beyond placeholder supplier price, currency, and stock]
- [MISSING: approved FX conversion source]
- [UNKNOWN: whether Allegro total price includes delivery, fees, discounts, or taxes in the intended semantics]
- [UNKNOWN: VAT or tax treatment for margin]

## Proposed validation cases for future coding tasks

- Stock sync attempt: repeated synthetic stock event produces one durable account-rate-limited sync attempt and deterministic terminal state.
- Stock drift: synthetic warehouse quantity and remote Allegro quantity mismatch is classified without mutating Allegro until policy allows it.
- Order replay: duplicate `orders.create.v1` attempt resolves through confirmed idempotency behavior or explicit manual-review state.
- Missing offer order: Allegro order without local matching offer is visible as blocked without stock, payment, or supplier side effects.
- Payment read-only: future payment client exposes reads only and rejects capture, refund, settlement, or payout mutation in TASK-006 scope.
- Supplier dry-run: future supplier reservation feasibility requires dry-run semantics and cannot place real supplier orders.
- Margin coverage: missing fee, shipping, payment, supplier, FX, or margin-floor input returns UNKNOWN, not PASS or WARNING.
- Redaction: synthetic fixtures and reports contain no real customer, supplier, payment, OAuth, token, or production log data.

## Issues found

- Shared validation report writes caused prior TASK-006 lane overwrites. Integration ownership is now explicit; future workers should return handoffs instead of editing shared reports unless assigned owner.
- TASK-006 is not coding-ready because multiple external ownership and contract facts remain missing.
- Existing supplier placeholder includes write-like methods and must not be reused as the TASK-006 supplier contract.
- Current order forwarding economics treat shipping and tax as zero, which is insufficient for margin truth.
- No runtime validation suite exists yet for stock drift, order reconciliation, read-only payments/suppliers, or margin coverage.

## Recommendation

Accept TASK-006-E integration as planning evidence only. Do not close TASK-006 and do not generate coding prompts until service owners confirm the missing contracts, synthetic fixtures are added, and targeted tests are defined. The next planning step should split TASK-006 follow-up into smaller implementation-ready tasks: stock sync attempt contract, order reconciliation contract, read-only payments/suppliers contracts, and margin coverage contract.

## Traceability confirmation

TASK-006 remains aligned with VISION, VG-REVENUE, SYS-001, FEAT-006, GOAL-IMPACT-TASK-006, EP-TASK-006, and project invariants. The integrated report preserves the Intent Preservation chain from Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Validation and does not claim code completion.
