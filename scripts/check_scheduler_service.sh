#!/bin/bash
# Check and fix scheduler service that's restarting

cd ~/allegro || exit 1

echo "Checking scheduler service status..."
echo ""

# Check if scheduler is restarting
if docker ps | grep -q "allegro-scheduler-service-green.*Restarting"; then
    echo "⚠️  Scheduler service is restarting (crashing)"
    echo ""
    echo "Checking logs for errors:"
    docker logs allegro-scheduler-service-green --tail 50
    
    echo ""
    echo "Attempting to fix by recreating the container..."
    docker compose -f docker-compose.green.yml stop scheduler-service
    docker compose -f docker-compose.green.yml rm -f scheduler-service
    docker compose -f docker-compose.green.yml up -d scheduler-service
    
    echo ""
    echo "Waiting for scheduler to start..."
    sleep 5
    
    if docker ps | grep -q "allegro-scheduler-service-green.*Up"; then
        echo "✅ Scheduler service is now running"
    else
        echo "❌ Scheduler service still failing. Check logs:"
        docker logs allegro-scheduler-service-green --tail 50
    fi
else
    echo "✅ Scheduler service is running normally"
fi

