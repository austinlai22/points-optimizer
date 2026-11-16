import { describe, expect, it } from 'vitest';
import { readTrip } from './readTrip';

describe('reading a trip from plain words without AI', () => {
  it('reads cash, an award, its program and its taxes', () => {
    expect(readTrip('SFO to Lisbon in May, $900 cash or 60k United miles + $85')).toMatchObject({
      trip_cash_price_usd: 900,
      program: 'united',
      award_points: 60000,
      award_taxes_usd: 85,
    });
  });

  it('reads taxes written as words, and commas in numbers', () => {
    expect(readTrip('Hyatt stay costs $1,200 or 25,000 points plus $40 in fees')).toMatchObject({
      trip_cash_price_usd: 1200,
      program: 'hyatt',
      award_points: 25000,
      award_taxes_usd: 40,
    });
  });

  it('tells a Chase Travel price and points already held from the award', () => {
    expect(readTrip('$702 flight, Chase Travel shows 70,200 points')).toMatchObject({ trip_cash_price_usd: 702, chase_travel_points: 70200, award_points: null });
    expect(readTrip('Air France 50k miles, I already have 20k flying blue miles, cash $800')).toMatchObject({
      program: 'flyingblue',
      award_points: 50000,
      partner_points_held: 20000,
      trip_cash_price_usd: 800,
    });
  });

  it('leaves out what it cannot tell', () => {
    expect(readTrip('a trip to Tokyo next spring')).toEqual({
      trip_cash_price_usd: null,
      program: null,
      award_points: null,
      award_taxes_usd: null,
      partner_points_held: null,
      chase_travel_points: null,
    });
  });
});
