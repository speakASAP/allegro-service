# Allegro Catalog Source Options Validation

Date: 2026-07-02
Role: worker agent
Remote repo: `/home/ssf/Documents/Github/allegro`

## Intent Preservation Chain

- Vision: shared Catalog-backed product sourcing in every e-commerce dashboard.
- Goal Impact: Allegro sellers can select own, Alfares/company, and community resale Catalog products without losing current-user publish ownership.
- System: Catalog owns product source/resale truth; Allegro owns marketplace draft and guarded publish flow.
- Feature: dashboard source filters, Catalog management entry points, and sell-action Catalog access checks.
- Task: implement missing personal-cabinet Catalog source/resale options in Allegro.
- Execution Plan: use the saved cross-repo plan and touch only the allowed Allegro frontend/API/sell-action client files.
- Coding Prompt: preserve dirty worktree files, do not deploy, and mark unavailable contracts as `[MISSING: ...]` or `[UNKNOWN: ...]`.
- Code: see worker diff for `ProductsPage.tsx`, frontend `api.ts`, `catalog-sell-action`, and shared Catalog client token forwarding.
- Validation: see final worker report for command results.

## Requirement Matrix

| Requirement | Allegro result after this worker |
|---|---|
| R1 Alfares/company Catalog products | Source checkbox and quick filter for `alfares`; frontend sends `catalogSources=alfares` while retaining `catalogScope=effective`. |
| R2 Upload/manage own products | External Catalog Dashboard links added for manage products and add product: `https://catalog.alfares.cz/dashboard/products`, `https://catalog.alfares.cz/dashboard/products/new`. |
| R3 Publish own products for common resale | Allegro routes users to Catalog source/resale settings and labels selected product resale state. `[MISSING: local Allegro resale mutation path]` |
| R4 Load/select own, community, company products | Source checkboxes cover `own`, `alfares`, and `community`, and API fallback keeps the effective product load if `catalogSources` is rejected. |
| R5 Non-owned products read-only in Catalog | Allegro exposes source selection and draft creation only; Catalog record mutation remains outside this page. `[UNKNOWN: Catalog runtime owner-only enforcement not smoke-tested in this worker]` |
| R6 Channel publication remains user-owned | Existing Allegro draft/publish controls remain bound to the authenticated user's Allegro account choices. |

## Remaining Blockers

- `[MISSING: local Allegro resale mutation path]` - no existing Allegro frontend/API path updates Catalog product `resaleEnabled`; owner changes remain in Catalog Dashboard.
- `[MISSING: catalog sell-action human-scope enforcement]` - sell-action now forwards the human bearer token and `catalogScope=effective` into Catalog product reloads, but final enforcement depends on Catalog honoring that token alongside the internal service token.
- `[UNKNOWN: authorized end-to-end runtime token]` - no authenticated browser/API smoke token was available in this worker session.
