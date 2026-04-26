/**
 * Surgical coverage filler tests — targets EVERY remaining uncovered branch and line.
 *
 * Current gaps to fix:
 *   maps.ts        → lines 64-65 (isLoaded early return), 139-140 (cache hit),
 *                    199-202 (fallback values in Places callback), 175-195 (error statuses)
 *   analytics.ts   → line 160 (entities present), 165-167 (catch), 260-267 (sentiment),
 *                    279-283 (session fallback)
 *   api-client.ts  → line 110 (?? 1), line 141 (non-Error thrown), line 147 (timeout)
 *   election-stages.ts → line 423 (getStagePosition -1)
 *   gemini.ts      → lines 364 (tool non-success), 369 (empty responseText || null)
 *   sanitize.ts    → line 31 (escapeHtml)
 *   vertex.ts      → lines 222-225 (cosineSimilarity), 227 b[i]??0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectionMapsService } from '../../src/services/maps';
import { ElectionTranslationService } from '../../src/services/translation';
import { ElectionCoachService } from '../../src/services/gemini';
import { ElectionVertexService } from '../../src/services/vertex';
import { ElectionAnalyticsService } from '../../src/services/analytics';
import { SafeApiClient } from '../../src/services/api-client';
import { sanitizeUrl, escapeHtml } from '../../src/utils/sanitize';
import { validateStageId } from '../../src/utils/validate';
import { getStagePosition } from '../../src/data/election-stages';

describe('Coverage Filler Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════
  // MAPS.TS
  // ═══════════════════════════════════════════════════════

  describe('ElectionMapsService', () => {
    it('loadMapsApi returns true immediately when already loaded (line 64-65)', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.isLoaded = true;
      const result = await service.loadMapsApi();
      expect(result).toBe(true);
    });

    it('loadMapsApi resolves true when google.maps is already in window', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      globalThis.google = { maps: { Map: vi.fn(), places: {} } };
      const result = await service.loadMapsApi();
      expect(result).toBe(true);
      // @ts-ignore
      delete globalThis.google;
    });

    it('loadMapsApi resolves true via script.onload', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      if (typeof globalThis.google !== 'undefined') delete globalThis.google;

      const mockScript: any = { src: '', async: false, defer: false, onload: null, onerror: null };
      vi.spyOn(document, 'createElement').mockReturnValue(mockScript);
      vi.spyOn(document.head, 'appendChild').mockImplementation((el: any) => {
        setTimeout(() => el.onload?.(), 0);
        return el;
      });

      const result = await service.loadMapsApi();
      expect(result).toBe(true);
    });

    it('loadMapsApi resolves false via script.onerror', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      if (typeof globalThis.google !== 'undefined') delete globalThis.google;

      const mockScript: any = { src: '', async: false, defer: false, onload: null, onerror: null };
      vi.spyOn(document, 'createElement').mockReturnValue(mockScript);
      vi.spyOn(document.head, 'appendChild').mockImplementation((el: any) => {
        setTimeout(() => el.onerror?.(), 0);
        return el;
      });

      const result = await service.loadMapsApi();
      expect(result).toBe(false);
    });

    it('searchPollingLocations returns cached result on second call (line 139-140)', async () => {
      const service = new ElectionMapsService();
      // Pre-populate cache with the exact key the service will generate for 'delhi'
      // Key = makeCacheKey('maps', sanitizeFull('delhi', 200).toLowerCase()) = 'maps:delhi'
      // @ts-ignore
      service.cache.set('maps:delhi', [{ name: 'Cached Booth', address: 'Test Address', latitude: 0, longitude: 0 }]);
      // This call should hit the cache directly (lines 138-140)
      const res = await service.searchPollingLocations('delhi');
      expect(res.ok).toBe(true);
      expect(res.data![0].name).toBe('Cached Booth');
    });

    it('searchWithPlacesApi returns error without mapInstance', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      const res = await service.searchWithPlacesApi('test', 'cache-key');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Map not initialised');
    });

    it('searchWithPlacesApi maps fallback values for missing place fields (lines 199-202)', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.isLoaded = true;
      // @ts-ignore
      service.mapInstance = {};

      const mockTextSearch = vi.fn((_req: unknown, cb: (results: any[], status: string) => void) => {
        cb(
          [{ name: undefined, formatted_address: undefined, geometry: undefined }],
          'OK',
        );
      });

      // @ts-ignore
      globalThis.google = {
        maps: {
          places: {
            PlacesService: vi.fn(() => ({ textSearch: mockTextSearch })),
            PlacesServiceStatus: { OK: 'OK', REQUEST_DENIED: 'REQUEST_DENIED', ZERO_RESULTS: 'ZERO_RESULTS' },
          },
          Marker: vi.fn(),
        },
      };

      // @ts-ignore
      const res = await service.searchWithPlacesApi('test query', 'cache-key-test');
      expect(res.ok).toBe(true);
      expect(res.data![0].name).toBe('Unknown Location');
      expect(res.data![0].address).toBe('Address unavailable');
      expect(res.data![0].latitude).toBe(0);
      expect(res.data![0].longitude).toBe(0);

      // @ts-ignore
      delete globalThis.google;
    });

    it('searchWithPlacesApi handles REQUEST_DENIED error', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.isLoaded = true;
      // @ts-ignore
      service.mapInstance = {};

      const mockTextSearch = vi.fn((_req: unknown, cb: (results: null, status: string) => void) => {
        cb(null, 'REQUEST_DENIED');
      });

      // @ts-ignore
      globalThis.google = {
        maps: {
          places: {
            PlacesService: vi.fn(() => ({ textSearch: mockTextSearch })),
            PlacesServiceStatus: { OK: 'OK', REQUEST_DENIED: 'REQUEST_DENIED', ZERO_RESULTS: 'ZERO_RESULTS' },
          },
        },
      };

      // @ts-ignore
      const res = await service.searchWithPlacesApi('test', 'cache-key');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Request Denied');
      // @ts-ignore
      delete globalThis.google;
    });

    it('searchWithPlacesApi handles ZERO_RESULTS error', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.isLoaded = true;
      // @ts-ignore
      service.mapInstance = {};

      const mockTextSearch = vi.fn((_req: unknown, cb: (results: null, status: string) => void) => {
        cb(null, 'ZERO_RESULTS');
      });

      // @ts-ignore
      globalThis.google = {
        maps: {
          places: {
            PlacesService: vi.fn(() => ({ textSearch: mockTextSearch })),
            PlacesServiceStatus: { OK: 'OK', REQUEST_DENIED: 'REQUEST_DENIED', ZERO_RESULTS: 'ZERO_RESULTS' },
          },
        },
      };

      // @ts-ignore
      const res = await service.searchWithPlacesApi('test', 'cache-key');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('No polling locations');
      // @ts-ignore
      delete globalThis.google;
    });

    it('searchWithPlacesApi handles generic error status', async () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.isLoaded = true;
      // @ts-ignore
      service.mapInstance = {};

      const mockTextSearch = vi.fn((_req: unknown, cb: (results: null, status: string) => void) => {
        cb(null, 'OVER_QUERY_LIMIT');
      });

      // @ts-ignore
      globalThis.google = {
        maps: {
          places: {
            PlacesService: vi.fn(() => ({ textSearch: mockTextSearch })),
            PlacesServiceStatus: { OK: 'OK', REQUEST_DENIED: 'REQUEST_DENIED', ZERO_RESULTS: 'ZERO_RESULTS' },
          },
        },
      };

      // @ts-ignore
      const res = await service.searchWithPlacesApi('test', 'cache-key');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('OVER_QUERY_LIMIT');
      // @ts-ignore
      delete globalThis.google;
    });

    it('initMap creates map instance when container exists', () => {
      const service = new ElectionMapsService();
      // @ts-ignore
      service.isLoaded = true;
      document.body.innerHTML = '<div id="map-test"></div>';
      // @ts-ignore
      globalThis.google = { maps: { Map: vi.fn() } };
      const result = service.initMap('map-test');
      expect(result).toBe(true);
      // @ts-ignore
      delete globalThis.google;
    });
  });

  // ═══════════════════════════════════════════════════════
  // ANALYTICS.TS
  // ═══════════════════════════════════════════════════════

  describe('ElectionAnalyticsService', () => {
    it('trackQuery catches errors silently (line 165-167)', async () => {
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service as any, 'analyseWithNaturalLanguage').mockRejectedValue(new Error('NL API down'));
      await expect(service.trackQuery('test crash')).resolves.toBeUndefined();
    });

    it('trackQuery processes entities when NL API returns them (line 160)', async () => {
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service as any, 'analyseWithNaturalLanguage').mockResolvedValue({
        entities: [
          { name: 'India', type: 'LOCATION', salience: 0.9 },
          { name: 'ECI', type: 'ORGANIZATION', salience: 0.7 },
        ],
        documentSentiment: { score: 0.2, magnitude: 0.5 },
        language: 'en',
      });
      // @ts-ignore
      vi.spyOn(service as any, 'logToFirestore').mockResolvedValue(undefined);
      await expect(service.trackQuery('election in India by ECI')).resolves.toBeUndefined();
    });

    it('normaliseSentiment returns positive for score > 0.15', () => {
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      expect(service.normaliseSentiment({ score: 0.5, magnitude: 1.0 })).toBe('positive');
    });

    it('normaliseSentiment returns negative for score < -0.15', () => {
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      expect(service.normaliseSentiment({ score: -0.5, magnitude: 1.0 })).toBe('negative');
    });

    it('normaliseSentiment returns neutral for score between -0.15 and 0.15', () => {
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      expect(service.normaliseSentiment({ score: 0.0, magnitude: 0.1 })).toBe('neutral');
    });

    it('normaliseSentiment returns neutral when sentiment is undefined', () => {
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      expect(service.normaliseSentiment(undefined)).toBe('neutral');
    });

    it('generateSessionId falls back when crypto.randomUUID is unavailable (line 283)', () => {
      const origRandom = crypto.randomUUID;
      // @ts-ignore
      crypto.randomUUID = undefined;
      const service = new ElectionAnalyticsService();
      // @ts-ignore
      const id = service.sessionId;
      expect(id).toMatch(/^session-/);
      crypto.randomUUID = origRandom;
    });
  });

  // ═══════════════════════════════════════════════════════
  // API-CLIENT.TS
  // ═══════════════════════════════════════════════════════

  describe('SafeApiClient', () => {
    it('returns timeout message when fetch aborts (line 147)', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted'));
      const client = new SafeApiClient({ baseUrl: 'https://example.com', timeoutMs: 100, retries: 0 });
      const result = await client.get('/test');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Request timed out. Please check your connection.');
      globalThis.fetch = origFetch;
    });

    it('returns network error for non-abort failures', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const client = new SafeApiClient({ baseUrl: 'https://example.com', timeoutMs: 100, retries: 0 });
      const result = await client.get('/test');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error. Please try again later.');
      globalThis.fetch = origFetch;
    });

    it('uses default retries=1 when retries is undefined (line 110)', async () => {
      const origFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('fail'));
      });
      const client = new SafeApiClient({ baseUrl: 'https://example.com', timeoutMs: 100, retries: undefined });
      await client.get('/test');
      expect(callCount).toBe(2); // attempt 0 + retry 1
      globalThis.fetch = origFetch;
    });

    it('handles non-Error thrown objects (line 141)', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue('plain string error');
      const client = new SafeApiClient({ baseUrl: 'https://example.com', timeoutMs: 100, retries: 0 });
      const result = await client.get('/test');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error. Please try again later.');
      globalThis.fetch = origFetch;
    });
  });

  // ═══════════════════════════════════════════════════════
  // ELECTION-STAGES.TS
  // ═══════════════════════════════════════════════════════

  describe('getStagePosition', () => {
    it('returns -1 for invalid stage ID (line 423)', () => {
      // @ts-ignore
      expect(getStagePosition('invalid-stage-id')).toBe(-1);
    });
  });

  // ═══════════════════════════════════════════════════════
  // SANITIZE.TS
  // ═══════════════════════════════════════════════════════

  describe('sanitize utils', () => {
    it('escapeHtml escapes known HTML entities (exercises line 31)', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
      expect(escapeHtml("it's")).toBe('it&#x27;s');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('a/b')).toBe('a&#x2F;b');
      expect(escapeHtml('`code`')).toBe('&#96;code&#96;');
    });

    it('sanitizeUrl returns empty for non-URL strings', () => {
      expect(sanitizeUrl('not_a_valid_url')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════
  // VERTEX.TS
  // ═══════════════════════════════════════════════════════

  describe('ElectionVertexService', () => {
    it('cosineSimilarity handles length mismatch (line 223)', () => {
      const service = new ElectionVertexService();
      // @ts-ignore
      expect(service.cosineSimilarity([1, 2], [1])).toBe(0);
    });

    it('cosineSimilarity handles zero magnitude vectors (line 231)', () => {
      const service = new ElectionVertexService();
      // @ts-ignore
      expect(service.cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });

    it('cosineSimilarity handles empty arrays (line 223)', () => {
      const service = new ElectionVertexService();
      // @ts-ignore
      expect(service.cosineSimilarity([], [])).toBe(0);
    });

    it('findRelevantFaq catches error and falls back to keywordFallback', async () => {
      const service = new ElectionVertexService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service as any, 'embedText').mockRejectedValue(new Error('fail'));
      const res = await service.findRelevantFaq('test');
      expect(res).toBeNull();
    });

    it('findRelevantFaq hits success path with mocked embeddings', async () => {
      const service = new ElectionVertexService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore — all embeddings return same vector → cosine = 1.0 > 0.5 threshold
      vi.spyOn(service as any, 'embedText').mockResolvedValue([0.5, 0.8, 0.3]);
      const res = await service.findRelevantFaq('eligibility');
      expect(res).not.toBeNull();
      expect(res!.score).toBeGreaterThan(0.5);
    });
  });

  // ═══════════════════════════════════════════════════════
  // GEMINI.TS
  // ═══════════════════════════════════════════════════════

  describe('ElectionCoachService', () => {
    it('is not configured when all env vars are empty (line 242)', () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', '');
      vi.stubEnv('VITE_GEMINI_KEY', '');
      vi.stubEnv('VITE_GEMINI_MODEL', '');
      const service = new ElectionCoachService();
      expect(service.isConfigured()).toBe(false);
      vi.unstubAllEnvs();
    });

    it('callGeminiApi returns "Service unavailable" for failed tool call (line 364)', async () => {
      const service = new ElectionCoachService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service as any, 'processToolCall').mockReturnValue({
        toolName: 'find_polling_booth',
        args: {},
        result: null,
        status: 'error',
      });
      // @ts-ignore
      vi.spyOn(service.client, 'post').mockResolvedValue({
        ok: true,
        data: {
          candidates: [{
            content: {
              parts: [{ functionCall: { name: 'find_polling_booth', args: {} } }],
              role: 'model',
            },
          }],
        },
      });
      // @ts-ignore
      const result = await service.callGeminiApi('find booth');
      expect(result).toContain('Service unavailable');
    });

    it('callGeminiApi returns null when responseText is empty (line 369)', async () => {
      const service = new ElectionCoachService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service.client, 'post').mockResolvedValue({
        ok: true,
        data: {
          candidates: [{ content: { parts: [], role: 'model' } }],
        },
      });
      // @ts-ignore
      const result = await service.callGeminiApi('empty response test');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════
  // TRANSLATION.TS
  // ═══════════════════════════════════════════════════════

  describe('ElectionTranslationService', () => {
    it('translateText hits cache on second call', async () => {
      const service = new ElectionTranslationService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service.client, 'post').mockResolvedValue({
        ok: true,
        data: { data: { translations: [{ translatedText: 'translated' }] } },
      });
      await service.translateText('hello', 'hi');
      const res2 = await service.translateText('hello', 'hi');
      expect(res2).toBe('translated');
    });

    it('translateText returns original on API failure', async () => {
      const service = new ElectionTranslationService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service.client, 'post').mockRejectedValue(new Error('fail'));
      expect(await service.translateText('fail', 'hi')).toBe('fail');
    });

    it('translateBatch returns originals on API failure', async () => {
      const service = new ElectionTranslationService();
      // @ts-ignore
      service.apiKey = 'test-key';
      // @ts-ignore
      vi.spyOn(service.client, 'post').mockRejectedValue(new Error('fail'));
      expect(await service.translateBatch(['fail'], 'hi')).toEqual(['fail']);
    });
  });

  // ═══════════════════════════════════════════════════════
  // VALIDATE.TS
  // ═══════════════════════════════════════════════════════

  describe('validate', () => {
    it('validateStageId rejects non-string', () => {
      expect(validateStageId(123).isValid).toBe(false);
    });
  });
});
