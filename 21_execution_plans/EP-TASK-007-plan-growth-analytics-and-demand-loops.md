# EP-TASK-007: Growth Analytics And Demand Loops Execution Plan

```yaml
id: EP-TASK-007
status: draft
source_task: ../11_tasks/TASK-007-plan-growth-analytics-and-demand-loops.md
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-007-growth-analytics-and-demand-loops.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-007.md
```

## Metadata

- Source task: ../11_tasks/TASK-007-plan-growth-analytics-and-demand-loops.md
- Status: draft for owner review.
- Lifecycle state: planned; not approved for coding until gate review passes.

## Upstream Traceability

- Constitution: ../00_constitution/CONSTITUTION.md
- Vision: ../01_vision/VISION.md
- Business case: ../02_business_case/BUSINESS_CASE.md
- Roadmap: ../08_roadmap/ROADMAP.md
- Feature: ../10_features/FEAT-007-growth-analytics-and-demand-loops.md
- Goal impact: ../22_goal_impact/GOAL-IMPACT-TASK-007.md

## Goal Impact

Define versioned funnel events, lead signals, marketing segments, and notification digest contracts. This supports the revenue roadmap by improving publish reliability, conversion readiness, operational visibility, or profit protection for Allegro sales.

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

Define versioned funnel events, lead signals, marketing segments, and notification digest contracts.

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

- 12_validation/VAL-TASK-007-validation-report.md
- reports/validation/TASK-007-validation-evidence.md when generated evidence is needed

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

Implement TASK-007 as contract-first growth analytics planning with redacted, replay-safe event schemas.

## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented
