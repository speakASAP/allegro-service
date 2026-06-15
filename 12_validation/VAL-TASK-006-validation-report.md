# VAL-TASK-006: Stock Order Profit Loop Validation Report

```yaml
id: VAL-TASK-006
status: draft
owner: TASK-006 validation lanes
created: 2026-06-13
last_updated: 2026-06-13
source_task: ../11_tasks/TASK-006-plan-stock-order-profit-loop.md
execution_plan: ../21_execution_plans/EP-TASK-006-plan-stock-order-profit-loop.md
classification: synthetic
```

## Purpose

Collect contract-discovery evidence for TASK-006 before any implementation work. This report uses only synthetic examples and source inspection notes. It must not include production order/customer/payment data, OAuth tokens, secrets, or raw logs.

## Summary

TASK-006 contract discovery is in progress. The file currently preserves full TASK-006-B order retry and reconciliation evidence. TASK-006-A stock evidence is recoverable from the completed worker final, and TASK-006-C payments/suppliers plus TASK-006-D margin completed as read-only handoff threads; TASK-006-E still needs to merge A/C/D into this report before closure.

## Upstream goal

TASK-006 supports FEAT-006 and the roadmap Stage 4 goal to make Allegro sales update stock, fulfillment, margin, and replenishment signals across the ecosystem while preserving warehouse, orders, payment, supplier, and sensitive-data ownership boundaries.

## Criteria checked

| Criterion | Result | Evidence |
|---|---|---|
| Order ownership boundary | Partial | TASK-006-B confirms `orders-microservice` remains source of truth and Allegro keeps only channel projection and forwarding evidence. |
| Replay-safe order forwarding | Partial | Existing `orders.create.v1` idempotency fields exist, but authoritative duplicate-response behavior is not confirmed. |
| Durable reconciliation visibility | Gap | No dedicated order-forward attempt ledger or reconciliation endpoint was found in preserved TASK-006-B evidence. |
| Sensitive-data handling | Partial | Preserved synthetic fixture uses synthetic IDs and example.invalid email; final integrated report still needs a full sensitive-data scan. |
| Parallel lane completeness | Partial | B is preserved in this report; A is recoverable from worker final; C and D completed read-only final handoffs and await TASK-006-E merge. |

## Issues found

- Concurrent TASK-006 workers wrote the same validation report and overwrote lane handoffs; the current file preserves only TASK-006-B order evidence.
- TASK-006-A stock evidence must be recovered from its completed worker final.
- TASK-006-C payments/suppliers and TASK-006-D margin lanes completed as read-only handoff threads and must be merged by TASK-006-E.
- Orders duplicate/idempotency behavior, durable reconciliation storage, redacted order failure taxonomy, and order event source of truth remain unresolved contract gaps.

## Recommendation

Accept the current TASK-006-B handoff as partial evidence only. Do not close TASK-006 or generate coding prompts until TASK-006-E integrates A-D handoffs, resolves missing external contract facts, runs IPS gates, and records validation evidence.

## Traceability confirmation

TASK-006 remains aligned to FEAT-006, GOAL-IMPACT-TASK-006, the Allegro revenue roadmap, and invariants ALG-INV-002, ALG-INV-003, ALG-INV-004, ALG-INV-006, and ALG-INV-007. The preserved order lane does not change order ownership and does not introduce production data or runtime behavior.


## Parallel Lane Recovery Notes

### TASK-006-A Stock Lane Status

Status: completed worker final, not fully preserved in this file. The final handoff says warehouse availability should remain authoritative, stock events must not write directly to Allegro until a durable idempotent account-rate-limited sync attempt contract exists, and reverse warehouse writes from inventory/import flows need owner review before stock automation is approved.

Key missing markers from the completed worker final include warehouse stock event schema, stock drift threshold, publishable quantity formula, durable stock sync attempt/queue, terminal Allegro stock update result contract, stock fixture/tests, stock-out deactivation policy, and remote Allegro quantity reconciliation source.

### TASK-006-C Payments And Suppliers Lane Status

Status: completed as read-only final handoff. No files were modified. The lane found no dedicated payments client and no supplier client. Existing payment data is Allegro/order-local evidence only, supplier runtime is placeholder-only, and the supplier placeholder includes write-like methods that must not be treated as an approved TASK-006 contract.

TASK-006-E must treat payments and suppliers as blocked on explicit read-only external contracts for endpoint ownership, DTOs, status enums, redaction rules, cost/settlement semantics, and supplier dry-run behavior.

### TASK-006-D Margin Lane Status

Status: completed as read-only final handoff. No files were modified. The lane identified offer price, order revenue, catalog pricing hooks, supplier placeholder cost fields, and delivery/payment JSON as possible source anchors, but found no implemented Allegro fee client, payment-settlement client, deterministic shipping cost source, or approved margin floor.

TASK-006-E should design margin as a coverage-based contract: return UNKNOWN when required economics are missing, avoid invented fee/shipping/payment formulas, and use only synthetic fixtures until external contracts are approved.

