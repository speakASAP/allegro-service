# TASK-008-C MinIO Media Handoff

## Intent Preservation Chain

- Vision: [MISSING: `01_vision/VISION.md` content was not re-opened in this scoped lane]
- Goal Impact: `22_goal_impact/GOAL-IMPACT-TASK-008.md`
- System: [MISSING: `04_systems/SYS-001-allegro-marketplace-integration.md` content was not re-opened in this scoped lane]
- Feature: `10_features/FEAT-008-operations-trust-and-scale.md`
- Task: `11_tasks/TASK-008-plan-operations-trust-and-scale.md`
- Execution Plan: `21_execution_plans/EP-TASK-008-plan-operations-trust-and-scale.md`
- Coding Prompt: [MISSING: no approved TASK-008 runtime prompt exists; this is a planning handoff only]
- Code: existing media dependencies only; no MinIO runtime client or DTO is approved in this repo
- Validation: synthetic contract discovery evidence only; no repo-wide IPS gates were run in this lane by design

## Readiness Judgment

TASK-008-C is ready for integration-owner synthesis and later contract review, but not for runtime implementation. The repo has clear media dependency anchors and ownership boundaries, yet it still lacks the approved MinIO endpoint, auth, schema, and retention contract required by FEAT-008 before any runtime dependency can be introduced.

## Media Dependency And MinIO Contract Matrix

| Surface | Current evidence | Current owner/boundary | Contract need for MinIO lane | Status |
| --- | --- | --- | --- | --- |
| Catalog product media fetch | `shared/clients/catalog-client.service.ts` calls `GET {catalog}/api/media/product/{productId}` and treats missing media as optional. | `catalog-microservice` owns product media source. | Decide whether MinIO stores copies, derivatives, or only approved publish-ready variants after catalog approval. | Blocked on MinIO contract. |
| Local draft media extraction | `services/allegro-service/src/allegro/catalog-sell-action/catalog-sell-action.service.ts` collects `catalogProduct.images` and `catalogProduct.media`, normalizes URL-like entries, and stores up to 16 image URLs in draft state. | `allegro-service` may stage image URLs locally; catalog remains upstream source. | Define allowed future MinIO input shape: source URL list, approved asset ids, or derivative manifest. | Partially ready. |
| Publish policy media gate | `services/allegro-service/src/allegro/policy/policy-engine.service.ts` warns when no local image evidence exists and assigns ownership to `catalog-microservice`. | `catalog-microservice` currently owns media-readiness evidence. | Decide whether MinIO readiness becomes a separate gate or stays supporting evidence under catalog ownership. | Blocked on owner decision. |
| Allegro offer create payload | `services/allegro-service/src/allegro/offers/offers.service.ts` requires at least one image and normalizes it to `{ url }` payloads. | `allegro-service` owns outbound Allegro payload assembly, not media generation. | Define whether MinIO outputs must be public URLs, signed URLs, copied CDN assets, or another stable representation accepted by Allegro create flows. | Blocked on endpoint/payload contract. |
| Allegro offer update payload | `services/allegro-service/src/allegro/offers/offers.service.ts` strips `images` from PATCH because Allegro rejects image updates there. | Allegro API behavior constrains update path. | Contract must define whether media changes are create-only, replace/relist, or use another approved workflow. | Blocked on external API workflow decision. |
| Local offer persistence | `prisma/schema.prisma` stores `images Json?` as a JSON URL array. | `allegro-service` persists publishable image references, not binary media. | Decide whether future MinIO identifiers remain URLs only or require richer metadata storage and ADR-backed schema change. | Blocked on schema contract. |
| Planned MinIO integration boundary | `08_roadmap/ROADMAP.md` and `16_operations/INTEGRATIONS.md` list `minio-microservice` as a planned outbound dependency for approved offer media and generated variants. | `minio-microservice` is planned only; not implemented in runtime code. | Approve API, ownership, retention, redaction, and failure behavior before any runtime dependency. | Not implemented. |

## Existing Repo References

