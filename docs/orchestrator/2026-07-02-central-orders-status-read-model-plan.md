# Allegro Central Orders Status Read Model Plan

Date: 2026-07-02
Parent plan: `orders-microservice/docs/orchestrator/2026-07-02-order-lifecycle-warehouse-status-rollout-plan.md`

## Objective

Allegro order views must show central Orders lifecycle and must not rely on marketplace-local status as the canonical customer/admin state.

## Current Evidence

- Allegro has order/dashboard UI evidence from prior validation.
- `[UNKNOWN: complete active order ingestion path and whether every order stores central Orders id.]`

## Workstream

Owner role: Allegro order read-model owner
Status: discovery required, then ready if files are independent

Allowed files:

- Allegro order service/dashboard/frontend files identified during discovery
- `docs/**`
- tests and validation reports

Forbidden files:

- unrelated product publish/status flow
- existing related-products plan work

## Required Work

1. Inspect Allegro order ingestion and central Orders forwarding.
2. Confirm every active order path stores central Orders id or mark `[MISSING: central Orders id mapping]`.
3. Render lifecycle stage from Orders API or lifecycle events.
4. Flag orders missing central id.

## Validation

- order list/detail shows central lifecycle
- missing central id is visible
- stale marketplace status is not treated as canonical
