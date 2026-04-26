/**
 * Unit tests for input sanitization utilities.
 *
 * @module tests/unit/sanitize.test
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtmlTags,
  sanitizeUserInput,
  sanitizeUrl,
  truncate,
  removeControlChars,
  sanitizeFull,
} from '../../src/utils/sanitize';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
    );
  });

  it('escapes quotes and backticks', () => {
    expect(escapeHtml('"hello" \'world\' `test`')).toBe(
      '&quot;hello&quot; &#x27;world&#x27; &#96;test&#96;',
    );
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not modify safe strings', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});

describe('stripHtmlTags', () => {
  it('removes all HTML tags', () => {
    expect(stripHtmlTags('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('handles self-closing tags', () => {
    expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
  });

  it('handles nested tags', () => {
    expect(stripHtmlTags('<div><span><a href="#">Link</a></span></div>')).toBe('Link');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtmlTags('No tags here')).toBe('No tags here');
  });
});

describe('sanitizeUserInput', () => {
  it('strips HTML and escapes special characters', () => {
    expect(sanitizeUserInput('<b>Hello</b> & "World"')).toBe('Hello &amp; &quot;World&quot;');
  });

  it('trims whitespace', () => {
    expect(sanitizeUserInput('  spaced  ')).toBe('spaced');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeUserInput(42 as unknown as string)).toBe('');
    expect(sanitizeUserInput(null as unknown as string)).toBe('');
    expect(sanitizeUserInput(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('allows https URLs', () => {
    expect(sanitizeUrl('https://eci.gov.in')).toBe('https://eci.gov.in');
  });

  it('allows http URLs', () => {
    expect(sanitizeUrl('http://nvsp.in')).toBe('http://nvsp.in');
  });

  it('allows mailto URLs', () => {
    expect(sanitizeUrl('mailto:info@eci.gov.in')).toBe('mailto:info@eci.gov.in');
  });

  it('blocks javascript: protocol', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('blocks data: protocol', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('allows relative URLs', () => {
    expect(sanitizeUrl('/about')).toBe('/about');
    expect(sanitizeUrl('#section')).toBe('#section');
    expect(sanitizeUrl('./page')).toBe('./page');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeUrl(123 as unknown as string)).toBe('');
  });

  it('blocks invalid non-relative URLs', () => {
    expect(sanitizeUrl('not-a-valid-url:')).toBe('');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    const long = 'a'.repeat(3000);
    expect(truncate(long).length).toBe(2000);
  });

  it('does not truncate short strings', () => {
    expect(truncate('short')).toBe('short');
  });

  it('respects custom maxLength', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde');
  });

  it('handles non-string input gracefully', () => {
    expect(truncate(null as unknown as string)).toBe('');
  });
});

describe('removeControlChars', () => {
  it('removes null bytes', () => {
    expect(removeControlChars('hello\x00world')).toBe('helloworld');
  });

  it('removes control characters but keeps newlines and tabs', () => {
    expect(removeControlChars('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('removes backspace and other control chars', () => {
    expect(removeControlChars('ab\x08cd\x1Fef')).toBe('abcdef');
  });
});

describe('sanitizeFull', () => {
  it('applies full sanitization pipeline', () => {
    const malicious = '<script>alert("xss")</script>\x00  ';
    const result = sanitizeFull(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('\x00');
    expect(result).toBe('alert(&quot;xss&quot;)');
  });

  it('respects custom max length', () => {
    const result = sanitizeFull('a'.repeat(500), 10);
    expect(result.length).toBe(10);
  });

  it('handles non-string input', () => {
    expect(sanitizeFull(undefined as unknown as string)).toBe('');
  });
});
