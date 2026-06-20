# PROMPT-TASK-005: AI Offer Optimization Contract Coding Prompt

```yaml
id: PROMPT-TASK-005-ai-offer-optimization-contract
status: validated
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
execution_plan: ../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
created: 2026-06-19
last_updated: 2026-06-19
completeness_level: validated
sensitive_data_classification: synthetic
approval_status: approved_for_implementation_by_owner_instruction_2026_06_20
```

## Role

You are a worker agent for TASK-005 in allegro-service. Preserve the existing NestJS and Prisma service boundary, catalog ownership, publish-lifecycle guardrails, and IPS traceability chain while implementing the advisory AI contract slice only.

## Task

Define the advisory ai-microservice contract, local suggestion review states, deterministic snapshot hashing, approval-gated lifecycle handoff, redaction rules, and synthetic validation fixtures for Allegro offer optimization without granting direct marketplace mutation authority.

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
- `services/allegro-service/src/allegro/ai-offer-optimization/`

## Constraints

- Keep AI suggestions advisory only.
- Use synthetic fixtures and redacted examples only.
- Do not add production secrets, OAuth tokens, Authorization headers, raw customer data, raw order data, or raw marketplace logs.
- Do not change catalog, order, payment, stock, or supplier ownership boundaries without approved upstream decisions.
- Do not add live ai-microservice HTTP calls, queue execution, Prisma schema changes, or autonomous publish behavior in this task.
- Do not deploy from this prompt.

## Acceptance criteria

- Advisory request/response contract is documented and validated.
- Review-state lifecycle, snapshot-hash metadata, and approval checkpoints are explicit.
- Redaction and data-minimization rules are documented with synthetic fixtures.
- Validation evidence records IPS gates, targeted contract tests, build, and deviations.

## Validation

Run and record:

```bash
npm run ips:audit
npm run ips:pre-coding
cd services/allegro-service && npm run build
cd services/allegro-service && LOGGING_SERVICE_URL=http://127.0.0.1 AUTH_SERVICE_URL=http://127.0.0.1 NOTIFICATION_SERVICE_URL=http://127.0.0.1 JWT_SECRET=test-secret ENCRYPTION_KEY=0123456789abcdef0123456789abcdef npx ts-node src/allegro/ai-offer-optimization/ai-offer-optimization.spec.ts
python3 scripts/deployment_readiness_gate.py --root . --target TASK-005
```
