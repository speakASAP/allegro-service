/**
 * Next.js Security Middleware (Merged with Prototype Subdomain Support)
 * Blocks malicious requests and attack patterns while maintaining prototype subdomain functionality
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from './src/lib/logger';

// Malicious patterns to block
const MALICIOUS_PATTERNS = [
  // Command injection patterns
  /powershell/i,
  /base64.*bash/i,
  /bash.*-sh/i,
  /curl.*http/i,
  /wget.*http/i,
  /exec.*\(/i,
  /eval.*\(/i,
  /child_process/i,
  /spawn.*\(/i,
  
  // Suspicious domains
  /trycloudflare\.com/i,
  /propose-epson-mandate-trio/i,
  
  // Command injection via query params
  /@zdi/i,
  /@.*powershell/i,
  /@.*bash/i,
  
  // Base64 encoded commands (long strings)
  /[A-Za-z0-9+\/]{100,}={0,2}/,
  
  // Path traversal
  /\.\.\//,
  /\.\.\\/,
  
  // SQL injection patterns
  /union.*select/i,
  /drop.*table/i,
  /insert.*into/i,
  /delete.*from/i,
  
  // XSS patterns
  /<script/i,
  /javascript:/i,
  /onerror=/i,
  /onload=/i,
];

// Suspicious query parameter names
const SUSPICIOUS_QUERY_KEYS = [
  'cmd',
  'command',
  'exec',
  'eval',
  'system',
  'shell',
  'powershell',
  'bash',
  'sh',
];

// IP addresses to block (add malicious IPs here)
const BLOCKED_IPS: string[] = [
  '172.202.118.46',
  '165.154.119.158',
  '43.155.70.112',
];

/**
 * Check if a string contains malicious patterns
 */
function containsMaliciousPattern(value: string): boolean {
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Sanitize and validate query parameters
 */
function validateQueryParams(searchParams: URLSearchParams): { isValid: boolean; reason?: string } {
  for (const [key, value] of searchParams.entries()) {
    // Check suspicious parameter names
    if (SUSPICIOUS_QUERY_KEYS.some(suspicious => key.toLowerCase().includes(suspicious))) {
      return { isValid: false, reason: `Suspicious query parameter: ${key}` };
    }
    
    // Check for malicious patterns in values
    if (containsMaliciousPattern(value)) {
      return { isValid: false, reason: `Malicious pattern detected in ${key}` };
    }
    
    // Check for suspicious length (potential base64 encoded commands)
    if (value.length > 200 && /^[A-Za-z0-9+\/]+={0,2}$/.test(value)) {
      return { isValid: false, reason: `Suspicious base64-like value in ${key}` };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate URL path
 */
function validatePath(pathname: string): { isValid: boolean; reason?: string } {
  // Block autodiscover endpoints (common attack vector)
  if (pathname.includes('autodiscover')) {
    return { isValid: false, reason: 'Autodiscover endpoint blocked' };
  }
  
  // Check for malicious patterns in path
  if (containsMaliciousPattern(pathname)) {
    return { isValid: false, reason: 'Malicious pattern in path' };
  }
  
  // Block path traversal attempts
  if (pathname.includes('../') || pathname.includes('..\\')) {
    return { isValid: false, reason: 'Path traversal attempt blocked' };
  }
  
  return { isValid: true };
}

/**
 * Log security event
 */
function logSecurityEvent(
  request: NextRequest,
  reason: string,
  blocked: boolean = true
): void {
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: blocked ? 'SECURITY_BLOCK' : 'SECURITY_WARN',
    reason,
    ip: clientIP,
    path: request.nextUrl.pathname,
    query: request.nextUrl.search,
    userAgent,
    method: request.method,
  };
  
  // Log using existing logger
  if (blocked) {
    logger.error('[SECURITY]', JSON.stringify(logEntry));
  } else {
    logger.warn('[SECURITY]', JSON.stringify(logEntry));
  }
}

export function middleware(request: NextRequest) {
  const { hostname, pathname, searchParams } = request.nextUrl;
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  logger.info(`Processing request: ${hostname}${pathname}`);
  
  // SECURITY CHECKS - Run before prototype subdomain logic
  
  // Block known malicious IPs
  if (BLOCKED_IPS.includes(clientIP)) {
    logSecurityEvent(request, `Blocked IP: ${clientIP}`, true);
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // Validate path
  const pathValidation = validatePath(pathname);
  if (!pathValidation.isValid) {
    logSecurityEvent(request, pathValidation.reason || 'Invalid path', true);
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // Validate query parameters
  const queryValidation = validateQueryParams(searchParams);
  if (!queryValidation.isValid) {
    logSecurityEvent(request, queryValidation.reason || 'Invalid query parameters', true);
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // Check request headers for suspicious content
  const userAgent = request.headers.get('user-agent') || '';
  if (containsMaliciousPattern(userAgent)) {
    logSecurityEvent(request, 'Suspicious user agent', true);
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // Check referer header
  const referer = request.headers.get('referer') || '';
  if (referer && containsMaliciousPattern(referer)) {
    logSecurityEvent(request, 'Suspicious referer', true);
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // PROTOTYPE SUBDOMAIN LOGIC (existing functionality)
  // Check if this is a prototype subdomain
  // Support both formats: proto_XXXXX and YYYYMMDD_HHMMSS_XXXXX
  // Also support different ports (3000, 3003, etc.)
  const prototypeMatch = hostname.match(/^project-([a-zA-Z0-9_-]+)\.localhost$/);
  
  if (prototypeMatch) {
    const prototypeId = prototypeMatch[1];
    
    logger.info(`Found prototype subdomain: ${prototypeId}`);
    
    // Route to the prototype-subdomain component with path parameter
    const url = request.nextUrl.clone();
    url.pathname = '/prototype-subdomain';
    url.hostname = 'localhost';
    
    // Add the path as a search parameter
    if (pathname !== '/' && pathname !== '') {
      url.searchParams.set('path', pathname.substring(1)); // Remove leading slash
    }
    
    logger.info(`Subdomain routing: ${hostname}${pathname} -> ${url.pathname}?path=${url.searchParams.get('path') || 'root'}`);
    
    return NextResponse.rewrite(url);
  }
  
  logger.info(`Not a prototype subdomain: ${hostname}`);
  
  // Allow request to proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

