#!/bin/bash
# Check API Gateway status and diagnose issues

cd ~/allegro || exit 1

echo "=== API Gateway Status Check ==="
echo ""

echo "1. Checking if API Gateway container is running:"
docker ps | grep allegro-api-gateway-green
echo ""

echo "2. Checking API Gateway health:"
curl -s http://localhost:3411/health | jq '.' || echo "❌ Health check failed"
echo ""

echo "3. Checking API Gateway logs (last 30 lines):"
docker logs allegro-api-gateway-green --tail 30
echo ""

echo "4. Testing a simple endpoint:"
curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3411/api/products?page=1&limit=20 | head -20
echo ""

echo "5. Checking disk space:"
df -h / | tail -1
echo ""

echo "6. Checking Docker disk usage:"
docker system df
echo ""

echo "✅ Status check complete"

