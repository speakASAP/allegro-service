# Allegro Service Orchestrator Status

Updated: 2026-07-01

## 2026-07-01 - Goal 7.2B Orders Canonical Create Readiness

Result: source-ready, no deploy. Allegro central order forwarding remains disabled
by default and still requires `forwardToOrdersMicroservice=true` plus exact
confirmation `ALLEGRO_ORDER_FORWARDING_TO_ORDERS_MICROSERVICE` before any
orders-microservice create call is attempted.

IPS chain: Vision -> canonical Orders lifecycle for sellable channels; Goal
Impact -> Allegro can forward only complete, Warehouse-reservable orders; System
-> allegro-service order projection and shared Orders client; Feature ->
`orders.create.v1` forwarding readiness; Task -> add accepted machine-auth
headers and Warehouse-owned `warehouseId` requirement; Execution Plan -> keep
forwarding gated, fail closed on missing runtime prerequisites, validate with
focused client/mapper/service specs and builds; Coding Prompt -> preserve
Catalog product truth, Warehouse stock authority, Orders idempotency, and secret
redaction; Code -> `shared/clients/order-client.service.ts`,
`shared/clients/order-client.service.spec.ts`, and
`services/allegro-service/src/allegro/orders/*`; Validation -> focused specs,
`git diff --check`, shared build, and allegro-service build passed.

Implemented:

- Orders create now sends `x-internal-service-token` and
  `x-service-name: allegro-service` when `ALLEGRO_INTERNAL_SERVICE_TOKEN` or a
  compatible fallback env is configured, and fails closed with
  `[MISSING: Orders runtime credential]` before HTTP create when no internal
  token is present.
- Forwarded `orders.create.v1` items now include a runtime Warehouse-owned
  `warehouseId` from `ALLEGRO_ORDER_FORWARDING_WAREHOUSE_ID` or
  `DEFAULT_WAREHOUSE_ID`, with `STOCK_PRIMARY_WAREHOUSE` accepted as the
  current Allegro runtime config fallback.
- If no Warehouse-owned `warehouseId` is configured, forwarding blocks before
  calling Orders with `[MISSING: warehouseId]:line_<n>_missing_warehouse_id`.
- Product IDs remain `AllegroOffer.catalogProductId`, preserving Catalog
  canonical product truth instead of using Allegro offer/listing IDs.
- Existing idempotency fields are preserved:
  `orders.create.v1:allegro:<channelAccountId>:<externalOrderId>`, with stable
  `channelAccountId`, stable `externalOrderId`, payload hash, and conflict
  handling retained.

Runtime gate:

- `[MISSING: Orders runtime credential/deploy gate]` live create smoke was not
  run because this lane did not deploy or provision/verify runtime Orders
  credentials.

Follow-up runtime wiring:

- `k8s/external-secret.yaml` maps `ALLEGRO_INTERNAL_SERVICE_TOKEN` from the
  existing Orders Vault property into `allegro-service-secret`.
- `k8s/deployment.yaml` exposes `ALLEGRO_INTERNAL_SERVICE_TOKEN` from
  `allegro-service-secret` and maps
  `ALLEGRO_ORDER_FORWARDING_WAREHOUSE_ID` from `allegro-config`
  `STOCK_PRIMARY_WAREHOUSE`.
- No token values were printed or committed.

## 2026-06-29 - TASK-STOCK-004 Allegro Complete Physical Stock Source Recheck

Result: owner authorized getting the missing complete physical stock source from Allegro. Live read-only probes against the deployed Allegro pod confirmed the current configured Allegro seller surface exposes `9` unique current-stock-authoritative offers, not ~500 distinct offers/products. Their `/sale/product-offers/{offerId}.stock.available` total is `496` units, which matches the expected "about 500" as physical stock quantity.

Evidence: `node dist/scripts/import-current-allegro-stock-to-warehouse.js --all-accounts --dry-run --verify-warehouse --detail-limit 1000 --list-limit 100` returned `stockAuthoritativeAppearances=27`, `uniqueStockAuthoritativeOffers=9`, `duplicateStockAuthoritativeAppearances=18`, `stockAuthoritativeTotal=496`, `wouldSet=9`, `warehouseMatches=9`, `warehouseMismatches=0`, and no errors. `node dist/scripts/audit-current-stock-source.js --all-accounts --detail-limit 1000 --list-limit 100` returned 3 configured accounts; each saw the same 9 ACTIVE offer IDs, INACTIVE/ENDED/ACTIVATING counts were 0, and each account stock total was 496. A separate no-status `/sale/offers` read also returned exactly 9 unique offers and 496 listed stock for each configured account. `/sale/product-offers` list-style probing is not a usable listing source in this runtime; it returns HTTP 405, so `/sale/offers` discovery plus `/sale/product-offers/{offerId}` detail remains the current Allegro source contract.

