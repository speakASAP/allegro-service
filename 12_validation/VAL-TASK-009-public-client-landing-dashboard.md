# VAL-TASK-009: Public Client Landing And Dashboard Validation Report

```yaml
id: VAL-TASK-009
status: live_validated
source_task: ../11_tasks/TASK-009-public-client-landing-dashboard.md
execution_plan: ../21_execution_plans/EP-TASK-009-public-client-landing-dashboard.md
created: 2026-06-27
last_updated: 2026-06-27
completeness_level: live_validated
sensitive_data_classification: synthetic
```

Validation id: VAL-TASK-009
Target: TASK-009
Date: 2026-06-27
Validator: integration owner

## Summary

Landing, dashboard, API gateway, frontend runtime manifests, and deploy integration are live validated on 2026-06-27. The final deployment runs `allegro-service`, `allegro-api-gateway`, and `allegro-frontend` from image tag `829b701`; ingress routes `/api` to API gateway, `/health` to backend, and `/` to frontend. Public smoke proves the landing, registration/login SPA routes, dashboard, dashboard products route, backend health, and API gateway health are reachable on `https://allegro.alfares.cz`.

## Upstream Goal

TASK-009 supports FEAT-009 by making the Allegro service visible and usable for registered sellers while preserving Catalog validation and governed publish lifecycle controls.

## Criteria To Check

| Criterion | Result | Evidence |
|---|---|---|
| Public landing served at `/` | Pass | `curl -i https://allegro.alfares.cz/` returned `HTTP/2 200` and frontend HTML on 2026-06-27. |
| Registration/sign-in routes available | Pass | `/register` and `/login` returned `HTTP/2 200` frontend HTML; `/api/auth/register` returned API JSON through gateway. |
| Dashboard route available | Pass | `/dashboard` and `/dashboard/products` returned `HTTP/2 200` frontend HTML. |
| Catalog product selection flow present | Source pass | `ProductsPage.tsx` uses `/api/allegro/products`, which Allegro backend maps through `CatalogClientService.searchProducts()`. |
| Guarded prepare/confirm semantics preserved | Source pass | UI separates prepare, draft edit, status, and explicit confirm; targeted `catalog-sell-action.spec.ts` passed. |
| Frontend build passes | Pass | `cd services/frontend && npm run build` passed on 2026-06-27. |
| Sensitive data excluded | Pass | Validation commands and docs used paths, status, and synthetic descriptions only; no token values were printed. |

## Gate Evidence

- `git diff --check`: PASS on 2026-06-27.
- `cd services/frontend && npm run build`: PASS on 2026-06-27.
- `kubectl apply --dry-run=server -f k8s/api-gateway-deployment.yaml -f k8s/api-gateway-service.yaml -f k8s/frontend-deployment.yaml -f k8s/frontend-service.yaml -f k8s/ingress.yaml -n statex-apps`: PASS on 2026-06-27.
- `docker build -t localhost:5000/allegro-service:task009-validate .`: PASS on 2026-06-27.
- `docker build -f services/api-gateway/Dockerfile -t localhost:5000/allegro-api-gateway:task009-validate .`: PASS on 2026-06-27.
- `docker build -f services/frontend/Dockerfile --build-arg FRONTEND_API_URL=https://allegro.alfares.cz/api -t localhost:5000/allegro-frontend:task009-validate .`: PASS on 2026-06-27.
- `cd services/allegro-service && npm run build`: PASS on 2026-06-27.
- `npx ts-node services/allegro-service/src/allegro/catalog-sell-action/catalog-sell-action.spec.ts`: PASS on 2026-06-27 with `.env` loaded; shell emitted non-fatal warnings from non-shell-compatible `.env` lines before the spec PASS.
- `./scripts/deploy.sh`: PASS on 2026-06-27 after deploy hardening; final deployment image tag `829b701`.
- `kubectl -n statex-apps get deploy allegro-service allegro-api-gateway allegro-frontend`: PASS; all three deployments showed `ready=1 updated=1 available=1` with image tag `829b701`.
- `kubectl -n statex-apps get endpoints allegro-service allegro-api-gateway allegro-frontend`: PASS; endpoints existed for backend `:3403`, API gateway `:3411`, and frontend `:3410`.
- `curl -i https://allegro.alfares.cz/`: PASS; `HTTP/2 200` frontend HTML.
- `curl -i https://allegro.alfares.cz/login`: PASS; `HTTP/2 200` frontend HTML.
- `curl -i https://allegro.alfares.cz/register`: PASS; `HTTP/2 200` frontend HTML.
- `curl -i https://allegro.alfares.cz/dashboard`: PASS; `HTTP/2 200` frontend HTML.
- `curl -i https://allegro.alfares.cz/dashboard/products`: PASS; `HTTP/2 200` frontend HTML.
- `curl -i https://allegro.alfares.cz/health`: PASS; `HTTP/2 200` backend JSON.
- `curl -i https://allegro.alfares.cz/api/health`: PASS; `HTTP/2 200` API gateway JSON.
- `curl -i https://allegro.alfares.cz/api/allegro/products`: PASS for protected route wiring; returned `HTTP/2 401`, proving the gateway/backend route is present and auth-protected rather than missing or crashing.
- Frontend asset check: PASS; deployed JS bundle contains `Alfares Allegro`, `Allegro`, `Catalog`, `Publish`, and `dashboard/products` strings.

## Invariant Evidence

- ALG-INV-001: Source pass. Product selection routes through Allegro backend `CatalogClientService`; publish preparation uses guarded catalog-sell action.
- ALG-INV-002: Source pass. UI does not implement rate-limit bypass; it delegates prepare/confirm to backend lifecycle endpoints.
- ALG-INV-004: Source pass. No secrets, OAuth tokens, raw logs, customer data, payment details, or raw order payloads were added to docs or UI examples.
- ALG-INV-006: Traceability scaffold exists before coding.
- ALG-INV-007: Source validation evidence recorded; closure remains blocked until deploy and route smoke evidence are recorded.

## Issues Found

- Initial live state: root, login, and dashboard routes on `allegro.alfares.cz` returned backend 404 because ingress pointed directly to the backend service.
- Earlier TASK-009 deployment attempts temporarily produced public `/` 503 while ingress pointed to frontend without ready endpoints; deploy script now applies ingress only after successful rollouts.
- Earlier Kubernetes/container runtime delays were resolved enough for final rollout; final live state has ready pods and endpoints for all three services.
- Existing backend `catalog-sell-action` files were already dirty before TASK-009 integration; integration owner classified them as required completion work because the dashboard depends on product-scoped status, draft update, and confirm routes.

## Recommendation

TASK-009 can close from a deployment perspective. Remaining product behavior work should be opened as follow-up tasks only if owner wants deeper authenticated user-flow validation with real seller accounts and Catalog fixtures.

## Source Validation Notes

- Worker A implemented landing page only and reported frontend build plus targeted diff check passing.
- Worker B implemented dashboard/products/API helper flow and reported frontend build plus targeted diff check passing.
- Integration owner added API Gateway and frontend Kubernetes manifests plus deploy-script image build/push integration.
- Existing dirty backend `catalog-sell-action` changes were validated because the new dashboard depends on product-scoped status, draft update, and confirm routes.

## Deployment Status

Deployed and smoke validated. `https://allegro.alfares.cz/` serves the Allegro frontend; `/api` routes to API gateway; `/health` routes to backend. Runtime images are aligned to `829b701` on 2026-06-27.
