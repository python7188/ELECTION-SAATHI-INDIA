/**
 * Unit tests for Google service clients.
 *
 * Tests Gemini, Calendar, and Maps services with mocked APIs.
 *
 * @module tests/unit/services.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ElectionCoachService, ELECTION_TOOLS } from '../../src/services/gemini';
import { ElectionMapsService } from '../../src/services/maps';

/* ---- Gemini Service ---- */
describe('ElectionCoachService', () => {
  let coach: ElectionCoachService;

  beforeEach(() => {
    coach = new ElectionCoachService();
  });

  it('reports configured when API key is mocked', () => {
    const originalApiKey = coach['apiKey'];
    // @ts-ignore: overriding readonly property for test
    coach['apiKey'] = 'fake_api_key';
    expect(coach.isConfigured()).toBe(true);
    // @ts-ignore: overriding readonly property for test
    coach['apiKey'] = originalApiKey;
  });

  it('provides static fallback for eligibility questions', async () => {
    const response = await coach.chat('Am I eligible to vote?');
    expect(response.role).toBe('assistant');
    expect(response.content).toContain('18');
    expect(response.content.toLowerCase()).toContain('vote');
  });

  it('provides static fallback for registration questions', async () => {
    const response = await coach.chat('How do I register to vote?');
    expect(response.content).toContain('nvsp.in');
    expect(response.content).toContain('Form 6');
  });

  it('provides static fallback for EVM questions', async () => {
    const response = await coach.chat('Are EVMs safe?');
    expect(response.content.toLowerCase()).toContain('evm');
  });

  it('provides static fallback for NOTA questions', async () => {
    const response = await coach.chat('What is NOTA?');
    expect(response.content.toLowerCase()).toContain('nota');
  });

  it('provides static fallback for booth finding', async () => {
    const response = await coach.chat('Where is my polling booth?');
    expect(response.content.toLowerCase()).toContain('booth');
  });

  it('provides static fallback for Lok Sabha questions', async () => {
    const response = await coach.chat('Tell me about Lok Sabha elections');
    expect(response.content).toContain('543');
  });

  it('provides static fallback for Panchayat questions', async () => {
    const response = await coach.chat('How do panchayat elections work?');
    expect(response.content).toContain('73rd Amendment');
  });

  it('provides static fallback for Municipal questions', async () => {
    const response = await coach.chat('Tell me about municipal corporation elections');
    expect(response.content).toContain('74th Amendment');
  });

  it('provides generic welcome for unknown queries', async () => {
    const response = await coach.chat('Hello');
    expect(response.content).toContain('Election Saathi');
  });

  it('caches repeated queries', async () => {
    const first = await coach.chat('Am I eligible to vote?');
    const second = await coach.chat('Am I eligible to vote?');
    expect(first.content).toBe(second.content);
  });

  it('sanitizes user input', async () => {
    const response = await coach.chat('<script>alert("xss")</script>');
    expect(response.content).not.toContain('<script>');
  });

  it('records conversation history', async () => {
    await coach.chat('First question');
    await coach.chat('Second question');
    const history = coach.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
  });

  it('clears history', async () => {
    await coach.chat('Question');
    coach.clearHistory();
    expect(coach.getHistory()).toHaveLength(0);
  });
});

describe('ELECTION_TOOLS', () => {
  it('defines 5 tool declarations', () => {
    expect(ELECTION_TOOLS).toHaveLength(5);
  });

  it('every tool has required fields', () => {
    for (const tool of ELECTION_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.required.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('includes translate_text tool', () => {
    const found = ELECTION_TOOLS.find((t) => t.name === 'translate_text');
    expect(found).toBeDefined();
    expect(found?.parameters.required).toContain('text');
    expect(found?.parameters.required).toContain('targetLang');
  });

  it('includes polling location tool', () => {
    const found = ELECTION_TOOLS.find((t) => t.name === 'find_polling_location');
    expect(found).toBeDefined();
    expect(found?.parameters.required).toContain('query');
  });

  it('includes FAQ lookup tool', () => {
    const found = ELECTION_TOOLS.find((t) => t.name === 'lookup_election_faq');
    expect(found).toBeDefined();
  });

  it('includes eligibility checker tool', () => {
    const found = ELECTION_TOOLS.find((t) => t.name === 'check_voter_eligibility');
    expect(found).toBeDefined();
  });

  it('includes timeline tool', () => {
    const found = ELECTION_TOOLS.find((t) => t.name === 'get_election_timeline');
    expect(found).toBeDefined();
    expect(found?.parameters.properties['election_type'].enum).toContain('LOK_SABHA');
  });
});

/* ---- Maps Service ---- */
describe('ElectionMapsService', () => {
  let maps: ElectionMapsService;

  beforeEach(() => {
    maps = new ElectionMapsService();
  });

  it('reports configured when API key is mocked', () => {
    // Override the API key for this test
    const originalApiKey = maps['apiKey'];
    // @ts-ignore: overriding readonly property for test
    maps['apiKey'] = 'fake_api_key';
    expect(maps.isConfigured()).toBe(true);
    // @ts-ignore: overriding readonly property for test
    maps['apiKey'] = originalApiKey;
  });

  it('generates Google Maps search link', () => {
    const link = maps.generateMapsLink('polling booth Andheri Mumbai');
    expect(link).toContain('google.com/maps/search');
    expect(link).toContain('polling');
  });

  it('sanitizes map search inputs', () => {
    const link = maps.generateMapsLink('<script>alert(1)</script>');
    expect(link).not.toContain('<script>');
  });

  it('generates Maps embed URL without key', () => {
    const url = maps.generateMapsEmbedUrl('election office Delhi');
    expect(url).toContain('google.com/maps');
    expect(url).toContain('election');
  });

  it('returns fallback locations when not loaded', async () => {
    const result = await maps.searchPollingLocations('Delhi');
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null geolocation in test environment', async () => {
    const location = await maps.getUserLocation();
    expect(location).toBeNull();
  });
});