## TASK-006-B Order Lane Handoff

### Scope

TASK-006-B inspected order forwarding, RabbitMQ subscriber behavior, the orders-microservice ownership boundary, and existing retry/reconciliation records. This lane did not modify runtime code, schemas, payment behavior, stock mutations, or production configuration.

### Source Files Inspected

- `AGENTS.md`
- `11_tasks/TASK-006-plan-stock-order-profit-loop.md`
- `21_execution_plans/EP-TASK-006-plan-stock-order-profit-loop.md`
- `10_features/FEAT-006-stock-order-profit-loop.md`
- `16_operations/INTEGRATIONS.md`
- `17_governance/PROJECT_INVARIANTS.md`
- `shared/clients/order-client.service.ts`
- `services/allegro-service/src/allegro/orders/orders.service.ts`
- `services/allegro-service/src/allegro/orders/orders.controller.ts`
- `services/allegro-service/src/allegro/events/events.service.ts`
- `services/allegro-service/src/allegro/events/events.controller.ts`
- `services/allegro-service/src/allegro/allegro-api.service.ts`
- `shared/rabbitmq/stock-events.subscriber.ts`
- `shared/rabbitmq/rabbitmq.module.ts`
- `services/allegro-service/src/allegro/allegro.module.ts`
- `prisma/schema.prisma`

### Current Contract Evidence

- Ownership boundary: `16_operations/INTEGRATIONS.md` and `17_governance/PROJECT_INVARIANTS.md` require orders to be forwarded to `orders-microservice`; `allegro-service` must not become local source of truth for orders.
- Forwarding client: `shared/clients/order-client.service.ts` posts to `ORDER_SERVICE_URL || http://orders-microservice:3203`, endpoint `orders.create.v1 HTTP endpoint`, with `contractVersion: orders.create.v1` and normalized `channelAccountId` defaulting to `default`.
- Idempotency inputs: `CreateCentralOrderRequest` includes `externalOrderId`, `channel`, and `channelAccountId`; comments state these fields allow safe retries. The assumed idempotency key is the tuple `(channel, channelAccountId, externalOrderId)`.
- Existing sync path: `OrdersService.syncOrdersFromAllegro()` fetches `Allegro order list endpoint`, upserts an `AllegroOrder` projection by unique `allegroOrderId`, then forwards mapped order data to `orders-microservice` when a related offer exists.
- Existing local projection: Prisma model `AllegroOrder` stores marketplace order projection fields and has a unique `allegroOrderId`. This exists today, but TASK-006-B does not expand it or treat it as order ownership.
- Existing webhook/event record: Prisma model `WebhookEvent` has `eventId`, `eventType`, `payload`, `processed`, `processedAt`, `processingError`, and `retryCount`; no source usage was found in the inspected Allegro service source.
- Existing event path: `EventsService.getOrderEvents()` exposes Allegro order event polling through `AllegroApiService.getOrderEvents()`, which attempts `Allegro order events endpoint` and returns an empty result on unavailable endpoint.
- RabbitMQ behavior: the only inspected RabbitMQ subscriber is `StockEventsSubscriber`, bound to exchange `stock.events`, queue `stock.allegro-service`, routing key `stock.#`; it acks successful stock events and `nack(msg, false, false)` on processing errors. No order RabbitMQ subscriber was found.

### Replay-Safe Reconciliation Contract Notes

- Replaying order sync should be safe only if `orders-microservice` accepts repeated `orders.create.v1` requests with identical `(channel, channelAccountId, externalOrderId)` as an idempotent success or a retrievable existing order.
- A `409` from `orders-microservice` is currently mapped to `ORDER_IDEMPOTENCY_CONFLICT` by the client and then logged by `OrdersService` as a forwarding failure. For reconciliation, a duplicate/idempotency conflict should be resolved by `findByExternalId()` and classified as `already_forwarded` when the existing central order matches the synthetic contract fixture.
- Retrying by rerunning `syncOrdersFromAllegro()` currently re-attempts forwarding because `AllegroOrder.upsert()` is deterministic by `allegroOrderId`; however, there is no durable forward attempt state to distinguish `pending`, `accepted`, `already_forwarded`, `retryable_failed`, `terminal_failed`, or `blocked_missing_offer`.
- The current sync only forwards when a related offer is found. Orders without a matching offer are locally upserted but not forwarded and have no explicit reconciliation marker. Proposed contract status: `blocked_missing_offer` with redacted reason and next action for integration owner review.
- Forwarding failure currently does not fail the overall sync loop. This preserves ingestion progress, but reconciliation needs a durable marker or synthetic validation query so failures are visible and replayable.
- `WebhookEvent.retryCount` is generic event infrastructure, not a proven order-forward retry ledger. Do not rely on it as the TASK-006 order attempt record unless TASK-006-E explicitly accepts that contract and validates usage.
- No local stock reservation, stock decrement, payment write, refund behavior, supplier purchase, or central order mutation beyond `orders.create.v1` should be added in this lane.

