import boostData from '../../data/chase-points-boost.json';
import type { CardConfig } from '../../types';
import type { ChaseCardType } from './types';

interface BoostCardType {
  name: string;
  boost_eligible: boolean;
  max_multiplier: number | null;
}

const NON_BOOST_CENTS = boostData.non_boost_rate.cents_per_point;
const LEGACY = boostData.reserve_legacy;
const CARD_TYPES = boostData.card_types as Record<ChaseCardType, BoostCardType>;

export function getChaseCardType(cardType: ChaseCardType): BoostCardType {
  return CARD_TYPES[cardType];
}

// Every card type Chase names, in the data file's order, for pickers.
export function listChaseCardTypes(): { id: ChaseCardType; name: string }[] {
  return (Object.entries(CARD_TYPES) as [ChaseCardType, BoostCardType][]).map(([id, t]) => ({
    id,
    name: t.name,
  }));
}

// The Chase card that decides Boost and legacy terms, when the user hasn't
// said. Only the two Sapphires are in cards.json, so anything else held is
// "other" until the input asks.
export function inferChaseCardType(ownedCards: CardConfig[]): ChaseCardType {
  const ids = new Set(ownedCards.map((c) => c.id));
  if (ids.has('csr')) return 'reserve';
  if (ids.has('csp')) return 'preferred';
  return 'other';
}

// Chase's own wording: points earned before Oct 26, 2025 by Sapphire Reserve
// cardmembers who applied before June 23, 2025, at 1.5x until Oct 26, 2027.
// Compared as ISO strings, so it switches off on the expiry date with no
// code change. Reserve for Business launched after the cutoff and never had
// a legacy rate.
export function isLegacyActive(
  cardType: ChaseCardType,
  appliedBeforeCutoff: boolean | undefined,
  today: string,
): boolean {
  return cardType === LEGACY.card_type && appliedBeforeCutoff === true && today < LEGACY.expires_on;
}

export const LEGACY_CENTS = LEGACY.cents_per_point;
export const LEGACY_EXPIRES_ON = LEGACY.expires_on;
export { NON_BOOST_CENTS };

// Points Chase Travel charges for a trip outside any Boost offer. Chase
// applies "the best offer available" to legacy points, so they go first at
// 1.5 cents and anything the trip still needs comes from the rest at 1 cent.
export function priceChaseTravel(
  cashPrice: number,
  legacyPoints: number,
): { points: number; legacyPointsUsed: number } {
  const legacyDollars = Math.min(legacyPoints * (LEGACY_CENTS / 100), cashPrice);
  const legacyPointsUsed = legacyDollars / (LEGACY_CENTS / 100);
  const regularPoints = (cashPrice - legacyDollars) / (NON_BOOST_CENTS / 100);
  return { points: legacyPointsUsed + regularPoints, legacyPointsUsed };
}

// The most points a Chase Travel price can be and still get hurdleCents a
// point. Rounded down, so the breakeven price itself always clears it. The
// epsilon stops float noise turning an exact answer one point too low
// (100,000 ÷ 1.6 is 62,499.999... in binary).
export function breakevenPoints(cashPrice: number, hurdleCents: number): number {
  if (!(hurdleCents > 0)) return 0;
  return Math.floor((cashPrice * 100) / hurdleCents + 1e-9);
}
