# CP-TASK-005: AI Offer Optimization Contract Context Package

```yaml
id: CP-TASK-005
status: reviewed
source_task: ../11_tasks/TASK-005-define-ai-offer-optimization-contract.md
execution_plan: ../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md
coding_prompt: ../14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md
created: 2026-06-19
last_updated: 2026-06-19
completeness_level: complete
sensitive_data_classification: synthetic
```

## Target task

TASK-005: `../11_tasks/TASK-005-define-ai-offer-optimization-contract.md` - define the ai-microservice contract, redaction rules, review states, and approval path for advisory Allegro offer suggestions.

## Upstream traceability

- Roadmap: `../08_roadmap/ROADMAP.md`
- Feature: `../10_features/FEAT-005-ai-assisted-offer-optimization.md`
- Task: `../11_tasks/TASK-005-define-ai-offer-optimization-contract.md`
- Execution plan: `../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md`
- Goal impact: `../22_goal_impact/GOAL-IMPACT-TASK-005.md`
- Validation report: `../12_validation/VAL-TASK-005-validation-report.md`
- Approval-blocked coding prompt: `../14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md`

## Included documents

- `../08_roadmap/ROADMAP.md`
- `../10_features/FEAT-005-ai-assisted-offer-optimization.md`
- `../11_tasks/TASK-005-define-ai-offer-optimization-contract.md`
- `../21_execution_plans/EP-TASK-005-define-ai-offer-optimization-contract.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-005.md`
- `../17_governance/PROJECT_INVARIANTS.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../16_operations/INTEGRATIONS.md`
- `../12_validation/VAL-TASK-005-validation-report.md`
- `../14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md`

## Excluded documents

- Protected constitution and vision source text beyond traceability references.
- Raw production marketplace payloads, OAuth tokens, secrets, customer data, order data, and production logs.
- Runtime DTO, Prisma, queue-worker, and publish-execution implementation files until TASK-005 is explicitly approved for coding.

## Constraints

- AI suggestions remain advisory only.
- No autonomous publish, no direct Allegro mutation, and no unreviewed price changes.
- Synthetic fixtures only.
- Preserve catalog ownership, orders ownership, and current service boundaries.
- Do not use the approval-blocked prompt for implementation until explicit approval is recorded.

## Agent prompt

Use `../14_prompts/PROMPT-TASK-005-ai-offer-optimization-contract.md` only after explicit approval is recorded in repo state or owner instruction. Until then, the prompt is a blocked artifact for completeness and must not be used to start coding.

## Validation instructions

Run IPS audit, pre-coding gate, and deployment-readiness gate for the planning artifacts. Record evidence in `../12_validation/VAL-TASK-005-validation-report.md`.