### Proposed Synthetic Contract Fixture

```json
{
  "contractVersion": "orders.create.v1",
  "externalOrderId": "ALG-SYNTH-ORDER-0001",
  "channel": "allegro",
  "channelAccountId": "ALG-SYNTH-ACCOUNT-0001",
  "customer": {
    "email": "synthetic-buyer@example.invalid",
    "login": "synthetic-buyer"
  },
  "items": [
    {
      "productId": "00000000-0000-4000-8000-000000000001",
      "sku": null,
      "title": "Synthetic Product",
      "quantity": 2,
      "unitPrice": 25.5,
      "totalPrice": 51
    }
  ],
  "subtotal": 51,
  "shippingCost": 0,
  "taxAmount": 0,
  "total": 51,
  "currency": "PLN",
  "paymentStatus": "READY_FOR_PROCESSING",
  "orderedAt": "2026-06-13T00:00:00.000Z"
}
```

### Proposed Validation Cases For TASK-006-E

- First forward succeeds: synthetic Allegro order with matching offer produces one `orders.create.v1` call and records/observes accepted central order id without storing raw customer data in validation evidence.
- Replay same order: rerun with same `(channel, channelAccountId, externalOrderId)` and confirm either idempotent accepted response or `409` followed by `findByExternalId()` reconciliation to `already_forwarded`.
- Retryable failure: simulate orders-microservice timeout/5xx; verify the order is visible as retryable without blocking subsequent Allegro order ingestion.
- Missing offer: simulate Allegro order whose line item offer id has no local `AllegroOffer`; verify it is not forwarded, is visible as `blocked_missing_offer`, and does not create stock/payment side effects.
- Contract mismatch: simulate `409 ORDER_IDEMPOTENCY_CONFLICT` where existing central order does not match the synthetic payload; verify terminal/manual-review classification, not silent success.
- RabbitMQ non-order scope: verify no order reconciliation depends on `StockEventsSubscriber`; order retry/reconciliation should use polling/attempt records unless a future ADR approves an order event queue contract.
- Redaction: validation evidence must use synthetic ids/emails only and must not include raw Allegro payloads or production logs.

### Missing Markers

- [MISSING: orders-microservice authoritative `orders.create.v1` idempotency conflict response contract, including whether duplicate creates return 200/201, 409, or another status.]
- [MISSING: durable order-forward attempt record or accepted contract for reusing `WebhookEvent` as the retry/reconciliation ledger.]
- [MISSING: reconciliation endpoint/job contract for listing failed, pending, or blocked Allegro order forwards.]
- [MISSING: approved redacted error taxonomy for `allegro.order.forward_failed` notification/logging payloads.]
- [MISSING: confirmed order event source of truth: Allegro order-events availability vs order-list polling fallback for production accounts.]
- [UNKNOWN: whether `orders-microservice` validates payload equality on idempotency conflict or only keys by external id.]
- [UNKNOWN: expected central order status mapping for Allegro `payment.status` values.]

### Deviations

- No runtime code or schema changes were made because this worker is scoped to replay-safe contract notes only.
- No IPS gate commands or test suites were run because this lane produced source-inspection documentation only; TASK-006-E should run `npm run ips:audit`, `npm run ips:pre-coding`, and any targeted contract tests after integrating A-D handoffs.
- Remote `apply_patch` was unavailable, so this report was created via a direct one-off SSH write to the allowed remote validation file.

### Validation Evidence

- `sed` inspection confirmed TASK-006 objective, acceptance criteria, non-goals, and execution-plan lane scope.
- `sed` inspection confirmed integrations/invariants require `orders-microservice` ownership and prohibit local order source-of-truth expansion.
- `rg` inspection found order forwarding references in `shared/clients/order-client.service.ts` and `services/allegro-service/src/allegro/orders/orders.service.ts`.
- `nl -ba` inspection confirmed `OrdersService.syncOrdersFromAllegro()` upserts by `allegroOrderId`, maps synthetic-compatible order fields, catches forwarding errors, and continues the sync loop.
- `rg` inspection found no order RabbitMQ subscriber; only `StockEventsSubscriber` is wired through `RabbitMQModule` and imported by `AllegroModule`.
- `sed` inspection confirmed `WebhookEvent` retry fields exist in Prisma but no inspected service usage proves it is an order-forward attempt ledger.

### Handoff For TASK-006-E Integration Owner

Treat TASK-006-B as a contract-discovery handoff, not an implementation. The smallest replay-safe integration plan should define an explicit order-forward reconciliation contract before coding: preserve `orders-microservice` as owner; use `(channel, channelAccountId, externalOrderId)` as idempotency identity; classify duplicate conflicts through `findByExternalId()`; add or approve a durable attempt/reconciliation record; and keep stock, payment, and supplier effects out of order forwarding. Resolve the missing `orders.create.v1` duplicate-response contract with the orders owner before turning this into a coding prompt.
