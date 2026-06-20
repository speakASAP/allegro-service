# PROMPT-TASK-005: AI Offer Optimization Contract Coding Prompt

```yaml
id: PROMPT-TASK-005-ai-offer-optimization-contract
status: validated
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
execution_plan: ../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
created: 2026-06-20
last_updated: 2026-06-20
completeness_level: validated
sensitive_data_classification: synthetic
```

## Role

You are a worker agent implementing TASK-005 for allegro-service. Preserve the existing NestJS and Prisma service boundary, catalog ownership, governed publish lifecycle, policy review guardrails, OAuth secrecy, and IPS traceability chain.

## Task

Add a task-scoped AI offer optimization contract artifact that:

- builds a redacted outbound request payload for ai-microservice;
- defines the advisory suggestion response and local review record shape;
- preserves explicit human review and policy-confirmed apply behavior; and
- validates the contract with synthetic deterministic fixtures only.

## Context

Read before coding:

- `08_roadmap/ROADMAP.md`
- `10_features/FEAT-005-ai-assisted-offer-optimization.md`
- `11_tasks/TASK-005-define-ai-offer-optimization-contract.md`
- `21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md`
- `22_goal_impact/GOAL-IMPACT-TASK-005.md`
- `17_governance/PROJECT_INVARIANTS.md`
- `16_operations/INTEGRATIONS.md`
- `23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `services/allegro-service/src/allegro/publish-lifecycle/`
- `services/allegro-service/src/allegro/policy/`

## Constraints

- Use synthetic tests and fixtures only.
- Do not add production secrets, OAuth tokens, Authorization headers, raw customer data, raw order data, or raw logs.
- Do not add direct publish, autonomous mutation, or live ai-microservice network calls.
- Do not change catalog, order, stock, payment, or supplier ownership boundaries.
- Keep apply-to-lifecycle blocked until human review and policy confirmation are explicit in the contract.
- Do not deploy from this prompt.

## Acceptance criteria

- The contract distinguishes draft AI suggestions from approved marketplace changes.
- Redaction and data-minimization rules are encoded and tested.
- Suggestion review states and apply prerequisites are explicit.
- Validation evidence records IPS gates, targeted tests, redaction/synthetic-data handling, and deviations.

## Validation

Run and record:

```bash
npm run ips:audit
npm run ips:pre-coding
cd services/allegro-service && npm run build
cd services/allegro-service && LOGGING_SERVICE_URL=http://127.0.0.1 AUTH_SERVICE_URL=http://127.0.0.1 NOTIFICATION_SERVICE_URL=http://127.0.0.1 JWT_SECRET=test-secret ENCRYPTION_KEY=0123456789abcdef0123456789abcdef npx ts-node src/allegro/ai-offer-optimization/ai-offer-optimization.contract.spec.ts
python3 scripts/deployment_readiness_gate.py --root . --target TASK-005
```
