# Integrations

```yaml
id: INTEGRATIONS-ALLEGRO-SERVICE
status: draft
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../SYSTEM.md
  - ../06_architecture/ARCHITECTURE_OVERVIEW.md
  - ../08_roadmap/ROADMAP.md
downstream:
  - ../17_governance/PROJECT_INVARIANTS.md
  - ../09_milestones/MS-002-revenue-orchestration-foundation.md
related_adrs:
  - ../07_decisions/ADR-001-preserve-existing-nestjs-prisma-service-boundary.md
```

## Purpose

List integration boundaries that execution plans must preserve or explicitly validate. This document is the operating map for connecting `allegro-service` with the Alfares ecosystem to increase sales while protecting source-of-truth ownership.

## Current Service Boundaries

| Integration | Direction | Current Constraint | Runtime Evidence |
|---|---|---|---|
| catalog-microservice | outbound | Validate offer mutations and keep catalog as product owner. | `shared/clients/catalog-client.service.ts`, `catalogProductId` in Prisma. |
| warehouse-microservice | outbound + inbound events | Warehouse owns stock; Allegro consumes `stock.updated`, `stock.low`, `stock.out`. | `shared/clients/warehouse-client.service.ts`, `shared/rabbitmq/stock-events.subscriber.ts`. |
| orders-microservice | outbound | Forward orders; do not own orders locally. | `shared/clients/order-client.service.ts` with `orders.create.v1`. |
| auth-microservice | outbound/inbound auth | Preserve admin/operator auth boundary. | `shared/auth/*`, gateway auth routes. |
| logging-microservice | outbound | Do not log secrets or raw protected data. | `shared/logger/*`. |
| notifications-microservice | outbound | Send operational alerts without exposing secrets. | `shared/notifications/*`. |
| Allegro REST API/OAuth2 | outbound | Respect OAuth secret handling and API rate limit. | `services/allegro-service/src/allegro/*`. |

## Planned Ecosystem Boundaries

| Integration | Planned Direction | Revenue Purpose | Contract Rule |
|---|---|---|---|
| ai-microservice | outbound | Offer content, category, attribute, image, price, and quality suggestions. | Suggestions only until policy-confirmed; no autonomous publish. |
| leads-microservice | outbound | Capture marketplace demand and missed-sale signals. | Send redacted, contract-versioned lead events only. |
| marketing-microservice | outbound | Build segments for high-potential products, stale stock, and remarketing. | Requires funnel event taxonomy first. |
| minio-microservice | outbound | Store/serve approved offer media and generated image variants. | No raw secrets or unapproved copyrighted assets in storage. |
| payments-microservice | outbound/read-only first | Settlement, payment state, refund, and margin evidence. | Start read-only; writes require ADR and contract validation. |
| suppliers-microservice | outbound | Supplier stock, cost, reservation, lead time, replenishment. | Replace placeholders through explicit supplier contract. |

## Integration Design Rules

- Every client must have timeout, retry/backoff, structured logging, and safe failure behavior appropriate to the business action.
- Revenue-critical writes must be idempotent or have a durable attempt record.
- Cross-service event payloads must carry contract version, source service, channel, account id where relevant, idempotency key, and redacted error context.
- Contract changes require task-level validation and, if ownership boundaries change, ADR review.
- Sensitive fields must be excluded from logs, reports, prompts, screenshots, and example fixtures.

## Revenue Event Taxonomy

The roadmap standardizes these business events for logging, analytics, notifications, leads, and marketing integrations:

| Event | Trigger | Primary Consumers |
|---|---|---|
| `allegro.catalog.ready` | Catalog product passes readiness scoring. | logging, marketing |
| `allegro.draft.created` | Offer draft prepared from catalog or manual import. | logging |
| `allegro.policy.blocked` | Policy gate prevents publish/update. | logging, notifications |
| `allegro.publish.confirmed` | Operator or allowed workflow confirms publish. | logging |
| `allegro.publish.succeeded` | Allegro command completes successfully. | logging, marketing |
| `allegro.publish.failed` | Publish/update command fails or times out. | logging, notifications |
| `allegro.stock.synced` | Warehouse stock is reflected in local/Allegro offer state. | logging |
| `allegro.stock.drift` | Warehouse and Allegro state diverge beyond threshold. | logging, notifications |
| `allegro.order.received` | Allegro order/event received. | logging |
| `allegro.order.forwarded` | orders-microservice accepts forwarded order. | logging |
| `allegro.order.forward_failed` | Order forwarding fails after retry policy. | logging, notifications |
| `allegro.margin.warning` | Product/order margin falls below floor. | logging, notifications, marketing |
| `allegro.demand.signal` | Inquiry, out-of-stock demand, repeated interest, or failed sale signal is detected. | leads, marketing |

## Validation

Contract-affecting tasks must identify affected integrations, source-of-truth ownership, test commands, failure behavior, rollback plan, and redaction evidence in the execution plan.
