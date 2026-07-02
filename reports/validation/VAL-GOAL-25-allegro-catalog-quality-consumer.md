# VAL-GOAL-25 Allegro Catalog Quality Consumer

```yaml
id: VAL-GOAL-25-ALLEGRO-CATALOG-QUALITY-CONSUMER
status: validated-deployed
created: 2026-07-02
last_updated: 2026-07-02
repository: /home/ssf/Documents/Github/allegro
branch: main
catalog_policy: catalog.product_quality.v1
```

## Intent Preservation Chain

Vision: Catalog remains the Statex product truth service for product identity, sellable content, media references, pricing records, and publication readiness.

Goal Impact: Allegro no longer prepares, edits, confirms, or executes product publication when mandatory Catalog product-quality blockers remain.

System: Catalog owns product quality/readiness; Allegro owns marketplace accounts, local drafts, compliance policy, queueing, and Allegro publication lifecycle.

Feature: Allegro Catalog Goal 25 product quality blocker consumer.

Task: Integrate Allegro product selection, draft preparation, publish confirmation, and queued execution with Catalog Goal 25 blockers.

Execution Plan: Use Catalog-owned policy/readiness data, fail closed on blockers or unavailable quality preflight, surface blockers in existing product status/UI, and preserve Allegro marketplace ownership.

Coding Prompt: Remote-only worker prompt from source thread `019f236a-aa22-7d63-b7d7-4a78357dd3a9`.

Code:
- `shared/clients/catalog-client.service.ts`
- `services/allegro-service/src/allegro/policy/policy-engine.service.ts`
- `services/allegro-service/src/allegro/catalog-sell-action/catalog-sell-action.service.ts`
- `services/allegro-service/src/allegro/publish-lifecycle/publish-lifecycle.service.ts`
- `services/frontend/src/pages/ProductsPage.tsx`
- focused specs under the same Allegro modules

Validation: focused specs, shared build, Allegro service build, frontend build, diff check passed; approved deploy built/pushed images, applied manifests, initially timed out on slow local-registry pulls, then all Allegro deployments rolled out successfully on tag `2e365ac`.

## Implementation Summary

- Added Catalog quality consumer helpers for `catalog.product_quality.v1`, mandatory blocker code normalization, exact product readiness preflight, and the stable review queue client method.
- Added a `catalog-product-quality` policy gate to publish lifecycle preparation.
- Blocked draft preparation before local draft creation when Catalog blockers remain.
- Rechecked quality before local draft edit, product-scoped publish confirmation, generic lifecycle confirmation, and queued execution so stale prepared attempts fail closed.
- Returned `catalogQualityPreflight` from product status/preparation responses.
- Updated Products page controls to display Catalog blocker codes and disable draft/publish actions while blocked.

## Contract Notes

- Mandatory blocker codes consumed: `missing_sku`, `duplicate_sku`, `missing_title`, `missing_description`, `missing_current_price`, `missing_image`, `placeholder_image_only`, `archived_product`, plus forward-compatible `invalid_lifecycle_for_quality`.
- EAN remains optional/non-blocking.
- `GET /api/products/review/quality` is represented by the shared client method and recorded as the review contract endpoint.
- Product-scoped preflight uses existing Catalog `GET /api/products/:id/readiness` because the current Goal 25 review queue DTO has no product id filter. Allegro maps only Catalog-provided issue codes; it does not recalculate Catalog product truth.

## Validation Evidence

```bash
git diff --check
# PASS, no output

LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/catalog-sell-action/catalog-sell-action.spec.ts
# catalog-sell-action.spec: PASS

LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/policy/policy-engine.spec.ts
# policy-engine.spec: PASS

LOGGING_SERVICE_URL=http://logging-microservice:3367 npx ts-node services/allegro-service/src/allegro/publish-lifecycle/publish-lifecycle.update-terminal.spec.ts
# publish-lifecycle.update-terminal.spec: PASS

cd shared && npm run build
# PASS

cd services/allegro-service && LOGGING_SERVICE_URL=http://logging-microservice:3367 npm run build
# PASS

cd services/frontend && npm run build
# PASS
```

Frontend build emitted non-blocking dependency freshness warnings for Vite CJS API, `baseline-browser-mapping`, and Browserslist/caniuse-lite age.

## Parallel Execution

Status: final integration in this worker.

Reason: the safe implementation touched shared Catalog client declarations, policy engine, sell-action, lifecycle confirmation, and Products page controls. Splitting those edits across agents would have created shared-file and shared-contract conflicts.

Integration owner: current worker.

Validation owner: current worker.

Merge order: single batch.

## Blockers And Unknowns

- `[UNKNOWN: live Catalog runtime response shape]` source validation used the current Catalog source contract and Allegro synthetic tests; no live authenticated product-flow smoke was run. Public frontend/API/service health smoke passed.
- `[KNOWN: deploy script timeout recovered]` `./scripts/deploy.sh` exited 1 during rollout wait because local-registry image pulls took about 6-7 minutes. A follow-up read-only `kubectl rollout status` confirmed all Allegro deployments successfully rolled out on `2e365ac`.

## Runtime Smoke Evidence

```bash
curl -k -sS -o /tmp/allegro-smoke-body.txt -w "HTTP %{http_code} time=%{time_total}\n" https://allegro.alfares.cz/
# HTTP 200, frontend HTML returned

curl -k -sS -o /tmp/allegro-smoke-body.txt -w "HTTP %{http_code} time=%{time_total}\n" https://allegro.alfares.cz/api/health
# HTTP 200, {"status":"ok","service":"api-gateway"}

curl -k -sS -o /tmp/allegro-smoke-body.txt -w "HTTP %{http_code} time=%{time_total}\n" https://allegro.alfares.cz/health
# HTTP 200, {"status":"ok","service":"allegro-service"}
```

In-cluster temporary curl pods were also attempted for service DNS targets; the pods cleaned up successfully but the terminal output did not include response bodies, so public ingress and Kubernetes rollout status remain the recorded runtime evidence.

## Deploy Attempt Evidence

```bash
./scripts/deploy.sh
# Built service, API gateway, settings, imports, and frontend images with tag 2e365ac.
# Pushed all 2e365ac and latest tags to localhost:5000.
# Applied Kubernetes manifests and set deployment images.
# Exited 1 after rollout timeout while new 2e365ac pods were still pulling/ContainerCreating.

kubectl rollout status deployment/allegro-service -n statex-apps --timeout=10s
kubectl rollout status deployment/allegro-api-gateway -n statex-apps --timeout=10s
kubectl rollout status deployment/allegro-settings -n statex-apps --timeout=10s
kubectl rollout status deployment/allegro-imports -n statex-apps --timeout=10s
kubectl rollout status deployment/allegro-frontend -n statex-apps --timeout=10s
# All five deployments successfully rolled out after the delayed image pulls completed.
```

## Handoff

Goal 25 source changes are committed as `2e365ac feat: consume catalog quality blockers` and present on `origin/main`. Approved deploy was attempted; the script timed out during slow image pulls, then read-only rollout checks confirmed successful rollout. No rollback or destructive action was run.
