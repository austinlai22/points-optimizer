import { describe, expect, it } from 'vitest';
import cardsData from '../data/cards.json';
import type { CardConfig } from '../types';
import { EMPTY_CASH_INPUTS, EMPTY_CHASE_INPUTS } from '../utils/verdictInputs';
import type { TripContext, TripInputs } from './trips';
import { runWhatIf, whatIfContext } from './whatIf';

const cards = cardsData as CardConfig[];
const ctx = (owned: string[], balances: Record<string, number>): TripContext => ({
  ownedCards: cards.filter((c) => owned.includes(c.id)),
  balances,
  basis: 'guaranteed',
  cash: EMPTY_CASH_INPUTS,
  chase: EMPTY_CHASE_INPUTS,
});
const lisbon: TripInputs = { tripCashPrice: 900, selectedPartnerId: 'united', pointsRequired: 50000, partnerPointsHeld: 0, awardCashFees: 0, chaseTravelPoints: 0 };

describe('what-if scenarios', () => {
  it('shows when more points would change the answer', () => {
    const r = runWhatIf(lisbon, ctx(['csr'], { csr: 20000 }), { addCards: [], removeCards: [], extraPoints: { chase: 40000 } });
    expect(r.now?.bestOption?.kind).not.toBe('transfer');
    expect(r.whatIf?.bestOption).toMatchObject({ kind: 'transfer', pointsUsed: 50000 });
    expect(r.changed).toBe(true);
  });

  it('adds and takes away cards, moving their points with them, and leaves the real balances alone', () => {
    const real = ctx(['csr', 'venturex'], { csr: 10000, venturex: 70000 });
    const { ctx: w } = whatIfContext(real, { addCards: ['amexgold'], removeCards: ['venturex'], extraPoints: { amex: 30000, chase: -15000 } });
    expect(w.ownedCards.map((c) => c.id)).toEqual(['csr', 'amexgold']);
    expect(w.balances).toEqual({ csr: 0, amexgold: 30000 });
    expect(real.balances).toEqual({ csr: 10000, venturex: 70000 });
  });

  it("says so when points are added at a bank whose cards aren't held", () => {
    const r = runWhatIf(lisbon, ctx(['csr'], { csr: 0 }), { addCards: [], removeCards: [], extraPoints: { citi: 50000 } });
    expect(r.notes).toEqual(['No Citi card is held in this what-if, so the Citi points were left out.']);
    expect(r.changed).toBe(false);
  });
});
