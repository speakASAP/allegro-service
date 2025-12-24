/**
 * Input Validation Utilities
 * Use these functions to sanitize and validate user input
 * Import in your API routes and page components
 */

/**
 * Sanitize a string by removing dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized.trim();
}

/**
 * Validate and sanitize a slug parameter
 */
export function validateSlug(slug: string | string[] | undefined): string | null {
  if (!slug) {
    return null;
  }
  
  const slugStr = Array.isArray(slug) ? slug.join('/') : String(slug);
  
  // Only allow alphanumeric, hyphens, underscores, and forward slashes
  if (!/^[a-zA-Z0-9\-_\/]+$/.test(slugStr)) {
    return null;
  }
  
  // Block path traversal
  if (slugStr.includes('../') || slugStr.includes('..\\')) {
    return null;
  }
  
  // Block suspicious patterns
  const suspiciousPatterns = [
    /powershell/i,
    /bash.*-sh/i,
    /base64/i,
    /exec/i,
    /eval/i,
    /child_process/i,
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(slugStr))) {
    return null;
  }
  
  return sanitizeString(slugStr);
}

/**
 * Validate and sanitize query parameters
 */
export function validateQueryParam(
  value: string | string[] | undefined,
  paramName: string
): string | null {
  if (!value) {
    return null;
  }
  
  const valueStr = Array.isArray(value) ? value[0] : String(value);
  
  // Block suspicious parameter names
  const suspiciousNames = ['cmd', 'command', 'exec', 'eval', 'system', 'shell'];
  if (suspiciousNames.includes(paramName.toLowerCase())) {
    return null;
  }
  
  // Block malicious patterns
  const maliciousPatterns = [
    /powershell/i,
    /bash.*-sh/i,
    /base64.*bash/i,
    /curl.*http/i,
    /wget.*http/i,
    /exec.*\(/i,
    /eval.*\(/i,
    /child_process/i,
    /spawn.*\(/i,
    /<script/i,
    /javascript:/i,
  ];
  
  if (maliciousPatterns.some(pattern => pattern.test(valueStr))) {
    return null;
  }
  
  // Block suspiciously long base64-like strings
  if (valueStr.length > 200 && /^[A-Za-z0-9+\/]+={0,2}$/.test(valueStr)) {
    return null;
  }
  
  return sanitizeString(valueStr);
}

/**
 * Validate language code
 */
export function validateLanguage(lang: string | undefined): string | null {
  if (!lang) {
    return null;
  }
  
  const validLanguages = ['en', 'cs', 'de', 'fr'];
  const langLower = String(lang).toLowerCase();
  
  if (!validLanguages.includes(langLower)) {
    return null;
  }
  
  return langLower;
}

/**
 * Check if a string contains command injection patterns
 */
export function containsCommandInjection(input: string): boolean {
  const patterns = [
    /[;&|`$(){}[\]]/, // Command separators
    /powershell/i,
    /bash.*-sh/i,
    /cmd\.exe/i,
    /sh -c/i,
    /base64.*\|.*bash/i,
    /curl.*\|.*bash/i,
    /wget.*\|.*bash/i,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Validate URL path segment
 */
export function validatePathSegment(segment: string): boolean {
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9\-_]+$/.test(segment)) {
    return false;
  }
  
  // Block suspicious patterns
  if (containsCommandInjection(segment)) {
    return false;
  }
  
  return true;
}

