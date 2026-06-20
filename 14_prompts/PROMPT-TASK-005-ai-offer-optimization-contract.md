# PROMPT-TASK-005: AI Offer Optimization Contract Coding Prompt

```yaml
id: PROMPT-TASK-005-ai-offer-optimization-contract
status: validated
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
execution_plan: ../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
created: 2026-06-19
last_updated: 2026-06-20
completeness_level: validated
sensitive_data_classification: synthetic
approval_status: approved_by_owner_instruction_2026_06_20
```

## Role

You are a worker agent for TASK-005 in allegro-service. Preserve the existing NestJS and Prisma service boundary, catalog ownership, publish-lifecycle guardrails, OAuth secrecy, and IPS traceability chain.

## Task

Define the advisory ai-microservice contract, local suggestion review states, redaction rules, and synthetic validation fixtures for Allegro offer optimization without granting direct marketplace mutation authority.

## Approval Gate

Approved for implementation by owner instruction on 2026-06-20. Keep the implementation bounded to TASK-005 contract artifacts and do not expand into external AI client wiring or direct publish behavior.

## Context

Read before coding:

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
- `services/allegro-service/src/allegro/publish-lifecycle/`
- `services/allegro-service/src/allegro/policy/`

## Constraints

- Keep AI suggestions advisory only.
- Use synthetic fixtures and redacted examples only.
- Do not add production secrets, OAuth tokens, Authorization headers, raw customer data, raw order data, or raw marketplace logs.
- Do not change catalog, order, payment, stock, or supplier ownership boundaries.
- Do not add direct publish, queue execution, or deploy logic.

## Acceptance criteria

- Advisory request/response contract is implemented and validated.
- Review-state lifecycle and approval checkpoints are explicit.
- Redaction and data-minimization rules are encoded with synthetic fixtures.
- Validation evidence records IPS gates, targeted spec, build, and deviations.

## Validation

Run and record:

```bash
npm run ips:audit
npm run ips:pre-coding
cd services/allegro-service && npx ts-node src/allegro/ai-offer-optimization/ai-offer-optimization.spec.ts
cd services/allegro-service && npm run build
python3 scripts/deployment_readiness_gate.py --root . --target TASK-005
```
