/**
 * Unit tests for Election Calendar Service and Translation Service.
 *
 * Validates: calendar deep-link generation, reminder filtering,
 * translation fallback, language code allowlist enforcement.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ElectionCalendarService, ELECTION_REMINDERS } from '../../src/services/calendar';
import { ElectionTranslationService, SUPPORTED_LANGUAGES } from '../../src/services/translation';

// ---- Calendar Service Tests ----

describe('ElectionCalendarService', () => {
  let service: ElectionCalendarService;

  beforeEach(() => {
    service = new ElectionCalendarService();
  });

  it('returns all predefined election reminders', () => {
    const reminders = service.getAllReminders();
    expect(reminders.length).toBeGreaterThan(0);
    expect(reminders).toBe(ELECTION_REMINDERS);
  });

  it('generates a valid Google Calendar URL for each reminder', () => {
    const reminders = service.getAllReminders();
    reminders.forEach((reminder) => {
      const link = service.generateCalendarLink(reminder);
      expect(link).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
      expect(link).toContain('action=TEMPLATE');
      expect(link).toContain('dates=');
      expect(link).toContain('text=');
    });
  });

  it('encodes dates in YYYYMMDD format (no dashes)', () => {
    const reminder = ELECTION_REMINDERS[0];
    const link = service.generateCalendarLink(reminder);
    // Dates in the URL should be YYYYMMDD not YYYY-MM-DD
    expect(link).not.toMatch(/dates=\d{4}-\d{2}-\d{2}/);
    expect(link).toMatch(/dates=\d{8}/);
  });

  it('filters reminders by category correctly', () => {
    const polling = service.getRemindersByCategory('polling');
    expect(polling.every((r) => r.category === 'polling')).toBe(true);

    const deadlines = service.getRemindersByCategory('deadline');
    expect(deadlines.every((r) => r.category === 'deadline')).toBe(true);
  });

  it('includes ECI reference in generated calendar link description', () => {
    const registrationReminder = ELECTION_REMINDERS.find(
      (r) => r.category === 'registration',
    );
    expect(registrationReminder).toBeDefined();
    if (registrationReminder) {
      expect(registrationReminder.description).toContain('nvsp.in');
    }
  });

  it('handles reminder with explicit endDate correctly', () => {
    const reminderWithEnd = {
      title: 'Test Event',
      description: 'Test',
      startDate: '2026-02-01',
      endDate: '2026-02-03',
      isDeadline: false,
      category: 'general' as const,
    };
    const link = service.generateCalendarLink(reminderWithEnd);
    expect(link).toContain('20260201%2F20260203');
  });

  it('all reminders have civic category and isDeadline flag', () => {
    const reminders = service.getAllReminders();
    const validCategories = new Set(['registration', 'polling', 'counting', 'deadline', 'general']);
    reminders.forEach((r) => {
      expect(validCategories.has(r.category)).toBe(true);
      expect(typeof r.isDeadline).toBe('boolean');
    });
  });
});

// ---- Translation Service Tests ----

describe('ElectionTranslationService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('SUPPORTED_LANGUAGES contains Hindi, Telugu, and Tamil at minimum', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('hi');
    expect(codes).toContain('te');
    expect(codes).toContain('ta');
  });

  it('returns original text when API key is absent (no config)', async () => {
    vi.stubEnv('VITE_GOOGLE_TRANSLATION_API_KEY', '');
    const service = new ElectionTranslationService();
    // No API key in test env → isConfigured() returns false → returns original
    const result = await service.translateText('Vote today', 'hi');
    expect(result).toBe('Vote today');
  });

  it('returns original array when API key is absent — batch', async () => {
    vi.stubEnv('VITE_GOOGLE_TRANSLATION_API_KEY', '');
    const service = new ElectionTranslationService();
    const texts = ['Election day', 'Register to vote', 'Find your booth'];
    const result = await service.translateBatch(texts, 'hi');
    expect(result).toEqual(texts);
  });

  it('returns empty array for empty batch input', async () => {
    const service = new ElectionTranslationService();
    const result = await service.translateBatch([], 'hi');
    expect(result).toEqual([]);
  });

  it('rejects invalid language codes and returns original text', async () => {
    const service = new ElectionTranslationService();
    // "xx" is not in the ALLOWED_LANG_CODES set
    const result = await service.translateText('test text', 'xx');
    expect(result).toBe('test text');
  });

  it('rejects injection attempts in language codes', async () => {
    const service = new ElectionTranslationService();
    const injectionAttempt = 'hi; DROP TABLE voters;--';
    const result = await service.translateText('test', injectionAttempt);
    expect(result).toBe('test');
  });

  it('isConfigured returns false when no API key present', () => {
    vi.stubEnv('VITE_GOOGLE_TRANSLATION_API_KEY', '');
    const service = new ElectionTranslationService();
    // In test environment, VITE_ env vars are not set
    expect(service.isConfigured()).toBe(false);
  });
});
