# TASK-006: Plan Stock Order Profit Loop

```yaml
id: TASK-006
status: draft
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../10_features/FEAT-006-stock-order-profit-loop.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-006.md
execution_plan:
  - ../21_execution_plans/EP-TASK-006-plan-stock-order-profit-loop.md
```

## Objective

Plan and sequence warehouse, orders, payments, suppliers, and margin integrations so Allegro sells products that can be fulfilled profitably.

## Upstream Links

- [08_roadmap/ROADMAP.md](../08_roadmap/ROADMAP.md)
- [09_milestones/MS-005-stock-order-profit-loop.md](../09_milestones/MS-005-stock-order-profit-loop.md)
- [10_features/FEAT-006-stock-order-profit-loop.md](../10_features/FEAT-006-stock-order-profit-loop.md)
- [16_operations/INTEGRATIONS.md](../16_operations/INTEGRATIONS.md)

## Goal Impact

This task reduces lost sales, oversell risk, stock drift, unprofitable sales, and invisible order-forwarding failures.

## Project Invariant Impact

Applies ALG-INV-002, ALG-INV-003, ALG-INV-004, ALG-INV-006, and ALG-INV-007.

## Sensitive-Data Classification

Classification: synthetic. No raw order/customer/payment data in examples or reports.

## Contract/Schema Impact

Expected contracts for payments and suppliers; order and stock contracts already exist but need reconciliation extensions.

## Replay/Determinism Impact

Stock sync and order forwarding must be idempotent and replay-safe.

## Scope

Stock-to-Allegro sync, order-forward retry/reconciliation, payment read-only status, supplier stock/cost/lead-time, margin flags.

## Non-Goals

No local order ownership, no payment writes before approved contract, no supplier purchase automation before separate ADR/task.

## Acceptance Criteria

- [ ] Stock drift detection is designed.
- [ ] Order-forward retry and reconciliation is designed.
- [ ] Payments and suppliers start as read-only/dry-run contracts.
- [ ] Margin computation sources are documented.

## Required Context

Warehouse client, order client, RabbitMQ subscriber, Prisma order/offer models, integrations doc.

## Validation Task

Contract discovery report and synthetic replay/idempotency validation plan.

## Required Gates

Pre-coding gate, contract validation, targeted tests for implementation tasks.

## Execution Plan Requirement

This task must not be converted into a coding prompt until an approved execution plan exists.