Decision: there is no additional hidden 500-offer Allegro source in the configured accounts. Warehouse already matches all 9 Allegro current-stock-authoritative offers. Historical order-only rows remain non-authoritative for current stock. Also patched `audit-current-stock-source.ts` so future larger accounts compute unique current-stock totals from all detailed offer stock rows instead of the display sample cap, and so the audit reports unfiltered `/sale/offers` counts alongside publication-status filtered counts.

Deployment/validation: committed and deployed `de214fb` (`fix: report full allegro stock audit counts`). Deployment completed successfully for Allegro service, API gateway, settings, imports, and frontend. Deployed patched audit returned `mutates=false`, `unfilteredListedOffers=27`, `unfilteredListedStockTotal=1488`, `stockAuthoritativeOffers=27`, `stockAuthoritativeTotal=1488`, `uniqueStockAuthoritativeOffers=9`, `uniqueStockAuthoritativeTotal=496`, `duplicateStockAuthoritativeAppearances=18`, `detailErrors=0`, and no account errors. Deployed Warehouse dry-run verifier still returned `mutatesWarehouse=false`, `stockAuthoritativeAppearances=27`, `uniqueStockAuthoritativeOffers=9`, `stockAuthoritativeTotal=496`, `wouldSet=9`, `warehouseMatches=9`, `warehouseMismatches=0`, and no errors.

Boundary: read-only Allegro/API probes and audit script deployment only; no Warehouse apply, local Allegro projection mutation, Allegro write API, account activation/token refresh, Catalog write, or order forwarding was run.

## Current State

- TASK-010 Allegro primary-channel foundation is implemented and validated for the Allegro adapter.
- W2 sync/projection migration is applied live and deployed.
- Owner-approved one-time current-stock Warehouse apply completed on 2026-06-29.
- P1 order sync now defaults to local projection only; central forwarding is exact-confirmation gated.
- Durable central order forwarding attempt/status storage is migrated and deployed; pushed `main` and live Kubernetes image tags agree on `268e845`.
- Preview-token governed import approvals and governed Allegro quantity-command write-back are migrated, deployed, live-image verified on tag `268e845`, and authenticated-smoke verified. The smoke ran `prepare` then `confirm` with target quantity equal to current quantity, reached `QUEUED`, did not call `execute`, did not create a command id, and did not change Allegro quantity.
- Recurring Warehouse stock orchestration policy is implemented for Allegro: Warehouse is the only source of sellable quantity; `stock.updated` and `stock.out` events automatically create and execute durable Allegro quantity command attempts; `stock.out` forces target quantity `0`; no approval is required; and the default account pacing is one request per second via `ALLEGRO_STOCK_SYNC_RATE_LIMIT_MS=1000`.
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
- `GET /api/allegro/operations/order-forwarding-attempts`

The operations raw-payload endpoint returns metadata only and does not select raw payload JSON.

## Guarded Apply Surfaces

- Checkout-form local projection: `--apply --confirm-local-only`.
- Order-derived offer local projection: `--apply-local-projection --confirm-local-only`.
- Order-derived Catalog apply: `--apply --confirm-catalog-apply ALLEGRO_ORDER_OFFER_CATALOG_IMPORT`.
- Active-offer Catalog import: `--apply --confirm-catalog-apply ALLEGRO_ACTIVE_OFFER_CATALOG_IMPORT`.
- Active account mutation for active-offer import: `--activate-account --confirm-activate-account ALLEGRO_IMPORT_ACTIVATE_ACCOUNT`.
- HTTP offer import approval routes: body `confirmCatalogApply=ALLEGRO_HTTP_OFFER_IMPORT_CATALOG_APPLY`.
- Central order forwarding: `forwardToOrdersMicroservice=true` plus `ALLEGRO_ORDER_FORWARDING_TO_ORDERS_MICROSERVICE`.

## Blockers

- `orders.create.v1` duplicate/equality behavior confirmed from orders-microservice source and verification scripts: exact replay returns existing order without duplicate side effects; mismatched same-key replay returns HTTP 409.
- Preview-token governed service/controller import approval routes are implemented and live guarded.
- Governed Allegro quantity command prepare/confirm/execute/poll routes are implemented, migrated, deployed, and smoke-verified without execute.
- Recurring stock orchestration policy for automatic Allegro quantity commands is implemented in `shared/rabbitmq/stock-events.subscriber.ts`: Warehouse-only source, `stock.updated`/`stock.out` triggers, automatic execute, durable attempts, polling, terminal-state recording, and one-request-per-second default pacing.
- TASK-009 IPS audit/pre-coding debt repaired and validated on 2026-06-29; strict audit, pre-coding, and TASK-009 readiness gates passed.
