import { describe, expect, it } from 'vitest';
import cardsData from '../data/cards.json';
import type { CardConfig } from '../types';
import { evaluateTrip, type SavedTrip, type TripInputs } from './trips';
import { balancesByIssuer, planPoints } from './planPoints';
import { EMPTY_CASH_INPUTS, EMPTY_CHASE_INPUTS } from '../utils/verdictInputs';

const cards = cardsData as CardConfig[];

const trip = (id: string, price: number, extra: Partial<TripInputs> = {}): SavedTrip => ({
  id,
  name: id,
  savedOn: '2026-11-16',
  updatedOn: null,
  snapshot: null,
  inputs: { tripCashPrice: price, selectedPartnerId: '', pointsRequired: 0, partnerPointsHeld: 0, awardCashFees: 0, chaseTravelPoints: 0, ...extra },
});

function plan(trips: SavedTrip[], balances: Record<string, number>, owned = ['csr']) {
  const ownedCards = cards.filter((c) => owned.includes(c.id));
  const ctx = { ownedCards, balances, basis: 'guaranteed' as const, cash: EMPTY_CASH_INPUTS, chase: EMPTY_CHASE_INPUTS };
  const verdicts = new Map(trips.map((t) => [t.id, evaluateTrip(t.inputs, ctx)]));
  return planPoints(trips, verdicts, balancesByIssuer(ownedCards, balances));
}

describe('planning points across saved trips', () => {
  it('spends limited points where they save the most, and pays cash for the rest', () => {
    // 60,000 Chase points. Tokyo saves $900 for 60,000; Lisbon $300 for 30,000;
    // both don't fit, so Tokyo gets the points.
    const p = plan(
      [trip('Lisbon', 600, { selectedPartnerId: 'united', pointsRequired: 30000 }), trip('Tokyo', 1500, { selectedPartnerId: 'united', pointsRequired: 60000 })],
      { csr: 60000 },
    );
    expect(p.trips.map((t) => [t.trip.name, t.option?.pointsUsed ?? 'cash'])).toEqual([['Lisbon', 'cash'], ['Tokyo', 60000]]);
    expect(p.totalSavings).toBeCloseTo(900);
    expect(p.pointsUsed.chase).toBe(60000);
    expect(p.exact).toBe(true);
  });

  it('uses points on several trips when they fit', () => {
    const p = plan(
      [trip('Lisbon', 600, { selectedPartnerId: 'united', pointsRequired: 30000 }), trip('Tokyo', 1500, { selectedPartnerId: 'united', pointsRequired: 60000 })],
      { csr: 100000 },
    );
    expect(p.trips.every((t) => t.option !== null)).toBe(true);
    expect(p.totalSavings).toBeCloseTo(1200);
  });

  it('never spends points on a trip where they save nothing', () => {
    // Chase Travel at 1¢ equals the points' usual value: no saving.
    const p = plan([trip('Plain', 500)], { csr: 100000 });
    expect(p.trips[0].option).toBeNull();
    expect(p.totalSavings).toBe(0);
  });

  it('beats a greedy pick: two smaller trips together can save more than one big one', () => {
    // 60,000 points: A saves $700 for 60,000 (1.17¢ a point more than usual);
    // B and C save $400 each for 30,000. B + C ($800) beats A ($700).
    const p = plan(
      [
        trip('A', 1300, { selectedPartnerId: 'united', pointsRequired: 60000 }),
        trip('B', 700, { selectedPartnerId: 'united', pointsRequired: 30000 }),
        trip('C', 700, { selectedPartnerId: 'united', pointsRequired: 30000 }),
      ],
      { csr: 60000 },
    );
    expect(p.trips.filter((t) => t.option).map((t) => t.trip.name)).toEqual(['B', 'C']);
    expect(p.totalSavings).toBeCloseTo(800);
  });
});
