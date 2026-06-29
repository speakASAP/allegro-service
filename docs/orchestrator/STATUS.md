# Allegro Service Orchestrator Status

Updated: 2026-06-29

## 2026-06-29 - TASK-STOCK-004 Allegro Complete Physical Stock Source Recheck

Result: owner authorized getting the missing complete physical stock source from Allegro. Live read-only probes against the deployed Allegro pod confirmed the current configured Allegro seller surface exposes `9` unique current-stock-authoritative offers, not ~500 distinct offers/products. Their `/sale/product-offers/{offerId}.stock.available` total is `496` units, which matches the expected "about 500" as physical stock quantity.

Evidence: `node dist/scripts/import-current-allegro-stock-to-warehouse.js --all-accounts --dry-run --verify-warehouse --detail-limit 1000 --list-limit 100` returned `stockAuthoritativeAppearances=27`, `uniqueStockAuthoritativeOffers=9`, `duplicateStockAuthoritativeAppearances=18`, `stockAuthoritativeTotal=496`, `wouldSet=9`, `warehouseMatches=9`, `warehouseMismatches=0`, and no errors. `node dist/scripts/audit-current-stock-source.js --all-accounts --detail-limit 1000 --list-limit 100` returned 3 configured accounts; each saw the same 9 ACTIVE offer IDs, INACTIVE/ENDED/ACTIVATING counts were 0, and each account stock total was 496. A separate no-status `/sale/offers` read also returned exactly 9 unique offers and 496 listed stock for each configured account. `/sale/product-offers` list-style probing is not a usable listing source in this runtime; it returns HTTP 405, so `/sale/offers` discovery plus `/sale/product-offers/{offerId}` detail remains the current Allegro source contract.

Decision: there is no additional hidden 500-offer Allegro source in the configured accounts. Warehouse already matches all 9 Allegro current-stock-authoritative offers. Historical order-only rows remain non-authoritative for current stock. Also patched `audit-current-stock-source.ts` so future larger accounts compute unique current-stock totals from all detailed offer stock rows instead of the display sample cap, and so the audit reports unfiltered `/sale/offers` counts alongside publication-status filtered counts.

Deployment/validation: committed and deployed `de214fb` (`fix: report full allegro stock audit counts`). Deployment completed successfully for Allegro service, API gateway, settings, imports, and frontend. Deployed patched audit returned `mutates=false`, `unfilteredListedOffers=27`, `unfilteredListedStockTotal=1488`, `stockAuthoritativeOffers=27`, `stockAuthoritativeTotal=1488`, `uniqueStockAuthoritativeOffers=9`, `uniqueStockAuthoritativeTotal=496`, `duplicateStockAuthoritativeAppearances=18`, `detailErrors=0`, and no account errors. Deployed Warehouse dry-run verifier still returned `mutatesWarehouse=false`, `stockAuthoritativeAppearances=27`, `uniqueStockAuthoritativeOffers=9`, `stockAuthoritativeTotal=496`, `wouldSet=9`, `warehouseMatches=9`, `warehouseMismatches=0`, and no errors.

Boundary: read-only Allegro/API probes and audit script deployment only; no Warehouse apply, local Allegro projection mutation, Allegro write API, account activation/token refresh, Catalog write, or order forwarding was run.

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
- HTTP offer import approval routes: body `confirmCatalogApply=ALLEGRO_HTTP_OFFER_IMPORT_CATALOG_APPLY`.
- Central order forwarding: `forwardToOrdersMicroservice=true` plus `ALLEGRO_ORDER_FORWARDING_TO_ORDERS_MICROSERVICE`.

## Blockers

- `[MISSING: durable central order forwarding attempt/status storage]`
- `[MISSING: orders.create.v1 duplicate/equality confirmation from orders-microservice]`
- `[MISSING: preview-token governed service/controller import approval routes]`
- `[MISSING: governed recurring stock sync and Allegro quantity command write-back]`
- Pre-existing TASK-009 IPS audit debt remains outside TASK-010 scope.
