# TASK-007 Validation Evidence

## Summary

TASK-007 closed as a contract-first documentation task on 2026-06-20. The integrated evidence comes from four isolated handoff artifacts plus the repo gate results. No runtime leads, marketing, logging, or notification writes were introduced.

## Evidence artifacts

- `reports/validation/TASK-007-A-funnel-taxonomy-handoff.md`: draft `allegro.*` funnel taxonomy, canonical envelope, source mappings, and explicit Stage 5 gaps.
- `reports/validation/TASK-007-B-leads-marketing-handoff.md`: draft leads and marketing envelopes, consent and ownership boundaries, and downstream contract blockers.
- `reports/validation/TASK-007-C-digest-metrics-handoff.md`: daily/weekly digest payload drafts, metric definitions, deterministic windows, and snapshot guardrails.
- `reports/validation/TASK-007-D-redaction-replay-handoff.md`: redaction checklist, replay/idempotency rules, versioning policy, compatibility guidance, and safety validation cases.

## Integrated contract outcome

- Funnel taxonomy draft candidate: `2026-06-20.allegro-funnel.v1`.
- Leads envelope draft candidate: `leads-demand-signal` version `0.1.0-draft`.
- Marketing envelope draft candidate: `marketing-growth-segment` version `0.1.0-draft`.
- Digest contract draft candidate: `task-007.digest.v0`.
- Required envelope safety fields: `contractVersion`, `sourceService`, `sourceEvent` or `eventName`, `channel`, `channelAccountId` or `accountId`, `idempotencyKey`, `observedAt` or `occurredAt`, and redaction metadata.

## Remaining blocked runtime facts

- `[MISSING: leads-microservice endpoint, owner, retry semantics, and idempotency contract]`
- `[MISSING: marketing-microservice segment ingestion API, owner, activation policy, and consent semantics]`
- `[MISSING: notifications-microservice digest contract, scheduler owner, and delivery receipt model]`
- `[MISSING: click telemetry source and approved event naming for clicked-stage signals]`
- `[MISSING: payment-settled/refund source contracts and cancellation event source mapping]`
- `[MISSING: TASK-006-approved economics inputs for margin-warning contracts]`

## Safety evidence

All examples use synthetic identifiers only. The handoffs explicitly exclude OAuth tokens, Authorization headers, client secrets, buyer identifiers, payment details, raw order payloads, and raw production logs.
