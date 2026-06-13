# TASK-004: Design Catalog Sell On Allegro Action

```yaml
id: TASK-004
status: draft
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../10_features/FEAT-004-catalog-sell-on-allegro-action.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-004.md
execution_plan:
  - ../21_execution_plans/EP-TASK-004-design-catalog-sell-on-allegro-action.md
```

## Objective

Design the catalog-facing Sell on Allegro API that prepares a draft, evaluates policy, requires confirmation, queues publish, and returns status.

## Upstream Links

- [08_roadmap/ROADMAP.md](../08_roadmap/ROADMAP.md)
- [09_milestones/MS-003-catalog-to-allegro-conversion-engine.md](../09_milestones/MS-003-catalog-to-allegro-conversion-engine.md)
- [10_features/FEAT-004-catalog-sell-on-allegro-action.md](../10_features/FEAT-004-catalog-sell-on-allegro-action.md)
- [17_governance/PROJECT_INVARIANTS.md](../17_governance/PROJECT_INVARIANTS.md)

## Goal Impact

This task increases revenue by reducing friction between catalog products and Allegro listings while preserving product ownership and publish guardrails.

## Project Invariant Impact

Applies ALG-INV-001 through ALG-INV-007.

## Sensitive-Data Classification

Classification: synthetic. Use synthetic catalog products, accounts, offers, and status payloads.

## Contract/Schema Impact

Creates a cross-service contract consumed by catalog-microservice; requires DTO and endpoint validation.

## Replay/Determinism Impact

Prepare and confirm must be idempotent.

## Scope

Prepare, confirm, status, bulk planning, account/category choice, readiness blockers, and gateway/auth behavior.

## Non-Goals

No direct catalog posting to Allegro. No AI generation in this task.

## Acceptance Criteria

- [ ] Prepare creates or reuses draft only.
- [ ] Confirm queues only policy-allowed attempts.
- [ ] Status returns blockers and next action.
- [ ] Bulk operations respect rate limits.

## Required Context

FEAT-002, FEAT-003, Bazos catalog sell-action reference, catalog client, gateway controller.

## Validation Task

Contract tests, controller tests, lifecycle integration tests, gateway smoke.

## Required Gates

Contract review, pre-coding gate, targeted tests, deployment-readiness gate.

## Execution Plan Requirement

This task must not be converted into a coding prompt until an approved execution plan exists.
