/**
 * Server-side input validation utilities
 */

// Magnet URI validation regex
// Format: magnet:?xt=urn:btih:<infohash>&dn=<name>&tr=<tracker>
const MAGNET_URI_REGEX = /^magnet:\?xt=urn:[a-z0-9]+:[a-zA-Z0-9]{32,40}/i;
const MAX_MAGNET_LENGTH = 1000;

// Room code validation
const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz]{6}$/;

// Display name validation
const DISPLAY_NAME_REGEX = /^[\p{L}\p{N}\s\-_']+$/u;

/**
 * Validate a magnet URI
 * @param uri - The magnet URI to validate
 * @returns true if valid, false otherwise
 */
export function isValidMagnetUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') {
    return false;
  }

  // Check length
  if (uri.length > MAX_MAGNET_LENGTH) {
    return false;
  }

  // Check format
  if (!MAGNET_URI_REGEX.test(uri)) {
    return false;
  }

  return true;
}

/**
 * Validate a room code
 * @param code - The room code to validate
 * @returns true if valid, false otherwise
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  return ROOM_CODE_REGEX.test(code);
}

/**
 * Validate a display name
 * @param name - The display name to validate
 * @returns true if valid, false otherwise
 */
export function isValidDisplayName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const trimmed = name.trim();
  
  // Length check
  if (trimmed.length < 1 || trimmed.length > 30) {
    return false;
  }

  // Character check (allow letters, numbers, spaces, hyphens, underscores, apostrophes)
  if (!DISPLAY_NAME_REGEX.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Validate chat message content
 * @param content - The message content to validate
 * @returns Object with isValid and sanitized content
 */
export function validateChatMessage(content: string, maxLength: number = 500): { 
  isValid: boolean; 
  sanitized: string;
  error?: string;
} {
  if (!content || typeof content !== 'string') {
    return { isValid: false, sanitized: '', error: 'Message content is required' };
  }

  // Trim whitespace
  const trimmed = content.trim();

  // Check length
  if (trimmed.length === 0) {
    return { isValid: false, sanitized: '', error: 'Message cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, sanitized: '', error: `Message exceeds ${maxLength} characters` };
  }

  // Basic sanitization - remove control characters except newlines
  const sanitized = trimmed.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return { isValid: true, sanitized };
}

/**
 * Validate file index for torrent
 * @param index - The file index
 * @param maxFiles - Maximum number of files
 * @returns true if valid, false otherwise
 */
export function isValidFileIndex(index: number, maxFiles: number): boolean {
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    return false;
  }

  return index >= 0 && index < maxFiles;
}

/**
 * Sanitize a string for safe logging (remove sensitive data)
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeForLogging(str: string): string {
  // Truncate long strings
  if (str.length > 100) {
    return str.substring(0, 100) + '...';
  }
  
  // Remove potential sensitive patterns
  return str
    .replace(/(?:password|token|secret|key)[=:]\s*\S+/gi, '[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns true if valid URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate addon URL (must be http or https)
 * @param url - Addon URL to validate
 * @returns true if valid addon URL
 */
export function isValidAddonUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
