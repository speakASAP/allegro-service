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

## A1 Implementation Handoff

Role: Allegro central Orders status read-model worker

Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation

- Vision: Allegro order views show central Orders lifecycle as the admin/customer lifecycle source.
- Goal Impact: operators can distinguish forwarded, missing, and stale central Orders state instead of reading Allegro-local status as canonical.
- System: `allegro-service` order read API joins `AllegroOrder` with the latest `AllegroOrderForwardingAttempt`.
- Feature: list/detail responses expose `centralOrderReadModel` with `available`, `unknown`, or `stale` state.
- Task: extract central id from `AllegroOrderForwardingAttempt.responseSummary.id`, read central Orders lifecycle through the shared Orders client when possible, and flag missing attempts or failed reads.
- Execution Plan: keep forwarding writes unchanged and gated; add fail-soft central lifecycle reads to the read path; update the dashboard to render central lifecycle before Allegro-local snapshot status.
- Coding Prompt: avoid unrelated related-products and product publish/status flows; preserve dirty work; do not deploy or push.
- Code: `shared/clients/order-client.service.ts`, `shared/clients/order-client.service.spec.ts`, `services/allegro-service/src/allegro/orders/orders.service.ts`, `services/allegro-service/src/allegro/orders/orders.service.spec.ts`, `services/frontend/src/pages/OrdersPage.tsx`.
- Validation: targeted shared/client and orders specs plus service/frontend builds are required before handoff.

Read-model states:

- `available`: latest forwarding attempt is `FORWARDED`, `responseSummary.id` is present, and Orders read returned a lifecycle payload.
- `unknown`: no forwarding attempt exists, forwarding attempt is not `FORWARDED`, or `responseSummary.id` is missing.
- `stale`: central id exists but Orders read fails or does not return a lifecycle payload.

Blocker surfaced in stale fallback: `[MISSING: Orders lifecycle read contract/client method]`.
