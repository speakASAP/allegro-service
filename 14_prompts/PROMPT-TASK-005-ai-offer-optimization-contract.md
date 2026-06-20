# PROMPT-TASK-005: AI Offer Optimization Contract Coding Prompt

```yaml
id: PROMPT-TASK-005-ai-offer-optimization-contract
status: draft
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
execution_plan: ../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
created: 2026-06-19
last_updated: 2026-06-19
completeness_level: complete
sensitive_data_classification: synthetic
approval_status: blocked_pending_explicit_approval
```

## Role

You are a worker agent for TASK-005 in allegro-service. This prompt exists only to preserve the required IPS artifact chain. Do not use it for coding unless explicit approval is recorded in repository state or owner instruction.

## Task

When approval exists, define the advisory ai-microservice contract, local suggestion review states, redaction rules, and synthetic validation fixtures for Allegro offer optimization without granting direct marketplace mutation authority.

## Approval Gate

[MISSING: explicit approval for TASK-005 coding. Until this is supplied, stop after reading this file and return without changing runtime code.]

## Context

Read before any future approved coding:

- `08_roadmap/ROADMAP.md`
- `10_features/FEAT-005-ai-assisted-offer-optimization.md`
- `11_tasks/TASK-005-define-ai-offer-optimization-contract.md`
- `21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md`
- `22_goal_impact/GOAL-IMPACT-TASK-005.md`
- `17_governance/PROJECT_INVARIANTS.md`
- `23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `16_operations/INTEGRATIONS.md`
- `13_context_packages/CP-TASK-005-ai-offer-optimization-contract.md`
- `12_validation/VAL-TASK-005-validation-report.md`

## Constraints

- Do not run this prompt without explicit approval.
- Keep AI suggestions advisory only.
- Use synthetic fixtures and redacted examples only.
- Do not add production secrets, OAuth tokens, Authorization headers, raw customer data, raw order data, or raw marketplace logs.
- Do not change catalog, order, payment, stock, or supplier ownership boundaries without approved upstream decisions.
- Do not deploy from this prompt.

## Acceptance criteria

- Advisory request/response contract is documented and validated.
- Review-state lifecycle and approval checkpoints are explicit.
- Redaction and data-minimization rules are documented with synthetic fixtures.
- Validation evidence records IPS gates, contract tests if approved later, and deviations.

## Validation

Run and record after approval only:

```bash
npm run ips:audit
npm run ips:pre-coding
npm run ips:readiness
```
