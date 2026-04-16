# CLAUDE.md (allegro-service)

Ecosystem defaults: sibling [`../CLAUDE.md`](../CLAUDE.md) and [`../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md`](../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md).

Read this repo's `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json` first.

---

## allegro-service

**Purpose**: Multi-account Allegro.pl marketplace integration — offer management, CSV import/transformation, order processing, stock sync.  
**Domain**: https://allegro.alfares.cz  
**Stack**: NestJS · PostgreSQL

### Key constraints
- Never create or modify Allegro offers without validation against catalog-microservice
- Allegro API rate limit: max 1 request/second per account — enforce strictly
- All received orders must be forwarded to orders-microservice — never stored locally
- Allegro OAuth tokens managed in `.env` only

### Events consumed
- `stock.updated` from warehouse-microservice → updates Allegro offer quantities

### Integration chain
catalog-microservice → allegro-service → Allegro API  
warehouse-microservice → (stock.updated) → allegro-service

### Quick ops
```bash
docker compose logs -f
./scripts/deploy.sh
```
