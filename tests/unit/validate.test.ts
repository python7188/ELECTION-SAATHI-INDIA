/**
 * Unit tests for input validation utilities.
 *
 * @module tests/unit/validate.test
 */

import { describe, it, expect } from 'vitest';
import {
  validateCoachQuery,
  validateElectionCategory,
  validateStageId,
  validateVoterAge,
  validatePinCode,
  validateEpicNumber,
} from '../../src/utils/validate';
import { ElectionCategory, JourneyStageId } from '../../src/types/index';

describe('validateCoachQuery', () => {
  it('accepts valid query', () => {
    const result = validateCoachQuery('How do I register to vote?');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitizedValue).toBeDefined();
  });

  it('rejects empty string', () => {
    const result = validateCoachQuery('   ');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Query cannot be empty.');
  });

  it('rejects overly long query', () => {
    const result = validateCoachQuery('a'.repeat(2001));
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('2000 characters');
  });

  it('rejects non-string input', () => {
    const result = validateCoachQuery(42);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('string');
  });

  it('sanitizes HTML in valid query', () => {
    const result = validateCoachQuery('<b>How to vote?</b>');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).not.toContain('<b>');
  });
});

describe('validateElectionCategory', () => {
  it('accepts all valid categories', () => {
    for (const cat of Object.values(ElectionCategory)) {
      const result = validateElectionCategory(cat);
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects invalid category', () => {
    const result = validateElectionCategory('INVALID_TYPE');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid election category');
  });

  it('rejects non-string input', () => {
    const result = validateElectionCategory(123);
    expect(result.isValid).toBe(false);
  });
});

describe('validateStageId', () => {
  it('accepts all valid stage IDs', () => {
    for (const id of Object.values(JourneyStageId)) {
      const result = validateStageId(id);
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects invalid stage ID', () => {
    const result = validateStageId('nonexistent');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid stage ID');
  });
});

describe('validateVoterAge', () => {
  it('confirms eligibility for age 18+', () => {
    const result = validateVoterAge(25);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toContain('eligible to vote');
  });

  it('informs ineligibility for age under 18', () => {
    const result = validateVoterAge(16);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toContain('eligible in 2 year(s)');
  });

  it('rejects NaN', () => {
    const result = validateVoterAge(NaN);
    expect(result.isValid).toBe(false);
  });

  it('rejects non-number input', () => {
    const result = validateVoterAge('eighteen');
    expect(result.isValid).toBe(false);
  });

  it('rejects negative age', () => {
    const result = validateVoterAge(-5);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('between 0 and 150');
  });

  it('rejects non-integer age', () => {
    const result = validateVoterAge(18.5);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('whole number');
  });
});

describe('validatePinCode', () => {
  it('accepts valid 6-digit PIN', () => {
    const result = validatePinCode('110001');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('110001');
  });

  it('rejects PIN starting with 0', () => {
    const result = validatePinCode('010001');
    expect(result.isValid).toBe(false);
  });

  it('rejects short PIN', () => {
    const result = validatePinCode('1234');
    expect(result.isValid).toBe(false);
  });

  it('rejects non-numeric PIN', () => {
    const result = validatePinCode('ABCDEF');
    expect(result.isValid).toBe(false);
  });

  it('trims whitespace', () => {
    const result = validatePinCode(' 400001 ');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('400001');
  });

  it('rejects non-string input', () => {
    const result = validatePinCode(123456);
    expect(result.isValid).toBe(false);
  });
});

describe('validateEpicNumber', () => {
  it('accepts valid EPIC number', () => {
    const result = validateEpicNumber('ABC1234567');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('ABC1234567');
  });

  it('uppercases lowercase input', () => {
    const result = validateEpicNumber('abc1234567');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('ABC1234567');
  });

  it('rejects wrong format', () => {
    const result = validateEpicNumber('1234567ABC');
    expect(result.isValid).toBe(false);
  });

  it('rejects too short', () => {
    const result = validateEpicNumber('AB123');
    expect(result.isValid).toBe(false);
  });

  it('rejects non-string input', () => {
    const result = validateEpicNumber(12345);
    expect(result.isValid).toBe(false);
  });
});
