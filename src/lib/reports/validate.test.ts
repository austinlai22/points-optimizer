import { describe, expect, it } from 'vitest';
import { impliedCpp, validateReport } from './validate';

const TODAY = '2026-10-23';
const FLIGHT = {
  card_type: 'preferred',
  booking_type: 'flight',
  origin: 'SFO',
  destination: 'NRT',
  travel_month: '2027-03',
  cabin: 'business',
  cash_price_usd: 4200,
  chase_points_price: 210000,
  boost_shown: 'unsure',
};
const HOTEL = {
  card_type: 'reserve',
  booking_type: 'hotel',
  origin: null,
  destination: 'PAR',
  travel_month: '2026-12',
  cabin: null,
  cash_price_usd: 1200,
  chase_points_price: 60000,
  boost_shown: 'yes',
};

describe('validateReport', () => {
  it('accepts a flight and a hotel', () => {
    expect(validateReport(FLIGHT, TODAY)).toMatchObject({ ok: true, report: { implied_cpp: 2 } });
    expect(validateReport(HOTEL, TODAY)).toMatchObject({ ok: true, report: { origin: null, cabin: null } });
  });

  it('works out cents per point from the whole cash price', () => {
    expect(impliedCpp(900, 60000)).toBe(1.5);
    expect(impliedCpp(1000, 83333)).toBe(1.2);
  });

  it('accepts all seven Chase card types', () => {
    for (const card_type of ['reserve', 'preferred', 'reserveForBusiness', 'jpmReserve', 'inkPreferred', 'inkPlus', 'other']) {
      expect(validateReport({ ...FLIGHT, card_type }, TODAY).ok, card_type).toBe(true);
    }
  });

  it.each([
    ['an unknown card', { card_type: 'platinum' }],
    ['a lower-case code', { origin: 'sfo' }],
    ['a place name', { destination: 'Tokyo' }],
    ['a hotel with an origin', { booking_type: 'hotel', cabin: null, origin: 'SFO' }],
    ['a hotel with a cabin', { booking_type: 'hotel', origin: null, cabin: 'first' }],
    ['a bad month', { travel_month: '2027-13' }],
    ['a month too far ahead', { travel_month: '2029-01' }],
    ['a month too far back', { travel_month: '2025-06' }],
    ['a fractional points price', { chase_points_price: 60000.5 }],
    ['a tiny cash price', { cash_price_usd: 5 }],
    ['an unknown Boost answer', { boost_shown: 'maybe' }],
    ['an extra field', { email: 'a@b.c' }],
  ])('rejects %s', (_label, change) => {
    expect(validateReport({ ...FLIGHT, ...change }, TODAY)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('flags a price outside the plausible band as out of range, not invalid', () => {
    // 400,000 points for $900 is 0.225¢: below the 0.3¢ floor.
    expect(validateReport({ ...FLIGHT, cash_price_usd: 900, chase_points_price: 400000 }, TODAY)).toMatchObject({
      ok: false,
      reason: 'out_of_range',
    });
    // 15,000 points for $900 is 6¢: above the 5¢ ceiling.
    expect(validateReport({ ...FLIGHT, cash_price_usd: 900, chase_points_price: 15000 }, TODAY)).toMatchObject({
      ok: false,
      reason: 'out_of_range',
    });
  });
});
