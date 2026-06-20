# EP-TASK-005: AI Offer Optimization Contract Execution Plan

```yaml
id: EP-TASK-005
status: validated
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-19
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-005-ai-assisted-offer-optimization.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-005.md
```

## Metadata

- Source task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
- Status: approved for implementation by owner instruction on 2026-06-19.
- Lifecycle state: implemented and validated for TASK-005 closure on 2026-06-19.

## Upstream Traceability

- Constitution: ../00_constitution/CONSTITUTION.md
- Vision: ../01_vision/VISION.md
- Business case: ../02_business_case/BUSINESS_CASE.md
- Roadmap: ../08_roadmap/ROADMAP.md
- Feature: ../10_features/FEAT-005-ai-assisted-offer-optimization.md
- Goal impact: ../22_goal_impact/GOAL-IMPACT-TASK-005.md

## Goal Impact

Define a redacted ai-microservice contract for draft-only listing recommendations and review states. This supports the revenue roadmap by improving publish reliability, conversion readiness, operational visibility, or profit protection for Allegro sales.

## Project Invariants

- ALG-INV-001: Preserve catalog validation before offer mutation where offer data is affected.
- ALG-INV-002: Preserve Allegro account-aware rate limits for API work.
- ALG-INV-003: Preserve orders-microservice as order owner where orders are affected.
- ALG-INV-004: Keep secrets, OAuth tokens, customer data, and raw production logs out of code, docs, tests, prompts, and reports.
- ALG-INV-005: Create ADR before changing runtime ownership boundaries.
- ALG-INV-006: Maintain traceability before coding.
- ALG-INV-007: Collect validation evidence before closure.

## Sensitive-Data Handling

Classification: synthetic. Use synthetic products, offers, accounts, orders, payments, supplier records, events, and errors in tests and documentation. Redact authorization headers, OAuth tokens, client secrets, customer identifiers, payment details, and raw production logs.

## Contract Validation Plan

Contract or schema impact must be documented before implementation. Validate affected DTOs, service clients, event payloads, or external service contracts with synthetic fixtures and store evidence under 12_validation or reports/validation.

## Replay/Determinism Plan

Advisory suggestion records must carry input snapshot hashes, review-state metadata, and model/version metadata so future approvals and rollbacks can be audited even when model outputs vary.

## Scope

Expose a suggestion-only request/response contract plus local review-state record design for Allegro offer optimization without changing runtime ownership boundaries.

## Non-Goals

- Do not modify protected vision or constitution files.
- Do not add production secrets, raw customer data, raw order data, or OAuth tokens.
- Do not change service ownership boundaries without ADR.
- Do not add unrelated runtime behavior outside the task scope.
- Do not add direct publish, queue execution, or Prisma schema mutations in TASK-005.

## Files to Inspect

- 08_roadmap/ROADMAP.md
- 16_operations/INTEGRATIONS.md
- 17_governance/PROJECT_INVARIANTS.md
- services/allegro-service/src/allegro/publish-lifecycle/
- services/allegro-service/src/allegro/policy/
- services/allegro-service/src/allegro/catalog-sell-action/

## Files to Create

- services/allegro-service/src/allegro/ai-offer-optimization/ai-offer-optimization.contract.ts
- services/allegro-service/src/allegro/ai-offer-optimization/ai-offer-optimization.service.ts
- services/allegro-service/src/allegro/ai-offer-optimization/ai-offer-optimization.spec.ts
- 12_validation/VAL-TASK-005-validation-report.md

## Files to Modify

- 11_tasks/TASK-005-define-ai-offer-optimization-contract.md
- 13_context_packages/CP-TASK-005-ai-offer-optimization-contract.md
- 14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md
- 16_operations/INTEGRATIONS.md
- 21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
- 22_goal_impact/GOAL-IMPACT-TASK-005.md
- TASKS.md
- STATE.json

## Files That Must Not Be Modified

- 00_constitution/CONSTITUTION.md
- 01_vision/VISION.md
- Real production secret files or Vault-managed values
- Unrelated service modules outside the task scope
- Prisma schema, queue workers, publish execution code, or external AI clients

## Implementation Steps

1. Re-read upstream roadmap, feature, task, goal-impact, and invariants.
2. Confirm the AI contract remains suggestion-only and lifecycle-gated.
3. Add a task-scoped contract module that whitelists offer input, encodes redaction rules, validates advisory responses, and materializes local review-state records.
4. Add synthetic validation coverage for redaction, invalid direct-mutation attempts, review gating, and deterministic snapshot hashing.
5. Run the IPS gates, targeted spec, and service build.
6. Record validation evidence and update state/docs.

## Test Plan

- Run npm run ips:audit.
- Run npm run ips:pre-coding.
- Run targeted ai-offer-optimization contract tests.
- Run cd services/allegro-service && npm run build.
- Run python3 scripts/deployment_readiness_gate.py --root . --target TASK-005.

## Validation Plan

Validation succeeds when IPS gates, the targeted synthetic contract spec, the service build, and the sensitive-data checks pass, and when evidence is stored in the matching validation report.

## Gate Commands

```bash
npm run ips:audit
npm run ips:pre-coding
cd services/allegro-service && npx ts-node src/allegro/ai-offer-optimization/ai-offer-optimization.spec.ts
cd services/allegro-service && npm run build
python3 scripts/deployment_readiness_gate.py --root . --target TASK-005
```

## Documentation Updates

Update the source task, feature, goal-impact record, validation report, TASKS.md, and STATE.json when implementation status changes. Update 16_operations/INTEGRATIONS.md when new contracts become approved.

## Rollback Plan

Revert the task-scoped AI contract module and documentation updates. No data migration or runtime deploy rollback is required because TASK-005 does not introduce live runtime behavior.

## Agent Handoff Prompt

Implement TASK-005 as a contract-first AI planning slice. Keep AI suggestions advisory, synthetic, redacted, and blocked from direct marketplace mutation.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented
