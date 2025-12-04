# Enhanced Logging and Service URL Fixes

## Context

Multiple services were returning 500/502 errors:

- `POST /api/settings/validate/allegro` - 502 Bad Gateway
- `GET /api/sync/jobs` - 500 Internal Server Error
- `GET /api/products` - 500 Internal Server Error
- `GET /api/allegro/orders` - 500 Internal Server Error
- `GET /api/import/jobs` - 500 Internal Server Error

## Root Cause

Service URLs in production `.env` were likely using `localhost` instead of Docker network service names, preventing inter-container communication.

## Solution

### 1. Enhanced Logging in API Gateway

Added comprehensive logging to API Gateway:

- **Request logging**: Logs all incoming requests with method, path, service name, IP, user agent
- **Response logging**: Logs successful responses with status code, duration, response size
- **Error logging**: Detailed error logging with error codes, status codes, stack traces, connection details
- **Service URL logging**: Logs all configured service URLs at startup
- **Request IDs**: Each request gets a unique ID for tracing

### 2. Service URL Configuration Fix

Created script to fix all service URLs to use Docker network service names:

- `PRODUCT_SERVICE_URL=http://product-service:${PRODUCT_SERVICE_PORT:-3402}` (configured in `allegro/.env`)
- `ALLEGRO_SERVICE_URL=http://allegro-service:${ALLEGRO_SERVICE_PORT:-3403}` (configured in `allegro/.env`)
- `SYNC_SERVICE_URL=http://sync-service:${SYNC_SERVICE_PORT:-3404}` (configured in `allegro/.env`)
- `WEBHOOK_SERVICE_URL=http://webhook-service:${WEBHOOK_SERVICE_PORT:-3405}` (configured in `allegro/.env`)
- `IMPORT_SERVICE_URL=http://import-service:${IMPORT_SERVICE_PORT:-3406}` (configured in `allegro/.env`)
- `SCHEDULER_SERVICE_URL=http://scheduler-service:${SCHEDULER_SERVICE_PORT:-3407}` (configured in `allegro/.env`)
- `SETTINGS_SERVICE_URL=http://allegro-settings-service:${ALLEGRO_SETTINGS_SERVICE_PORT:-3408}` (configured in `allegro/.env`)
- `AUTH_SERVICE_URL=http://auth-microservice:${PORT:-3370}` (configured in `auth-microservice/.env`)

## Implementation Checklist

- ✅ Enhanced API Gateway logging (request/response/error details)
- ✅ Created script to fix all service URLs
- ⏳ Run script on production server
- ⏳ Restart API Gateway
- ⏳ Test all endpoints
- ⏳ Verify logs are being written

## Files Modified

1. `services/api-gateway/src/gateway/gateway.service.ts`
   - Added LoggerService injection
   - Added comprehensive request/response/error logging
   - Added service URL logging at startup

2. `services/api-gateway/src/gateway/gateway.controller.ts`
   - Added LoggerService injection
   - Added incoming request logging
   - Added error logging with full context

3. `scripts/fix_all_service_urls.sh`
   - New script to update all service URLs in production `.env`

## Deployment Instructions

Run these commands on the production server:

```bash
cd ~/allegro

# 1. Run the fix script (backups .env and updates all service URLs)
bash scripts/fix_all_service_urls.sh

# 2. Restart API Gateway to pick up new environment variables
docker compose -f docker-compose.green.yml restart api-gateway

# 3. Verify connectivity to all services
docker exec allegro-api-gateway-green curl -f http://product-service:${PRODUCT_SERVICE_PORT:-3402}/health  # Port configured in allegro/.env
docker exec allegro-api-gateway-green curl -f http://allegro-service:${ALLEGRO_SERVICE_PORT:-3403}/health  # Port configured in allegro/.env
docker exec allegro-api-gateway-green curl -f http://sync-service:${SYNC_SERVICE_PORT:-3404}/health  # Port configured in allegro/.env
docker exec allegro-api-gateway-green curl -f http://import-service:${IMPORT_SERVICE_PORT:-3406}/health  # Port configured in allegro/.env
docker exec allegro-api-gateway-green curl -f http://allegro-settings-service:${ALLEGRO_SETTINGS_SERVICE_PORT:-3408}/health  # Port configured in allegro/.env

# 4. Check API Gateway logs for service URLs
docker logs allegro-api-gateway-green --tail 50 | grep "Service URLs configured"

# 5. Test endpoints and check logs
# After making requests, check logs:
docker logs allegro-api-gateway-green --tail 100
```

## Expected Results

After deployment:

1. All service URLs should use Docker network names
2. API Gateway should log all requests with detailed information
3. All endpoints should work correctly (no more 500/502 errors)
4. Logs should be written to both local files and centralized logging service
5. Request tracing should be possible using request IDs

## Log Locations

- Local logs: `~/allegro/logs/` (on production server)
- Centralized logs: Sent to logging service at `LOGGING_SERVICE_URL`
- Console logs: Available via `docker logs allegro-api-gateway-green`

## Next Steps

1. Deploy changes to production
2. Monitor logs for any remaining issues
3. Consider adding similar logging to other microservices if needed
4. Set up log aggregation and monitoring dashboards
