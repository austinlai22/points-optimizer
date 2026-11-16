import { describe, expect, it } from 'vitest';
import cardsData from '../../data/cards.json';
import type { CardConfig } from '../../types';
import { evaluateTrip, type SavedTrip, type TripInputs } from '../trips';
import { EMPTY_CHASE_INPUTS } from '../../utils/verdictInputs';
import { runTool, type ToolContext } from './tools';

const cards = cardsData as CardConfig[];
const trip = (price: number, extra: Partial<TripInputs> = {}): TripInputs => ({
  tripCashPrice: price,
  selectedPartnerId: '',
  pointsRequired: 0,
  partnerPointsHeld: 0,
  awardCashFees: 0,
  chaseTravelPoints: 0,
  ...extra,
});

// Distinctive figures, so a leak would show in the JSON.
const BALANCE = 123_457;
const CASH = { available: '857', leftover: '-123', spend: '1987' };

function context(savedTrips: SavedTrip[] = []): ToolContext {
  return {
    trip: { ownedCards: cards.filter((c) => c.id === 'csr'), balances: { csr: BALANCE }, basis: 'guaranteed', cash: CASH, chase: EMPTY_CHASE_INPUTS },
    savedTrips,
    currentTrip: trip(1000, { selectedPartnerId: 'united', pointsRequired: 40000 }),
  };
}

const leaks = (result: unknown) => {
  const text = JSON.stringify(result);
  return [String(BALANCE), '123,457', '857', '1987', '1,987', '-123'].filter((n) => text.includes(n));
};

describe("the assistant's tools", () => {
  it('say whether cash is tight in words, never with amounts, even where the engine quotes them', () => {
    const v = evaluateTrip(context().currentTrip!, context().trip)!;
    // The engine's own reason does quote the shortfall...
    expect(v.reason).toMatch(/\$143 short/);
    // ...but what the AI gets doesn't.
    const result = runTool('current_trip', {}, context()) as Record<string, unknown>;
    expect(result.cash_check).toBe('paying cash would leave them stretched');
    expect(leaks(result)).toEqual([]);
  });

  it('check trips, list and plan saved trips, without balances', () => {
    const saved: SavedTrip[] = [
      { id: 'a', name: 'Lisbon', savedOn: '', updatedOn: null, snapshot: null, inputs: trip(600, { selectedPartnerId: 'united', pointsRequired: 30000 }) },
      { id: 'b', name: 'Tokyo', savedOn: '', updatedOn: null, snapshot: null, inputs: trip(1500, { selectedPartnerId: 'united', pointsRequired: 60000 }) },
    ];
    const ctx = context(saved);
    for (const [name, args] of [
      ['check_trip', { trip_cash_price_usd: 900, program: 'united', award_points: 50000 }],
      ['list_saved_trips', {}],
      ['plan_points', {}],
    ] as const) {
      const result = runTool(name, args, ctx);
      expect(result, name).not.toHaveProperty('error');
      expect(leaks(result), name).toEqual([]);
    }
    const plan = runTool('plan_points', {}, ctx) as { total_saved_usd: number; plan: { trip: string }[] };
    expect(plan.plan.map((p) => p.trip)).toEqual(['Lisbon', 'Tokyo']);
  });

  it('refuse to fill in a form that is not on the page, and unknown tools', () => {
    expect(runTool('fill_trip_form', { trip_cash_price_usd: 500 }, context())).toHaveProperty('error');
    expect(runTool('rm_rf', {}, context())).toHaveProperty('error');
  });

  it('work out a value per point, never below zero', () => {
    expect(runTool('cents_per_point', { cash_price_usd: 702, points: 25000, taxes_usd: 121.5 }, context())).toMatchObject({ cents_per_point: 2.322 });
    expect(runTool('cents_per_point', { cash_price_usd: 100, points: 10000, taxes_usd: 200 }, context())).toMatchObject({ cents_per_point: 0 });
  });
});