- `08_roadmap/ROADMAP.md`: Stage 6 adds a MinIO-backed media pipeline only if catalog/media contracts require it.
- `10_features/FEAT-008-operations-trust-and-scale.md`: media/MinIO integration must be contract-approved before runtime dependency.
- `11_tasks/TASK-008-plan-operations-trust-and-scale.md`: scope includes MinIO/media contract discovery; non-goal forbids media storage implementation until approval.
- `21_execution_plans/EP-TASK-008-plan-operations-trust-and-scale.md`: TASK-008-C output must be a media contract matrix with blocked facts explicit.
- `16_operations/INTEGRATIONS.md`: planned boundary says `minio-microservice` is outbound only for approved offer media and generated image variants.
- `shared/clients/catalog-client.service.ts`: current upstream product media source.
- `services/allegro-service/src/allegro/catalog-sell-action/catalog-sell-action.service.ts`: current draft image extraction path.
- `services/allegro-service/src/allegro/policy/policy-engine.service.ts`: current media-readiness semantics and owner label.
- `services/allegro-service/src/allegro/offers/offers.service.ts`: strongest current downstream constraint because create requires images and PATCH strips them.
- `prisma/schema.prisma`: current persistence shape for offer images.

## Ownership Boundaries

- `catalog-microservice` remains the current source of product media and the named owner for media-readiness evidence in publish policy.
- `allegro-service` currently normalizes and persists media references for local drafts and outbound Allegro create payloads, but it does not generate, transform, or store binary media through MinIO.
- `minio-microservice` is only a planned outbound boundary in roadmap and operations docs; no runtime code, client, DTO, schema, or approved endpoint exists in this repo.
- Any change that moves media ownership or introduces a new runtime boundary still requires ADR review under `ALG-INV-005`.

## Blocked Facts

- [MISSING: approved MinIO endpoint path, method set, and auth model]
- [MISSING: contract owner for MinIO media schema and versioning]
- [MISSING: whether MinIO stores originals, transformed variants, or metadata only]
- [MISSING: approved source-of-truth field between catalog media ids, raw URLs, and MinIO asset ids]
- [MISSING: approved retention and deletion lifecycle for generated variants]
- [MISSING: copyright and provenance policy for re-storing catalog or Allegro-originated images]
- [MISSING: failure-handling owner when MinIO derivative generation fails but catalog media exists]
- [UNKNOWN: whether a MinIO contract already exists outside this repo in another service or ADR set]
- [UNKNOWN: whether downstream AI image-upgrade suggestions should ever route through MinIO or remain advisory only]

## Contract Discovery Requirements For TASK-008-E

1. Confirm the authoritative owner for media approval, derivative generation, and asset retention.
2. Define a versioned request and response contract between `allegro-service` and `minio-microservice`.
3. Resolve how catalog media identifiers map to Allegro-ready image URLs without exposing secrets.
4. Define whether image updates require a new offer lifecycle because current PATCH handling strips `images`.
5. Decide whether current `images Json?` storage is sufficient or whether a richer asset manifest needs an ADR-backed schema change.

## Synthetic Validation Cases Only

| Case | Synthetic input | Expected outcome |
| --- | --- | --- |
| Catalog-only media path | Catalog product returns two HTTPS image URLs and no MinIO metadata. | Draft preparation accepts URLs; contract review records that MinIO is optional until an approved derivative workflow exists. |
| Missing media path | Catalog product returns empty `images` and `media` arrays. | Policy result remains `WARN` for `media-readiness`; no MinIO fallback is assumed without contract approval. |
| MinIO derivative proposal | Synthetic contract response returns `assetId`, `variant`, `publicUrl`, `checksum`, and `contractVersion`. | Integration owner can compare whether current `images Json?` URL-array storage is sufficient or needs richer metadata. |
| Secret-safe evidence | Synthetic MinIO response includes placeholder bucket and object names only, with no credentials or signed query strings. | Sensitive-data scan passes and evidence remains compliant with `ALG-INV-004`. |
