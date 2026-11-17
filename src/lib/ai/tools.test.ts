import { describe, expect, it } from 'vitest';
import cardsData from '../../data/cards.json';
import type { CardConfig } from '../../types';
import { evaluateTrip, type SavedTrip, type TripInputs } from '../trips';
import { EMPTY_CHASE_INPUTS } from '../../utils/verdictInputs';
import { runTool, type Proposal, type ToolContext } from './tools';
import { parseAiReply } from './protocol';

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

  it('refuse to suggest a form that is not on the page, and unknown tools', () => {
    expect(runTool('propose_trip', { trip_cash_price_usd: 500 }, context())).toHaveProperty('error');
    expect(runTool('rm_rf', {}, context())).toHaveProperty('error');
  });

  it('only suggest changes, collecting them for the person to apply', () => {
    const saved: SavedTrip[] = [
      { id: 'a', name: 'Lisbon', savedOn: '', updatedOn: null, snapshot: null, inputs: trip(600) },
      { id: 'b', name: 'Tokyo', savedOn: '', updatedOn: null, snapshot: null, inputs: trip(1500) },
    ];
    const proposals: Proposal[] = [];
    const ctx = { ...context(saved), reachablePrograms: new Set(['united']), proposals };

    const result = runTool('propose_trip', { trip_cash_price_usd: 700, program: 'united', award_points: 30000, based_on: '$700 or 30k United' }, ctx);
    expect(result).toMatchObject({ proposed: true });
    expect(leaks(result)).toEqual([]);
    // A second trip suggestion replaces the first.
    runTool('propose_trip', { trip_cash_price_usd: 800, program: 'united', award_points: 30000 }, ctx);
    runTool('propose_save_trip', { name: 'Lisbon in May', based_on: 'save it' }, ctx);
    runTool('propose_compare', { trip_names: ['lisbon', 'Tokyo'] }, ctx);
    expect(proposals.map((p) => p.kind)).toEqual(['trip', 'save', 'compare']);
    expect(proposals[0]).toMatchObject({ summary: '$800 cash, or 30,000 United MileagePlus points', basedOn: 'what you asked' });
    expect(proposals[1]).toMatchObject({ name: 'Lisbon in May', trip: { tripCashPrice: 800 } });
    expect(proposals[2]).toMatchObject({ tripIds: ['a', 'b'] });

    // What can't be applied is refused up front.
    expect(runTool('propose_trip', { trip_cash_price_usd: 700, program: 'delta', award_points: 30000 }, ctx)).toHaveProperty('error');
    expect(runTool('propose_trip', { program: 'united', award_points: 30000 }, { ...ctx, currentTrip: null })).toHaveProperty('error');
    expect(runTool('propose_compare', { trip_names: ['Paris'] }, ctx)).toHaveProperty('error');
    expect(proposals).toHaveLength(3);
  });

  it('work out a value per point, never below zero', () => {
    expect(runTool('cents_per_point', { cash_price_usd: 702, points: 25000, taxes_usd: 121.5 }, context())).toMatchObject({ cents_per_point: 2.322 });
    expect(runTool('cents_per_point', { cash_price_usd: 100, points: 10000, taxes_usd: 200 }, context())).toMatchObject({ cents_per_point: 0 });
  });
});

describe("the assistant's replies", () => {
  it('may offer a few short replies to tap', () => {
    expect(parseAiReply({ type: 'answer', text: 'What does it cost in cash?', options: ['$500', ' $500 ', '', 7, 'x'.repeat(90), 'b', 'c', 'd'] })).toEqual({
      type: 'answer',
      text: 'What does it cost in cash?',
      options: ['$500', 'x'.repeat(60), 'b', 'c'],
    });
    expect(parseAiReply({ type: 'answer', text: 'Pay cash.', options: 'nope' })).toEqual({ type: 'answer', text: 'Pay cash.' });
  });
});
