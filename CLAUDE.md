# CLAUDE.md (allegro-service)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## allegro-service

**Purpose**: Multi-account Allegro.pl marketplace integration — offer management, CSV import/transformation, order processing, stock sync.  
**Domain**: https://allegro.alfares.cz  
**Stack**: NestJS · PostgreSQL

### Key constraints
- Never create or modify Allegro offers without validation against catalog-microservice
- Allegro API rate limit: max 1 request/second per account — enforce strictly
- All received orders must be forwarded to orders-microservice — never stored locally
- Allegro OAuth tokens in Vault/`.env` only — never hardcoded

### Events consumed
- `stock.updated` from warehouse-microservice → updates Allegro offer quantities

### Integration chain
catalog-microservice → allegro-service → Allegro API  
warehouse-microservice → (stock.updated) → allegro-service

**Ops**: `docker compose logs -f` · `./scripts/deploy.sh`

### Secrets
All secrets in Vault (`secret/prod/allegro-service`) and local `.env`.

See [docs/OPS.md](docs/OPS.md) for full log commands.
