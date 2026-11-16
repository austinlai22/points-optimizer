import type { PointsOption, VerdictResult } from './verdict/types';
import { savingsVsCash, type SavedTrip } from './trips';
import type { Issuer } from '../types';

// Which saved trips to spend points on, and which to pay cash for, to save
// the most overall without spending more of any bank's points than you have.
// Each trip's options come from the verdict engine, so this only chooses
// between answers the engine already gives; it adds no judgement of its own.
// No AI involved.

export interface PlannedTrip {
  trip: SavedTrip;
  // The option to use, or null to pay cash.
  option: PointsOption | null;
  savings: number;
}

export interface PointsPlan {
  trips: PlannedTrip[];
  totalSavings: number;
  pointsUsed: Partial<Record<Issuer, number>>;
  // True when the best plan was searched for exhaustively; false when there
  // were too many trips and a quick rule (best savings per point first) was
  // used instead.
  exact: boolean;
}

interface Choice {
  option: PointsOption;
  savings: number;
}

// The options worth considering for one trip: those that save money against
// paying cash, with points valued at their usual value.
function choicesFor(trip: SavedTrip, verdict: VerdictResult | null): Choice[] {
  if (!verdict) return [];
  return verdict.options
    .filter((o) => o.pointsUsed > 0 || o.equivalentPoints > 0)
    .map((option) => ({
      option,
      savings: savingsVsCash(trip.inputs.tripCashPrice, option.cashFees, option.equivalentPoints, option.benchmarkCents),
    }))
    .filter((c) => c.savings > 0.005);
}

const EXACT_LIMIT = 12;

export function planPoints(
  trips: SavedTrip[],
  verdicts: Map<string, VerdictResult | null>,
  balancesByIssuer: Partial<Record<Issuer, number>>,
): PointsPlan {
  const choices = trips.map((t) => choicesFor(t, verdicts.get(t.id) ?? null));
  const picked: (Choice | null)[] = trips.map(() => null);
  const remaining = { ...balancesByIssuer };
  const fits = (c: Choice) => (remaining[c.option.issuer] ?? 0) + 1e-6 >= c.option.pointsUsed;
  const spend = (c: Choice, sign: 1 | -1) => {
    remaining[c.option.issuer] = (remaining[c.option.issuer] ?? 0) - sign * c.option.pointsUsed;
  };

  const exact = trips.length <= EXACT_LIMIT;
  if (exact) {
    // Branch and bound: try each trip's options (and cash), pruning any branch
    // that can't beat the best plan found so far even if every remaining trip
    // got its best saving.
    const bestPossible = choices.map((cs) => Math.max(0, ...cs.map((c) => c.savings)));
    const suffix = bestPossible.map((_, i) => bestPossible.slice(i).reduce((a, b) => a + b, 0));
    let best = -1;
    let bestPicks: (Choice | null)[] = [];
    const current: (Choice | null)[] = trips.map(() => null);
    const search = (i: number, total: number) => {
      if (total + (suffix[i] ?? 0) <= best + 1e-9) return;
      if (i === trips.length) {
        best = total;
        bestPicks = [...current];
        return;
      }
      for (const c of [...choices[i]].sort((a, b) => b.savings - a.savings)) {
        if (!fits(c)) continue;
        spend(c, 1);
        current[i] = c;
        search(i + 1, total + c.savings);
        current[i] = null;
        spend(c, -1);
      }
      search(i + 1, total);
    };
    search(0, 0);
    bestPicks.forEach((c, i) => (picked[i] = c));
  } else {
    // Too many trips to search every combination: take the best savings per
    // point first, while the points last.
    const all = choices.flatMap((cs, i) => cs.map((c) => ({ i, c })));
    all.sort((a, b) => b.c.savings / Math.max(b.c.option.pointsUsed, 1) - a.c.savings / Math.max(a.c.option.pointsUsed, 1));
    for (const { i, c } of all) {
      if (picked[i] || !fits(c)) continue;
      picked[i] = c;
      spend(c, 1);
    }
  }

  const pointsUsed: Partial<Record<Issuer, number>> = {};
  for (const c of picked) if (c) pointsUsed[c.option.issuer] = (pointsUsed[c.option.issuer] ?? 0) + c.option.pointsUsed;
  const planned = trips.map((trip, i) => ({ trip, option: picked[i]?.option ?? null, savings: picked[i]?.savings ?? 0 }));
  return { trips: planned, totalSavings: planned.reduce((sum, p) => sum + p.savings, 0), pointsUsed, exact };
}

// Each bank's points across the cards held, pooled as the engine pools them.
export function balancesByIssuer(cards: { id: string; issuer: Issuer }[], balances: Record<string, number>): Partial<Record<Issuer, number>> {
  const out: Partial<Record<Issuer, number>> = {};
  for (const c of cards) out[c.issuer] = (out[c.issuer] ?? 0) + (balances[c.id] ?? 0);
  return out;
}
