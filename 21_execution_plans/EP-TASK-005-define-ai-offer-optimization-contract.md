# EP-TASK-005: AI Offer Optimization Contract Execution Plan

```yaml
id: EP-TASK-005
status: validated
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-19
completeness_level: validated
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-005-ai-assisted-offer-optimization.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-005.md
```

## Metadata

- Source task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
- Status: approved for implementation by owner instruction on 2026-06-19.
- Lifecycle state: implemented and validated as a contract-first artifact set; no live AI runtime integration or deployment is included in TASK-005.

## Upstream Traceability

- Constitution: ../00_constitution/CONSTITUTION.md
- Vision: ../01_vision/VISION.md
- Business case: ../02_business_case/BUSINESS_CASE.md
- Roadmap: ../08_roadmap/ROADMAP.md
- Feature: ../10_features/FEAT-005-ai-assisted-offer-optimization.md
- Goal impact: ../22_goal_impact/GOAL-IMPACT-TASK-005.md

## Goal Impact

Discover and define a redacted ai-microservice contract for draft-only listing recommendations and review states. This supports the revenue roadmap by improving publish reliability, conversion readiness, operational visibility, or profit protection for Allegro sales.

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

Contract or schema impact must be documented before implementation. Validate affected DTOs, service clients, Prisma schema changes, event payloads, or external service contracts with synthetic fixtures and store evidence under 12_validation or reports/validation.

## Replay/Determinism Plan

All write-like operations must be idempotent or have durable attempt records. Read-only contract discovery must define deterministic fixtures. Event emission must include idempotency or correlation keys where downstream consumers may replay data.

## Scope

Discover and define a redacted ai-microservice contract for draft-only listing recommendations and review states.

## Non-Goals

- Do not modify protected vision or constitution files.
- Do not add production secrets, raw customer data, raw order data, or OAuth tokens.
- Do not change service ownership boundaries without ADR.
- Do not add unrelated runtime behavior outside the task scope.

## Files to Inspect

- 08_roadmap/ROADMAP.md
- 16_operations/INTEGRATIONS.md
- 17_governance/PROJECT_INVARIANTS.md
- prisma/schema.prisma
- services/allegro-service/src/allegro/
- shared/clients/

## Files to Create

- 12_validation/VAL-TASK-005-validation-report.md
- services/allegro-service/src/allegro/ai-offer-optimization/ai-offer-optimization.contract.ts
- services/allegro-service/src/allegro/ai-offer-optimization/ai-offer-optimization.spec.ts
- reports/validation/TASK-005-validation-evidence.md when generated evidence is needed

## Files to Modify

- 11_tasks/TASK-005-define-ai-offer-optimization-contract.md
- 12_validation/VAL-TASK-005-validation-report.md
- 13_context_packages/CP-TASK-005-ai-offer-optimization-contract.md
- 14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md
- 16_operations/INTEGRATIONS.md
- 21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
- 22_goal_impact/GOAL-IMPACT-TASK-005.md
- Task-scoped validation reports
- TASKS.md and STATE.json when status changes

## Files That Must Not Be Modified

- 00_constitution/CONSTITUTION.md
- 01_vision/VISION.md
- Real production secret files or Vault-managed values
- Unrelated service modules outside the task scope

## Implementation Steps

1. Re-read upstream roadmap, feature, task, goal-impact, and invariants.
2. Confirm affected contracts and source-of-truth ownership.
3. Design the smallest task-scoped implementation or contract artifact.
4. Add synthetic fixtures and validation coverage.
5. Run the IPS gates and targeted tests.
6. Record validation evidence and deviations.

## Test Plan

- Run npm run ips:audit.
- Run npm run ips:pre-coding.
- Run targeted unit or contract tests for the affected implementation.
- Run npm run ips:readiness before deployment or closure.

## Parallel Planning

| Lane | Status | Owner role | Objective | Allowed scope | Forbidden scope | Expected evidence | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-005-A | Complete | Contract discovery worker | Define the ai-microservice request/response envelope for draft-only offer suggestions, including snapshot hash, model metadata, and review status fields. | `16_operations/INTEGRATIONS.md`, `services/allegro-service/src/allegro/`, TASK-005 docs. | No runtime route, queue, Prisma, or publish-lifecycle mutation changes. | `ai-offer-optimization.contract.ts` request/response types and synthetic fixture set. | None. |
| TASK-005-B | Complete | Data-safety worker | Define redaction, prompt-input minimization, and synthetic-fixture rules for AI suggestion inputs and outputs. | Sensitive-data policy, lifecycle/policy docs, TASK-005 docs, validation artifacts. | No production prompt capture, no secrets, no raw marketplace payloads, no customer/order data. | Redaction helpers plus spec assertions for token/email masking and advisory-only fixtures. | None. |
| TASK-005-C | Complete | Review-state worker | Define local suggestion lifecycle states, approval path, rollback notes, and measurable metrics before any AI suggestion can influence publishable data. | Allegro lifecycle/policy docs, existing draft/publish state modules, TASK-005 docs. | No automatic approval path, no direct Allegro mutation, no autonomous price change policy. | Approval-gated local suggestion-record design and lifecycle handoff payload builder. | None. |
| TASK-005-D | Complete | Validation owner | Merge A-C into final contract wording, add synthetic validation fixtures/tests, and rerun IPS gates. | TASK-005 plan/report/docs plus task-scoped validation files. | No deploy and no external ai-microservice runtime dependency. | IPS gates, targeted spec, build, and deployment-readiness evidence recorded in validation. | Requires A-C handoffs or equivalent integrated review. |
| TASK-005-E | Complete | Coordinator | Update `TASKS.md`, `STATE.json`, and integration notes once TASK-005 contract wording is implemented and validated. | Coordinator-owned state/docs only. | Do not overclaim autonomous publish or production runtime rollout. | Clean state transition and next-focus wording. | After D. |

Shared files/contracts: `16_operations/INTEGRATIONS.md`, `21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md`, `12_validation/VAL-TASK-005-validation-report.md`, `TASKS.md`, and `STATE.json` are single-owner integration artifacts. Prisma schema, queue workers, publish lifecycle services, and live ai-microservice clients remain untouched in this contract-first completion batch.

## Validation Plan

Validation succeeds when IPS gates, targeted tests, and sensitive-data checks pass, and when evidence is stored in the matching validation report. Contract-first tasks may close with approved contracts and synthetic fixtures before runtime coding begins.

## Gate Commands

```bash
npm run ips:audit
npm run ips:pre-coding
npm run ips:readiness
```

## Documentation Updates

Update the source task, feature, goal-impact record, validation report, TASKS.md, and STATE.json when implementation status changes. Update 16_operations/INTEGRATIONS.md when new contracts become approved.

## Rollback Plan

Revert task-scoped code and schema changes. Disable new routes, workers, or event emitters by configuration when available. Preserve audit records long enough for incident review if production attempts were created.

## Agent Handoff Prompt

Implement TASK-005 as a contract-first advisory AI slice. Keep AI suggestions advisory until reviewed and policy-confirmed, and hand approved changes into lifecycle-gated updates instead of direct marketplace mutation.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented
