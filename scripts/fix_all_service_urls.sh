#!/bin/bash
# Fix all service URLs in production .env file to use Docker network service names
# This script updates all service URLs to use Docker network service names instead of localhost

cd ~/allegro || exit 1

# Backup .env file
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up .env file"
fi

# Service URL mappings: ENV_VAR=service-name:port
declare -A SERVICE_URLS=(
    ["PRODUCT_SERVICE_URL"]="http://product-service:3402"
    ["ALLEGRO_SERVICE_URL"]="http://allegro-service:3403"
    ["SYNC_SERVICE_URL"]="http://sync-service:3404"
    ["WEBHOOK_SERVICE_URL"]="http://webhook-service:3405"
    ["IMPORT_SERVICE_URL"]="http://import-service:3406"
    ["SCHEDULER_SERVICE_URL"]="http://scheduler-service:3407"
    ["SETTINGS_SERVICE_URL"]="http://allegro-settings-service:3408"
    ["AUTH_SERVICE_URL"]="http://auth-microservice:3370"
)

echo "Checking and updating service URLs..."
echo ""

for env_var in "${!SERVICE_URLS[@]}"; do
    expected_url="${SERVICE_URLS[$env_var]}"
    
    if grep -q "^${env_var}=" .env; then
        current_value=$(grep "^${env_var}=" .env | cut -d'=' -f2-)
        if [ "$current_value" != "$expected_url" ]; then
            sed -i "s|^${env_var}=.*|${env_var}=${expected_url}|" .env
            echo "✅ Updated ${env_var}: ${current_value} -> ${expected_url}"
        else
            echo "✓ ${env_var} already correct: ${expected_url}"
        fi
    else
        # Add new value at the top
        echo "${env_var}=${expected_url}" | cat - .env > .env.tmp && mv .env.tmp .env
        echo "✅ Added ${env_var}=${expected_url}"
    fi
done

echo ""
echo "=== Current Service URLs ==="
for env_var in "${!SERVICE_URLS[@]}"; do
    grep "^${env_var}=" .env || echo "⚠️  ${env_var} not found"
done

echo ""
echo "✅ All service URLs updated!"
echo ""
echo "Next steps:"
echo "1. Restart API Gateway: docker compose -f docker-compose.green.yml restart api-gateway"
echo "2. Verify connectivity: docker exec allegro-api-gateway-green curl -f http://product-service:3402/health"

