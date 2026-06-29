# Allegro Service Orchestrator Status

Updated: 2026-06-29

## Current State

- TASK-010 is the active Allegro primary-channel foundation task.
- W2 sync/projection migration is applied live and deployed.
- Owner-approved one-time current-stock Warehouse apply completed on 2026-06-29.
- P1 order sync now defaults to local projection only; central forwarding is exact-confirmation gated.
- P2 script import paths now separate dry-run, local projection, and Catalog apply confirmations.
- P7 operations read API and the dashboard Operations route are implemented.

## Safe Read Surfaces

- `GET /api/allegro/orders`
- `GET /api/allegro/offers`
- `GET /api/allegro/products`
- `GET /api/allegro/operations`
- `GET /api/allegro/operations/sync-runs`
- `GET /api/allegro/operations/cursors`
- `GET /api/allegro/operations/raw-payloads`
- `GET /api/allegro/operations/projection-audit`
- `GET /api/allegro/operations/stock-snapshots`

The operations raw-payload endpoint returns metadata only and does not select raw payload JSON.

## Guarded Apply Surfaces

- Checkout-form local projection: `--apply --confirm-local-only`.
- Order-derived offer local projection: `--apply-local-projection --confirm-local-only`.
- Order-derived Catalog apply: `--apply --confirm-catalog-apply ALLEGRO_ORDER_OFFER_CATALOG_IMPORT`.
- Active-offer Catalog import: `--apply --confirm-catalog-apply ALLEGRO_ACTIVE_OFFER_CATALOG_IMPORT`.
- Active account mutation for active-offer import: `--activate-account --confirm-activate-account ALLEGRO_IMPORT_ACTIVATE_ACCOUNT`.
- Central order forwarding: `forwardToOrdersMicroservice=true` plus `ALLEGRO_ORDER_FORWARDING_TO_ORDERS_MICROSERVICE`.

## Blockers

- `[MISSING: durable central order forwarding attempt/status storage]`
- `[MISSING: orders.create.v1 duplicate/equality confirmation from orders-microservice]`
- `[MISSING: preview-token governed service/controller import approval routes]`
- `[MISSING: governed recurring stock sync and Allegro quantity command write-back]`
- Pre-existing TASK-009 IPS audit debt remains outside TASK-010 scope.
