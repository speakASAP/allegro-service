# Allegro Goal 25 Catalog Quality Blocker Validation

Date: 2026-07-03
Role: Allegro channel consumer worker
Remote repo: `/home/ssf/Documents/Github/allegro`
Deploy: not run

## Intent Preservation Chain

- Vision: shared Catalog quality/readiness prevents incomplete products from entering any sales channel.
- Goal Impact: Allegro draft, prepare, confirm, queue, and publish-adjacent mutations fail closed when Catalog reports mandatory blockers or readiness is unavailable.
- System: Catalog owns product quality/readiness; Allegro owns marketplace policy, local drafts, governed lifecycle attempts, queueing, and Allegro API mutations.
- Feature: Catalog Goal 25 product quality blocker consumer in Allegro.
- Task: complete fail-closed blocker consumption across catalog-sell and legacy publish-adjacent paths.
- Execution Plan: reuse existing catalog-sell quality preflight and governed lifecycle; close local draft bypass; require explicit `canPublish === true`; add focused synthetic specs.
- Coding Prompt: remote-only Allegro repo work, no deploy, no destructive commands, no secret output, preserve dirty worktree ownership.
- Code: see `CatalogSellActionService`, `PublishLifecycleService`, `MarketplacePolicyEngineService`, `OffersService`, DTO, and focused specs in this commit.
- Validation: focused `ts-node` specs, service build, and `git diff --check` must pass before commit/push.

## Result

| Mutation surface | Fail-closed behavior |
|---|---|
| Catalog sell-action prepare / bulk prepare | Blocks before draft creation when Catalog mandatory blockers exist or readiness is unavailable. |
| Product-scoped draft edit | Blocks when the status preflight is blocked/unavailable. |
| Product-scoped confirm | Blocks before confirmation when the status preflight is blocked/unavailable. |
| Direct lifecycle prepare / confirm / execute | Policy and lifecycle guards block when Catalog quality is blocked, unknown, or unavailable before queue/terminal mutation. |
| Legacy publish-all / sync-to-Allegro / remote-affecting update | Routed through governed lifecycle guards. |
| Local-only Catalog draft create | Blocks before local draft persistence when `catalogProductId` is present and Catalog quality is blocked/unavailable. |

## Remaining Blockers

- `[UNKNOWN: live authenticated runtime token]` - this worker used synthetic focused validation and did not perform authenticated live mutation smoke.
- `[UNKNOWN: Catalog production readiness payload drift after this commit]` - guarded code requires `canPublish === true` from the Catalog preflight derived from readiness.


## Validation Evidence

| Command | Result |
|---|---|
| `LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/catalog-sell-action/catalog-sell-action.spec.ts` | `catalog-sell-action.spec: PASS` |
| `LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/publish-lifecycle/publish-lifecycle.update-terminal.spec.ts` | `publish-lifecycle.update-terminal.spec: PASS` |
| `LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/policy/policy-engine.spec.ts` | `policy-engine.spec: PASS` |
| `LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/offers/offers.catalog-quality.spec.ts` | `offers.catalog-quality.spec: PASS` |
| `cd services/allegro-service && LOGGING_SERVICE_URL=http://logging-microservice:3367 npm run build` | `tsc && tsc-alias` passed |
| `git diff --check` | passed |
| `npm run ips:audit` | PASS, score 100/100, 80 files checked |
| `npm run ips:pre-coding` | PASS, report written to `reports/validation/ips-pre-coding-gate.json` |
