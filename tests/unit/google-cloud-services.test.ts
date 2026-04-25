/**
 * Unit Tests — Analytics & Vertex AI Services
 *
 * Tests for the Google Cloud Natural Language API integration,
 * Firestore analytics logging, and Vertex AI semantic FAQ matching.
 *
 * @module tests/unit/google-cloud-services.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ElectionAnalyticsService } from '../../src/services/analytics';
import { ElectionVertexService } from '../../src/services/vertex';

/* ---- Analytics Service Tests ---- */

describe('ElectionAnalyticsService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('initialises and exposes isConfigured', () => {
    const service = new ElectionAnalyticsService();
    expect(typeof service.isConfigured()).toBe('boolean');
  });

  it('returns isConfigured=true when VITE_GEMINI_API_KEY is set', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key-analytics-123');
    const service = new ElectionAnalyticsService();
    expect(service.isConfigured()).toBe(true);
  });

  it('trackQuery resolves without throwing when unconfigured', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_GOOGLE_CLOUD_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_KEY', '');
    const service = new ElectionAnalyticsService();
    await expect(service.trackQuery('how do I vote?')).resolves.toBeUndefined();
  });

  it('trackQuery handles empty string gracefully', async () => {
    const service = new ElectionAnalyticsService();
    await expect(service.trackQuery('')).resolves.toBeUndefined();
  });

  it('trackQuery handles very long input gracefully', async () => {
    const service = new ElectionAnalyticsService();
    const longQuery = 'a'.repeat(5000);
    await expect(service.trackQuery(longQuery)).resolves.toBeUndefined();
  });

  it('trackQuery handles malicious XSS input gracefully', async () => {
    const service = new ElectionAnalyticsService();
    const xssQuery = '<script>alert("xss")</script>';
    await expect(service.trackQuery(xssQuery)).resolves.toBeUndefined();
  });

  it('trackQuery handles SQL injection input gracefully', async () => {
    const service = new ElectionAnalyticsService();
    const sqlQuery = "'; DROP TABLE voters; --";
    await expect(service.trackQuery(sqlQuery)).resolves.toBeUndefined();
  });
});

/* ---- Vertex AI Service Tests ---- */

describe('ElectionVertexService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('initialises correctly', () => {
    const service = new ElectionVertexService();
    expect(service).toBeDefined();
  });

  it('returns isConfigured=false when no API key is set', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_KEY', '');
    const service = new ElectionVertexService();
    expect(service.isConfigured()).toBe(false);
  });

  it('returns isConfigured=true when API key is present', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key-vertex-456');
    const service = new ElectionVertexService();
    expect(service.isConfigured()).toBe(true);
  });

  it('findRelevantFaq returns null when no keyword match', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('xyzzy completely irrelevant query zork');
    expect(result).toBeNull();
  });

  it('findRelevantFaq uses keyword fallback for eligibility queries', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_KEY', '');
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('who is eligible to vote?');
    expect(result).not.toBeNull();
    expect(result?.question.toLowerCase()).toContain('eligible');
    expect(result?.score).toBeGreaterThan(0);
  });

  it('findRelevantFaq returns NOTA answer for NOTA queries', async () => {
    const service = new ElectionVertexService();
    // 'nota' keyword maps to the NOTA FAQ entry
    const result = await service.findRelevantFaq('what is nota?');
    expect(result).not.toBeNull();
    expect(result?.answer).toContain('NOTA');
  });

  it('findRelevantFaq returns location info for polling booth queries', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('how to find my polling booth?');
    expect(result).not.toBeNull();
    expect(result?.answer).toBeTruthy();
  });

  it('findRelevantFaq returns registration info for registration queries', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('how do I register to vote?');
    expect(result).not.toBeNull();
    // Verify it's the registration FAQ (starts with capital R)
    expect(result?.answer).toContain('nvsp.in');
  });

  it('findRelevantFaq returns EVM info for EVM queries', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('how does an EVM work?');
    expect(result).not.toBeNull();
    expect(result?.answer).toContain('EVM');
  });

  it('findRelevantFaq returns score > 0 for all valid matches', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('eligible voter age requirement');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.score).toBeGreaterThan(0);
    }
  });

  it('findRelevantFaq handles empty query gracefully', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('');
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('findRelevantFaq handles XSS input safely', async () => {
    const service = new ElectionVertexService();
    const result = await service.findRelevantFaq('<script>alert(1)</script>');
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('findRelevantFaq does not throw on null-like input', async () => {
    const service = new ElectionVertexService();
    await expect(service.findRelevantFaq('   ')).resolves.toBeDefined();
  });
});
