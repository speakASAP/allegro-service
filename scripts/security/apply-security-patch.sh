#!/bin/bash
# Security Patch Application Script
# This script applies security patches to the Next.js application on the production server

set -e

echo "🔒 Applying Security Patches to Next.js Application"
echo "=================================================="

# Configuration
NEXTJS_CONTAINER="statex-frontend-green"
NEXTJS_APP_PATH="/app/src"
BACKUP_DIR="/tmp/security-backup-$(date +%Y%m%d-%H%M%S)"

echo ""
echo "📦 Step 1: Creating backup..."
mkdir -p "$BACKUP_DIR"
docker exec "$NEXTJS_CONTAINER" sh -c "cp -r $NEXTJS_APP_PATH/middleware.ts $BACKUP_DIR/ 2>/dev/null || true"
echo "✅ Backup created at $BACKUP_DIR"

echo ""
echo "📝 Step 2: Copying security middleware..."
# Copy middleware.ts to the container
docker cp scripts/security/security-middleware.ts "${NEXTJS_CONTAINER}:${NEXTJS_APP_PATH}/middleware.ts"
echo "✅ Security middleware copied"

echo ""
echo "📝 Step 3: Copying input validator utilities..."
# Create lib/security directory if it doesn't exist
docker exec "$NEXTJS_CONTAINER" sh -c "mkdir -p $NEXTJS_APP_PATH/lib/security"
docker cp scripts/security/input-validator.ts "${NEXTJS_CONTAINER}:${NEXTJS_APP_PATH}/lib/security/input-validator.ts"
echo "✅ Input validator utilities copied"

echo ""
echo "🔄 Step 4: Restarting Next.js application..."
docker restart "$NEXTJS_CONTAINER"
echo "✅ Application restarted"

echo ""
echo "⏳ Waiting for application to be healthy..."
sleep 10

# Check if container is healthy
if docker ps --filter "name=$NEXTJS_CONTAINER" --filter "health=healthy" | grep -q "$NEXTJS_CONTAINER"; then
    echo "✅ Application is healthy"
else
    echo "⚠️  Warning: Application health check failed. Please verify manually."
fi

echo ""
echo "📊 Step 5: Checking security logs..."
docker logs "$NEXTJS_CONTAINER" --tail 50 | grep -i "SECURITY" || echo "No security events in recent logs"

echo ""
echo "✅ Security patches applied successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Monitor logs: docker logs -f $NEXTJS_CONTAINER | grep SECURITY"
echo "2. Test the application to ensure it's working correctly"
echo "3. Review security logs for any blocked requests"
echo ""
echo "🔄 To rollback (if needed):"
echo "docker exec $NEXTJS_CONTAINER sh -c 'cp $BACKUP_DIR/middleware.ts $NEXTJS_APP_PATH/middleware.ts'"
echo "docker restart $NEXTJS_CONTAINER"

