# BPCP Holiday Discount Adoption

Status: service-local adoption contract
Date: 2026-07-02
Service: `allegro`
Central contract pack: `statex-ecosystem/docs/business-process-control-plane/`

## Role

Channel/storefront consumer for BPCP experience slots where products are displayed or sold through Allegro flows.

## Responsibilities

- Render approved holiday slots if this channel exposes customer-facing product/checkout surfaces.
- Never calculate authoritative discounts.
- Preserve channel-specific constraints.

## Required interfaces

- Experience slot fetch/render contract.
- Product badge and optional channel message.
- Checkout/redirect discount display only when backed by pricing result.

## Boundaries

- This service must not become the global owner of BPCP process definitions.
- This service must fail closed on invalid or unknown BPCP process versions.
- This service must keep existing domain ownership and invariants.
- This service must expose or document dry-run behavior before live execution.
- This service must not overwrite existing service contracts without an
  explicit integration owner and validation owner.

## Holiday Discount pilot expectations

- Recognize `holiday-discount-2026` only through versioned BPCP contracts.
- Preserve `processId`, `processVersion`, and `policyId` in every relevant
  decision, event, snapshot, log, or rendered experience.
- Support rollback by respecting BPCP pause and retired states.
- Keep process display and process execution separate where applicable.

## Blockers and unknowns

- [MISSING: whether Allegro channel has direct customer checkout surface for this pilot]

## Validation evidence required before implementation is accepted

- UI smoke for eligible product badge if applicable.
- No discount calculation in channel frontend.
- Unsupported slots are documented.

## Parallel handoff

This adoption doc is safe for a focused service owner to implement in parallel
after the central BPCP schemas are accepted. The service owner must not edit
shared BPCP schemas directly; schema changes go through the BPCP integration
owner.
