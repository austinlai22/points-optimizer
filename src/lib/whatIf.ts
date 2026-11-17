import cardsData from '../data/cards.json';
import type { CardConfig, Issuer } from '../types';
import { ISSUER_LABELS, ISSUER_ORDER } from '../utils/issuers';
import { verdictHeadline } from './verdict';
import { evaluateTrip, type TripContext, type TripInputs, type TripVerdict } from './trips';

// "What if I had the Venture X too?" or "…20,000 more Chase points?": the
// same trip run through the same engine with made-up cards or balances.
// Only for looking: nothing here changes the Portfolio.

const cards = cardsData as CardConfig[];

export interface WhatIf {
  // Card ids to add to, or take away from, the cards held.
  addCards: string[];
  removeCards: string[];
  // Points to add (or, below zero, take away) at each bank.
  extraPoints: Partial<Record<Issuer, number>>;
}

export const NO_WHAT_IF: WhatIf = { addCards: [], removeCards: [], extraPoints: {} };

export const isNoWhatIf = (w: WhatIf) => w.addCards.length === 0 && w.removeCards.length === 0 && Object.values(w.extraPoints).every((n) => !n);

// The trip context with the what-if applied, and what couldn't be.
export function whatIfContext(ctx: TripContext, w: WhatIf): { ctx: TripContext; notes: string[] } {
  const notes: string[] = [];
  const held = new Set(ctx.ownedCards.map((c) => c.id));
  for (const id of w.removeCards) held.delete(id);
  for (const id of w.addCards) if (cards.some((c) => c.id === id)) held.add(id);
  const ownedCards = cards.filter((c) => held.has(c.id));

  // Balances of cards no longer held go with them; added cards start at 0.
  const balances: Record<string, number> = {};
  for (const c of ownedCards) balances[c.id] = ctx.balances[c.id] ?? 0;
  for (const issuer of ISSUER_ORDER) {
    const extra = w.extraPoints[issuer];
    if (!extra) continue;
    // Pooled at the bank, as the engine pools them: put on a card that can
    // transfer when there is one.
    const target = ownedCards.find((c) => c.issuer === issuer && c.transferEligible) ?? ownedCards.find((c) => c.issuer === issuer);
    if (!target) {
      notes.push(`No ${ISSUER_LABELS[issuer]} card is held in this what-if, so the ${ISSUER_LABELS[issuer]} points were left out.`);
      continue;
    }
    if (extra < 0) {
      // Take from the bank's cards until the amount is used up.
      let left = -extra;
      for (const c of ownedCards.filter((x) => x.issuer === issuer)) {
        const take = Math.min(left, balances[c.id]);
        balances[c.id] -= take;
        left -= take;
      }
    } else {
      balances[target.id] += extra;
    }
  }

  // A Chase card type chosen for cards no longer held would be wrong; let it
  // be worked out from the cards instead.
  const cardsChanged = w.addCards.length > 0 || w.removeCards.length > 0;
  return { ctx: { ...ctx, ownedCards, balances, chase: cardsChanged ? { ...ctx.chase, cardType: '' } : ctx.chase }, notes };
}

export interface WhatIfResult {
  now: TripVerdict | null;
  whatIf: TripVerdict | null;
  // Whether the recommendation or the best way to pay changes.
  changed: boolean;
  notes: string[];
}

export function runWhatIf(trip: TripInputs, ctx: TripContext, w: WhatIf): WhatIfResult {
  const now = evaluateTrip(trip, ctx);
  const scenario = whatIfContext(ctx, w);
  const whatIf = evaluateTrip(trip, scenario.ctx);
  const key = (v: TripVerdict | null) => (v ? `${verdictHeadline(v)}|${v.bestOption?.kind ?? ''}|${v.bestOption?.issuer ?? ''}|${Math.round(v.bestOption?.pointsUsed ?? 0)}` : '');
  return { now, whatIf, changed: key(now) !== key(whatIf), notes: scenario.notes };
}
