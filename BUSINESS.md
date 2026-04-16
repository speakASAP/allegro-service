# Business: allegro-service
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Multi-account Allegro marketplace integration: offer management, CSV import/transformation, order processing, stock sync.

## Constraints

- AI must never create/modify Allegro offers without validation
- Allegro API rate limits must be respected (max 1 req/s per account)
- Order data must be forwarded to orders-microservice — not stored locally

## Consumers

flipflop-service (stock/orders sync).

## SLA

- Production: <https://allegro.alfares.cz>
- Events consumed: stock.updated (warehouse)
