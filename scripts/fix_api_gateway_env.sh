#!/bin/bash
# Fix API Gateway to pick up new .env values by recreating the container

cd ~/allegro || exit 1

echo "Recreating API Gateway container to pick up new .env values..."
echo ""

# Stop and remove the container (this will force it to recreate with new env vars)
docker compose -f docker-compose.green.yml stop api-gateway
docker compose -f docker-compose.green.yml rm -f api-gateway

# Start it again (will recreate with new env vars from .env)
docker compose -f docker-compose.green.yml up -d api-gateway

echo ""
echo "Waiting for API Gateway to start..."
sleep 5

# Check if it's running
if docker ps | grep -q "allegro-api-gateway-green"; then
    echo "✅ API Gateway is running"
    
    # Check logs for service URLs
    echo ""
    echo "Checking service URLs in logs..."
    docker logs allegro-api-gateway-green --tail 100 | grep -i "service" | head -20
    
    # Test connectivity
    echo ""
    echo "Testing service connectivity..."
    docker exec allegro-api-gateway-green curl -s http://product-service:3402/health | jq '.' || echo "❌ Product service not reachable"
    docker exec allegro-api-gateway-green curl -s http://allegro-service:3403/health | jq '.' || echo "❌ Allegro service not reachable"
else
    echo "❌ API Gateway failed to start. Check logs:"
    docker logs allegro-api-gateway-green --tail 50
fi

echo ""
echo "✅ Done! API Gateway should now be using updated service URLs from .env"

