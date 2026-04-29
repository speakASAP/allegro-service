# OPS: allegro-service

## Log Commands

```bash
# Recent logs (last 500 lines)
docker logs allegro-green --tail 500
docker logs allegro-settings-green --tail 500
docker logs allegro-api-gateway-green --tail 500

# Follow in real-time
docker logs -f allegro-green

# Filter by timing
docker logs allegro-green --since 5m | grep '\[TIMING\]'

# Filter by request ID
docker logs allegro-api-gateway-green --since 10m | grep 'req-<ID>'

# Logs inside container
docker exec allegro-green cat /app/services/allegro-service/logs/all.log | tail -100
docker exec allegro-green cat /app/services/allegro-service/logs/error.log | tail -50

# Time-range
docker logs allegro-green --since 5m
docker logs allegro-green --since 2025-12-13T19:00:00 --until 2025-12-13T20:00:00
```

### Timing log pattern

```
[TIMING] <operation> START
[TIMING] <operation> COMPLETE (Xms)
```

Gaps between Gateway forward and Controller START = HTTP connection delay.  
Slow JwtAuthGuard = auth bottleneck. Slow DB query = database issue.

---

## Nginx Health-Check Fix

**Issue**: `health-check.sh` incorrectly matches `allegro-service-settings-green` when looking for `allegro-service-green`.

**File**: `~/Documents/Github/nginx-microservice/scripts/blue-green/health-check.sh` ~line 167

**Change**:
```bash
# Before
found_container=$(docker ps --format "{{.Names}}" | grep -E "${CONTAINER_BASE}" | head -1 || echo "")

# After
found_container=$(docker ps --format "{{.Names}}" | grep -E "^${CONTAINER_BASE}(-${ACTIVE_COLOR})?$" | head -1 || echo "")
```

Apply via: `./scripts/fix-health-check.sh` (from allegro-service repo)

Verify: `cd ~/Documents/Github/nginx-microservice && ./scripts/blue-green/health-check.sh allegro-service`
