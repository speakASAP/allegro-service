# VAL-TASK-009: Public Client Landing And Dashboard Validation Report

```yaml
id: VAL-TASK-009
status: source_validated
source_task: ../11_tasks/TASK-009-public-client-landing-dashboard.md
execution_plan: ../21_execution_plans/EP-TASK-009-public-client-landing-dashboard.md
created: 2026-06-27
last_updated: 2026-06-27
completeness_level: source_validated
sensitive_data_classification: synthetic
```

Validation id: VAL-TASK-009
Target: TASK-009
Date: 2026-06-27
Validator: integration owner

## Summary

Landing, dashboard, API gateway, frontend runtime manifests, and deploy integration have source-level validation. Initial live evidence showed `https://allegro.alfares.cz/` returned backend `404 Cannot GET /`, while `https://allegro.alfares.cz/health` returned healthy service JSON. This task must not close until deployment and public route smoke prove the domain serves the frontend.

## Upstream Goal

TASK-009 supports FEAT-009 by making the Allegro service visible and usable for registered sellers while preserving Catalog validation and governed publish lifecycle controls.

## Criteria To Check

| Criterion | Result | Evidence |
|---|---|---|
| Public landing served at `/` | Pending deploy | Source implemented in `services/frontend/src/pages/LandingPage.tsx`; [MISSING: post-deploy route smoke] |
| Registration/sign-in routes available | Source pass | React routes exist and frontend build passed; [MISSING: post-deploy route smoke] |
| Dashboard route available | Source pass | React dashboard shell updated and frontend build passed; [MISSING: post-deploy route smoke] |
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
- `curl -I https://allegro.alfares.cz/`: [MISSING: post-deploy result].
- `curl -fsS https://allegro.alfares.cz/health`: [MISSING: post-deploy result].

## Invariant Evidence

- ALG-INV-001: Source pass. Product selection routes through Allegro backend `CatalogClientService`; publish preparation uses guarded catalog-sell action.
- ALG-INV-002: Source pass. UI does not implement rate-limit bypass; it delegates prepare/confirm to backend lifecycle endpoints.
- ALG-INV-004: Source pass. No secrets, OAuth tokens, raw logs, customer data, payment details, or raw order payloads were added to docs or UI examples.
- ALG-INV-006: Traceability scaffold exists before coding.
- ALG-INV-007: Source validation evidence recorded; closure remains blocked until deploy and route smoke evidence are recorded.

## Issues Found

- Initial live state: root, login, and dashboard routes on `allegro.alfares.cz` returned backend 404 because ingress points directly to the backend service.
- Existing backend `catalog-sell-action` files were already dirty before TASK-009 integration and must be treated as pre-existing or concurrently owned changes unless the integration owner classifies them as required completion work.

## Recommendation

Keep TASK-009 active until worker outputs are integrated, frontend serving is fixed, and live route smoke evidence is recorded.

## Source Validation Notes

- Worker A implemented landing page only and reported frontend build plus targeted diff check passing.
- Worker B implemented dashboard/products/API helper flow and reported frontend build plus targeted diff check passing.
- Integration owner added API Gateway and frontend Kubernetes manifests plus deploy-script image build/push integration.
- Existing dirty backend `catalog-sell-action` changes were validated because the new dashboard depends on product-scoped status, draft update, and confirm routes.

## Deployment Status

Pending. Source is ready for commit/deploy, but live route evidence must be appended after deployment.
