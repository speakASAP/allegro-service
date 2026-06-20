# TASK-005: Define AI Offer Optimization Contract

```yaml
id: TASK-005
status: validated
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-19
completeness_level: validated
upstream:
  - ../10_features/FEAT-005-ai-assisted-offer-optimization.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-005.md
execution_plan:
  - ../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
context_package:
  - ../13_context_packages/CP-TASK-005-ai-offer-optimization-contract.md
coding_prompt:
  - ../14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md
```

## Objective

Define the ai-microservice contract for offer suggestions without granting AI direct marketplace mutation authority.

## Upstream Links

- [08_roadmap/ROADMAP.md](../08_roadmap/ROADMAP.md)
- [09_milestones/MS-004-intelligent-offer-optimization.md](../09_milestones/MS-004-intelligent-offer-optimization.md)
- [10_features/FEAT-005-ai-assisted-offer-optimization.md](../10_features/FEAT-005-ai-assisted-offer-optimization.md)
- [23_documentation_contracts/SENSITIVE_DATA_POLICY.md](../23_documentation_contracts/SENSITIVE_DATA_POLICY.md)

## Goal Impact

AI can raise conversion by improving titles, descriptions, attributes, categories, media recommendations, and price-test ideas, but only if suggestions stay governed and measurable.

## Project Invariant Impact

Applies ALG-INV-001, ALG-INV-002, ALG-INV-004, ALG-INV-006, and ALG-INV-007.

## Sensitive-Data Classification

Classification: synthetic. Prompts and fixtures must avoid raw customer/order data, secrets, and production logs.

## Contract/Schema Impact

Creates a proposed ai-microservice request/response contract and local suggestion record design.

## Replay/Determinism Impact

AI output is non-deterministic; persisted suggestions must include input snapshot hash, model/version metadata if provided by contract, and review status.

## Scope

Suggestion contract, redaction rules, review states, approval path, rollback notes, expected metrics.

## Non-Goals

No autonomous publish, no production prompt with raw sensitive data, no unreviewed price change.

## Acceptance Criteria

- [ ] Contract distinguishes suggestions from approved offer changes.
- [ ] Redaction and data-minimization rules are documented.
- [ ] Suggestions flow into lifecycle only after explicit approval.
- [ ] Validation uses synthetic examples.

## Required Context

Roadmap Stage 3, FEAT-005, sensitive data policy, lifecycle and policy docs.

## Validation Task

Contract review, synthetic fixture tests, redaction scan.

## Required Gates

Pre-coding gate, contract validation, deployment-readiness gate before runtime use.

## Execution Plan Requirement

This task was approved for implementation by owner instruction on 2026-06-19 and is now implemented and validated.
