# W5b: Allegro Availability Reconciliation Safety Net

## Intent Preservation Chain

- Vision: Allegro must not keep locally sellable offers when Catalog or Warehouse authority says the product is not sellable.
- Goal Impact: Missed Catalog or Warehouse events can be corrected by a manual or periodic reconciliation pass.
- System: `allegro-service` local projection only; Catalog owns product state and Warehouse owns physical availability.
- Feature: Source-level reconciliation safety net for local Allegro offers with `catalogProductId`.
- Task: Scan internally sellable local offers, read Catalog product state and Warehouse available stock, and fail-close stale local projections.
- Execution Plan: Add a service plus CLI script, keep apply mode confirmation-gated, record audit and blocked END attempts, and avoid live Allegro mutation.
- Coding Prompt: W5b worker prompt from owner on 2026-07-02.
- Code: `AvailabilityReconciliationService` and `reconcile-catalog-availability.ts`.
- Validation: Focused service spec, existing W4b subscriber specs, backend/shared builds, and `git diff --check`.

## Operating Contract

Dry-run:

```bash
cd services/allegro-service
npm run reconcile:availability -- --dry-run
```

Apply local fail-close only:

```bash
cd services/allegro-service
npm run reconcile:availability -- --apply --confirm-local-fail-close ALLEGRO_AVAILABILITY_RECONCILE_LOCAL_FAIL_CLOSE
```

Apply mode may write only:

- `allegro_offers`
- `allegro_projection_audit_logs`
- `allegro_publish_attempts`

It must not write Catalog, Warehouse, Orders, Payments, BizBox, or live Allegro APIs.

## Fail-Closed Conditions

Local offers are disabled when the Catalog product is missing, inactive, archived, deleted, non-sellable, or when Warehouse total availability is `<= 0`.

Local disabled projection:

- `status = INACTIVE`
- `publicationStatus = INACTIVE`
- `stockQuantity = 0`
- `quantity = 0`
- `syncStatus = PENDING`
- `syncSource = <authority reason>`
- `syncError = [MISSING: Allegro live offer deactivate endpoint/policy confirmation]`

The blocked END attempt records the live Allegro mutation blocker and keeps `mutatesAllegro = false`.

## Parallel Execution

Status: final integration in this worker.

Shared files/contracts:

- `services/allegro-service/src/allegro/allegro.module.ts`
- `services/allegro-service/package.json`
- root `package.json`
- `.env.example`

Integration owner: original thread owner.

Validation owner: W5b worker.

Merge order: integrate after W4b subscriber changes; no parallel edits should touch the same service/module/package files until this lane is reviewed.
