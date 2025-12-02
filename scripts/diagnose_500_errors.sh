#!/bin/bash
# Diagnose 500 errors on specific endpoints

cd ~/allegro || exit 1

echo "=== Diagnosing 500 Errors ==="
echo ""

echo "1. Checking API Gateway logs for recent errors:"
docker logs allegro-api-gateway-green --tail 100 | grep -i "error\|500\|failed" | tail -20
echo ""

echo "2. Checking service health:"
echo "   Product Service:"
docker exec allegro-api-gateway-green curl -s http://product-service:3402/health | jq '.' || echo "   ❌ Failed"
echo "   Sync Service:"
docker exec allegro-api-gateway-green curl -s http://sync-service:3404/health | jq '.' || echo "   ❌ Failed"
echo "   Allegro Service:"
docker exec allegro-api-gateway-green curl -s http://allegro-service:3403/health | jq '.' || echo "   ❌ Failed"
echo "   Import Service:"
docker exec allegro-api-gateway-green curl -s http://import-service:3406/health | jq '.' || echo "   ❌ Failed"
echo "   Settings Service:"
docker exec allegro-api-gateway-green curl -s http://allegro-settings-service:3408/health | jq '.' || echo "   ❌ Failed"
echo ""

echo "3. Testing endpoints directly (without auth - will show auth errors):"
echo "   Testing /api/sync/jobs:"
curl -s http://localhost:3411/api/sync/jobs | jq '.' || echo "   ❌ Failed"
echo ""

echo "   Testing /api/allegro/orders:"
curl -s http://localhost:3411/api/allegro/orders | jq '.' || echo "   ❌ Failed"
echo ""

echo "   Testing /api/import/jobs:"
curl -s http://localhost:3411/api/import/jobs | jq '.' || echo "   ❌ Failed"
echo ""

echo "4. Checking recent API Gateway request logs:"
docker logs allegro-api-gateway-green --tail 50 | grep -E "sync|allegro|import|settings" | tail -20
echo ""

echo "5. Checking if services are running:"
docker ps | grep -E "sync-service|allegro-service|import-service|settings-service"
echo ""

echo "✅ Diagnosis complete"

