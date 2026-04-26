/**
 * Input Sanitization — Defence against injection and XSS.
 *
 * Every user-provided string passes through this module
 * before being rendered or sent to an API.
 *
 * @module utils/sanitize
 */

/** Characters that must be escaped in HTML output. */
const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/** Pattern matching all HTML-sensitive characters. */
const HTML_ESCAPE_REGEX = /[&<>"'/`]/g;

/**
 * Escape HTML-sensitive characters to prevent XSS.
 *
 * @param input - Raw string to escape.
 * @returns HTML-safe string.
 */
export function escapeHtml(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return input.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char as keyof typeof HTML_ESCAPE_MAP] as string);
}

/**
 * Strip all HTML tags from a string.
 *
 * @param input - String potentially containing HTML.
 * @returns Plain text with all tags removed.
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize user input for safe display.
 *
 * Strips HTML tags, escapes remaining characters, and trims whitespace.
 *
 * @param input - Raw user input.
 * @returns Sanitised string safe for DOM insertion.
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  const stripped = stripHtmlTags(input);
  const escaped = escapeHtml(stripped);
  return escaped.trim();
}

/**
 * Sanitize a URL to prevent javascript: and data: protocol attacks.
 *
 * Only allows http:, https:, and mailto: protocols.
 *
 * @param url - Raw URL string.
 * @returns Sanitised URL or empty string if unsafe.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }
  const trimmed = url.trim();
  const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

  try {
    const parsed = new URL(trimmed);
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return trimmed;
    }
    return '';
  } catch {
    // Relative URLs are allowed
    if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('.')) {
      return trimmed;
    }
    return '';
  }
}

/**
 * Limit string length to prevent buffer abuse.
 *
 * @param input - Input string.
 * @param maxLength - Maximum allowed characters (default: 2000).
 * @returns Truncated string if exceeding limit.
 */
export function truncate(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.length > maxLength ? input.slice(0, maxLength) : input;
}

/**
 * Remove control characters and null bytes from input.
 *
 * @param input - Raw input string.
 * @returns String with control characters removed.
 */
export function removeControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Full sanitization pipeline for user input destined for the DOM.
 *
 * Applies: length limit → control char removal → HTML strip → HTML escape → trim.
 *
 * @param input - Raw user input.
 * @param maxLength - Maximum characters allowed.
 * @returns Fully sanitised string.
 */
export function sanitizeFull(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') {
    return '';
  }
  const limited = truncate(input, maxLength);
  const cleaned = removeControlChars(limited);
  return sanitizeUserInput(cleaned);
}
