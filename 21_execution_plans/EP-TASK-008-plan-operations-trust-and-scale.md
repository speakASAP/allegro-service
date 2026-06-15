# EP-TASK-008: Operations Trust And Scale Execution Plan

```yaml
id: EP-TASK-008
status: draft
source_task: ../11_tasks/TASK-008-plan-operations-trust-and-scale.md
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-008-operations-trust-and-scale.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-008.md
```

## Metadata

- Source task: ../11_tasks/TASK-008-plan-operations-trust-and-scale.md
- Status: draft for owner review.
- Lifecycle state: planned; not approved for coding until gate review passes.

## Upstream Traceability

- Constitution: ../00_constitution/CONSTITUTION.md
- Vision: ../01_vision/VISION.md
- Business case: ../02_business_case/BUSINESS_CASE.md
- Roadmap: ../08_roadmap/ROADMAP.md
- Feature: ../10_features/FEAT-008-operations-trust-and-scale.md
- Goal impact: ../22_goal_impact/GOAL-IMPACT-TASK-008.md

## Goal Impact

Plan account-aware rate-limit controls, OAuth health, SLA dashboards, MinIO media contract discovery, deployment smoke, and rollback playbooks. This supports the revenue roadmap by improving publish reliability, conversion readiness, operational visibility, or profit protection for Allegro sales.

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

Plan account-aware rate-limit controls, OAuth health, SLA dashboards, MinIO media contract discovery, deployment smoke, and rollback playbooks.

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

- 12_validation/VAL-TASK-008-validation-report.md
- reports/validation/TASK-008-validation-evidence.md when generated evidence is needed

## Files to Modify

- Task-scoped service files only after approval
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

## Parallel Execution

TASK-008 can run four operations lanes in parallel for rate limits/queues, OAuth health, media contracts, and deployment evidence, followed by an operations integration lane.

- Integration owner: Agent TASK-008-E integration owner.
- Validation owner: Agent TASK-008-E validation owner.
- Merge order: 1. TASK-008-A rate-limit and queue controls lane; 2. TASK-008-B OAuth health lane; 3. TASK-008-C MinIO media contract lane; 4. TASK-008-D smoke and rollback lane; 5. TASK-008-E final integration and validation evidence.
- Shared files/contracts: deployment scripts, k8s manifests, operational gate definitions, 16_operations/INTEGRATIONS.md, validation reports, TASKS.md, and STATE.json. TASK-008-E owns final gate wording and merge order.

| Workstream | Status | Objective | Scope | Allowed files | Forbidden files | Expected output | Dependencies/blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TASK-008-A | Ready now | Rate-limit and queue controls lane | Inspect account-aware Allegro throttling, queue/backpressure controls, and measurable failure modes. Produce control and metric plan only. | Allegro client/rate-limit modules; queue worker references; project invariants. | Do not change runtime throttling behavior without approved coding prompt. | Control map, metric list, synthetic failure-path cases. | None; ready to start now. |
| TASK-008-B | Ready now | OAuth health lane | Inspect OAuth token lifecycle, expiry handling, and alertable health signals. Produce secret-safe monitoring plan. | OAuth services; environment variable references; operational docs. | No raw tokens, secrets, refresh values, or production auth logs. | OAuth risk map, alert candidates, redaction-safe evidence plan. | None; ready to start now. |
| TASK-008-C | Ready now | MinIO media contract lane | Inspect media dependency references and define MinIO/media contract discovery requirements with blocked facts explicit. | 16_operations/INTEGRATIONS.md; media references; MinIO docs/contracts if present in repo. | No media storage implementation until contract is approved. | Media contract matrix and [MISSING: ...] markers for unavailable endpoints or ownership. | None; ready to start now. |
| TASK-008-D | Ready now | Deployment smoke and rollback lane | Inspect deploy scripts, Kubernetes manifests, health checks, and rollback docs. Produce smoke checklist and deterministic validation steps. | scripts/deploy.sh; k8s manifests; health endpoints; existing readiness reports. | Do not deploy or mutate production unless explicitly requested. | Smoke checklist, rollback evidence requirements, failure-path tests. | None; ready to start now. |
| TASK-008-E | Final integration | Operations readiness integration lane | Merge A-D outputs into a single operations trust plan and validation report, resolving shared operational gates. | 21_execution_plans/EP-TASK-008-plan-operations-trust-and-scale.md; 12_validation/VAL-TASK-008-validation-report.md; TASKS.md/STATE.json only if status changes are approved. | Do not start before A-D handoffs are available or explicitly marked blocked. | Integrated operations plan, validation evidence, deviations, and gate results. | Dependency-gated on prior lane handoffs. |

### Agent-Ready Handoff Notes

Start TASK-008-A through TASK-008-D in separate Codex threads only when operational planning begins. Keep deployment, manifests, and shared gate wording under TASK-008-E ownership until lane handoffs are merged.
## Test Plan

- Run npm run ips:audit.
- Run npm run ips:pre-coding.
- Run targeted unit or contract tests for the affected implementation.
- Run npm run ips:readiness before deployment or closure.

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

Start TASK-008-A through TASK-008-D in separate Codex threads only when operational planning begins. Keep deployment, manifests, and shared gate wording under TASK-008-E ownership until lane handoffs are merged.
## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented
