# Security Patch for Next.js Application

This directory contains security patches to protect the Next.js application from command injection and other attacks.

## Files

- `security-middleware.ts` - Next.js middleware that blocks malicious requests
- `input-validator.ts` - Input validation utilities for sanitizing user input
- `nginx-security-rules.conf` - Nginx configuration rules to block attacks at the proxy level
- `apply-security-patch.sh` - Script to apply security patches to production

## Quick Start

### 1. Apply Security Middleware

```bash
# On your local machine, copy files to server
scp scripts/security/security-middleware.ts statex:/tmp/
scp scripts/security/input-validator.ts statex:/tmp/

# On the server, copy to container
docker cp /tmp/security-middleware.ts statex-frontend-green:/app/src/middleware.ts
docker cp /tmp/input-validator.ts statex-frontend-green:/app/src/lib/security/input-validator.ts

# Restart container
docker restart statex-frontend-green
```

### 2. Update Nginx Configuration

```bash
# On the server, backup current nginx config
docker exec nginx-microservice cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Add security rules from nginx-security-rules.conf to your nginx configuration
# Then reload nginx
docker exec nginx-microservice nginx -t && docker exec nginx-microservice nginx -s reload
```

### 3. Update API Routes to Use Input Validation

In your API routes, import and use the input validator:

```typescript
import { validateSlug, validateQueryParam, validateLanguage } from '@/lib/security/input-validator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  
  // Validate and sanitize slug
  const slug = validateSlug(resolvedParams.slug);
  if (!slug) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  
  // Validate query parameters
  const searchParams = request.nextUrl.searchParams;
  const lang = validateLanguage(searchParams.get('lang') || undefined);
  
  // ... rest of your code
}
```

### 4. Update Dynamic Routes

In your dynamic route pages, validate parameters:

```typescript
import { validateSlug, validateLanguage } from '@/lib/security/input-validator';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  
  // Validate slug
  const slug = validateSlug(resolvedParams.slug);
  if (!slug) {
    notFound();
  }
  
  // ... rest of your code
}
```

## What Gets Blocked

The security middleware blocks:

1. **Command Injection Patterns**
   - PowerShell commands
   - Bash shell commands
   - Base64 encoded commands
   - exec/eval/child_process patterns

2. **Suspicious Domains**
   - trycloudflare.com
   - Other known malicious domains

3. **Malicious IPs**
   - Known attacker IP addresses

4. **Path Traversal**
   - `../` patterns
   - Directory traversal attempts

5. **SQL Injection**
   - UNION SELECT
   - DROP TABLE
   - Other SQL injection patterns

6. **XSS Patterns**
   - `<script>` tags
   - `javascript:` protocols
   - Event handlers

## Monitoring

Monitor security events:

```bash
# Watch security logs in real-time
docker logs -f statex-frontend-green | grep SECURITY

# Check for blocked requests
docker logs statex-frontend-green --since 1h | grep "SECURITY_BLOCK"
```

## Customization

### Add More Blocked IPs

Edit `security-middleware.ts`:

```typescript
const BLOCKED_IPS: string[] = [
  '172.202.118.46',
  '165.154.119.158',
  '43.155.70.112',
  // Add more IPs here
];
```

### Add More Malicious Patterns

Edit `security-middleware.ts`:

```typescript
const MALICIOUS_PATTERNS = [
  // ... existing patterns
  /your-new-pattern/i,
];
```

### Adjust Rate Limiting

Edit `nginx-security-rules.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s; # Adjust rate here
```

## Rollback

If you need to rollback the security middleware:

```bash
# Remove middleware (Next.js will work without it)
docker exec statex-frontend-green rm /app/src/middleware.ts
docker restart statex-frontend-green
```

## Testing

After applying patches, test that:

1. Normal requests still work
2. Malicious requests are blocked (check logs)
3. Application performance is not significantly impacted

## Support

If you encounter issues:

1. Check application logs: `docker logs statex-frontend-green`
2. Verify middleware is loaded: Check for middleware errors in logs
3. Test with a known malicious request to verify blocking works

