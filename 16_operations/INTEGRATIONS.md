# Integrations

```yaml
id: INTEGRATIONS-ALLEGRO-SERVICE
status: draft
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../SYSTEM.md
  - ../06_architecture/ARCHITECTURE_OVERVIEW.md
downstream:
  - ../17_governance/PROJECT_INVARIANTS.md
related_adrs:
  - ../07_decisions/ADR-001-preserve-existing-nestjs-prisma-service-boundary.md
```

## Purpose

List integration boundaries that execution plans must preserve or explicitly validate.

## Service Boundaries

| Integration | Direction | Constraint |
|---|---|---|
| catalog-microservice | outbound | Validate offer mutations. |
| warehouse-microservice | inbound events | Consume `stock.updated`. |
| orders-microservice | outbound | Forward orders; do not own orders locally. |
| auth-microservice | outbound/inbound auth | Preserve admin auth boundary. |
| logging-microservice | outbound | Do not log secrets or raw protected data. |
| notifications-microservice | outbound | Send order alerts as designed. |
| Allegro REST API/OAuth2 | outbound | Respect OAuth secret handling and API rate limit. |

## Validation

Contract-affecting tasks must identify affected integrations, test commands, and rollback plan in the execution plan.
