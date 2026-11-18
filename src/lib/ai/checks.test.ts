import { describe, expect, it } from 'vitest';
import { readingChecks } from './checks';
import type { ParsedTrip } from './protocol';

const parsed = (t: Partial<ParsedTrip>): ParsedTrip => ({
  trip_cash_price_usd: null,
  program: null,
  award_points: null,
  award_taxes_usd: null,
  partner_points_held: null,
  chase_travel_points: null,
  ...t,
});

describe('checking what was read from a description', () => {
  it('says what was read, and nothing worries it in a normal trip', () => {
    const c = readingChecks(parsed({ trip_cash_price_usd: 900, program: 'united', award_points: 60000, award_taxes_usd: 85, chase_travel_points: 60000 }));
    expect(c.read).toEqual(['$900 cash', '60,000 United MileagePlus points + $85', '60,000 points in Chase Travel']);
    expect(c.warnings).toEqual([]);
  });

  it('catches a likely slip in the points, either way', () => {
    // $900 for 6,000 miles is 13.6¢ a point: surely 60,000.
    expect(readingChecks(parsed({ trip_cash_price_usd: 900, program: 'united', award_points: 6000 })).warnings).toEqual([
      expect.stringMatching(/^That's 15¢ a point for the award, far above usual\. .*6,000 may be missing a zero/),
    ]);
    expect(readingChecks(parsed({ trip_cash_price_usd: 300, chase_travel_points: 300000 })).warnings).toEqual([
      expect.stringMatching(/0\.1¢ a point for Chase Travel, far below usual.*300,000 may have a zero too many/),
    ]);
  });

  it('flags taxes as high as the price, more points held than needed, and a missing price or program', () => {
    expect(readingChecks(parsed({ trip_cash_price_usd: 100, program: 'united', award_points: 10000, award_taxes_usd: 120 })).warnings).toEqual([
      'The taxes and fees ($120) are as much as the cash price ($100). Check both.',
    ]);
    expect(readingChecks(parsed({ trip_cash_price_usd: 900, program: 'united', award_points: 50000, partner_points_held: 80000 })).warnings).toEqual([
      expect.stringMatching(/more United MileagePlus points \(80,000\) than the award costs \(50,000\)/),
    ]);
    expect(readingChecks(parsed({ award_points: 50000 })).warnings).toEqual([
      'No cash price found. Add it below to get a recommendation.',
      'Found an award price but not its program. Choose the program below.',
    ]);
  });

  it('says what was kept from the form when the words left it out', () => {
    const form = { tripCashPrice: 900, selectedPartnerId: 'united', pointsRequired: 60000, partnerPointsHeld: 0, awardCashFees: 0, chaseTravelPoints: 0 };
    // Just new award points: the price and the program stay, and say so.
    const c = readingChecks(parsed({ award_points: 6000 }), form);
    expect(c.read).toEqual(['6,000 United MileagePlus points']);
    expect(c.warnings).toEqual([
      "No cash price in that, so the $900 already in the form was kept. Change it below if it's a different trip.",
      "No program in that, so the points were put with United MileagePlus, already in the form. Change it below if that's wrong.",
      // And the kept price still catches the slip.
      expect.stringMatching(/far above usual.*6,000 may be missing a zero/),
    ]);
  });
});
