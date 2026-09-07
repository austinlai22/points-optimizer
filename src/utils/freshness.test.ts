import { describe, expect, it } from 'vitest';
import {
  MAX_VERIFICATION_AGE_MONTHS,
  formatVerifiedOn,
  isStale,
  isValidIsoDate,
  monthsSince,
  oldestVerifiedOn,
} from './freshness';

// Fixed reference date so these never drift with the real clock — the whole
// point of this module is a time-based guard, so its own tests must not be
// time-dependent themselves.
const ASOF = new Date('2026-09-06T00:00:00Z');

describe('monthsSince', () => {
  it('counts whole elapsed months', () => {
    expect(monthsSince('2026-09-06', ASOF)).toBe(0);
    expect(monthsSince('2026-08-06', ASOF)).toBe(1);
    expect(monthsSince('2026-03-06', ASOF)).toBe(6);
    expect(monthsSince('2025-09-06', ASOF)).toBe(12);
  });

  it('does not round a partial month up', () => {
    // One day short of six months is still five, so a threshold of six means
    // six rather than "about six".
    expect(monthsSince('2026-03-07', ASOF)).toBe(5);
    expect(monthsSince('2026-03-06', ASOF)).toBe(6);
  });

  it('is negative for a future date, which is how the data test catches typos', () => {
    expect(monthsSince('2026-12-01', ASOF)).toBeLessThan(0);
  });
});

describe('isStale', () => {
  it(`flags anything at or past ${MAX_VERIFICATION_AGE_MONTHS} months`, () => {
    expect(isStale('2026-03-06', ASOF)).toBe(true);
    expect(isStale('2026-03-07', ASOF)).toBe(false);
    expect(isStale('2026-09-06', ASOF)).toBe(false);
  });
});

describe('isValidIsoDate', () => {
  it('accepts a real YYYY-MM-DD date', () => {
    expect(isValidIsoDate('2026-09-06')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    for (const bad of ['2026-9-6', '09/06/2026', '2026-13-01', '2026-02-30', '', 'yesterday']) {
      expect(isValidIsoDate(bad), bad).toBe(false);
    }
  });
});

describe('oldestVerifiedOn', () => {
  it('returns the weakest link, since the app is only as current as that', () => {
    expect(oldestVerifiedOn(['2026-09-06', '2026-01-15', '2026-05-02'])).toBe('2026-01-15');
  });

  it('returns null for no dates rather than inventing one', () => {
    expect(oldestVerifiedOn([])).toBeNull();
  });
});

describe('formatVerifiedOn', () => {
  it('shows month precision, matching how accurate the check actually is', () => {
    expect(formatVerifiedOn('2026-09-06')).toBe('September 2026');
    expect(formatVerifiedOn('2026-08-01')).toBe('August 2026');
  });

  it('does not shift a month boundary via local timezone', () => {
    // Parsed as UTC — a naive parse would render this as December in any
    // timezone behind UTC.
    expect(formatVerifiedOn('2026-01-01')).toBe('January 2026');
  });
});
