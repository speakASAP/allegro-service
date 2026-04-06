# System: allegro-service

## Architecture

NestJS + PostgreSQL + Prisma. Allegro REST API + OAuth2.

- Offer CRUD, CSV import (BizBox format), order sync
- Multi-account support
- Subscribes to stock.updated via RabbitMQ

## Integrations

| Service | Usage |
|---------|-------|
| database-server:5432 | PostgreSQL |
| logging-microservice:3367 | Logs |
| auth-microservice:3370 | Admin auth |
| catalog-microservice:3200 | Product data |
| warehouse-microservice:3201 | Stock (RabbitMQ) |
| orders-microservice:3203 | Forward orders |
| notifications-microservice:3368 | Order alerts |

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
- None
