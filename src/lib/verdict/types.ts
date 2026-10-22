import type { CardConfig, Issuer, TransferPartner, ValuationBasis } from '../../types';

export type Verdict =
  | 'PAY_CASH'
  | 'TRANSFER_POINTS'
  | 'BOOK_CHASE_TRAVEL'
  // Another issuer's travel portal (Capital One Travel, Bilt's portal, ...).
  // The spec only names Chase Travel, but Bilt and Bank of America's Premium
  // Rewards Elite pay more than 1 cent there, and a cash-strapped Capital One
  // holder needs telling to use theirs just as much as a Chase holder does.
  | 'BOOK_TRAVEL_PORTAL'
  | 'WAIT_OR_RECONSIDER';

// Keys of card_types in chase-points-boost.json.
export type ChaseCardType =
  | 'reserve'
  | 'preferred'
  | 'reserveForBusiness'
  | 'jpmReserve'
  | 'inkPreferred'
  | 'inkPlus'
  | 'other';

export interface CashInputs {
  // "Cash you could spend on travel without stress."
  available: number;
  // What's left each month after bills. May be negative.
  monthlyLeftover: number;
  // Typical monthly spending — what the cushion has to keep covering.
  monthlySpend: number;
}

export interface VerdictInput {
  tripCashPrice: number;
  // Cash still owed when booking with transferred points: award taxes and
  // carrier surcharges. Defaults to 0.
  awardTaxes?: number;
  // Only the cards the user holds.
  ownedCards: CardConfig[];
  balances: Record<string, number>;
  transferPartners: TransferPartner[];
  // An award price the user found with one transfer partner, in that
  // partner's own points. Without it there are no transfer options to judge,
  // because this app doesn't guess award prices.
  award?: {
    partnerId: string;
    pointsRequired: number;
    partnerPointsHeld?: number;
  };
  basis?: ValuationBasis;
  chase?: {
    // Defaults from the owned cards: Reserve, then Preferred, else other.
    cardType?: ChaseCardType;
    // Sapphire Reserve only: applied before June 23, 2025?
    reserveAppliedBeforeCutoff?: boolean;
    // How many of the Chase balance were earned before Oct 26, 2025.
    // Defaults to the whole balance when the legacy rate applies.
    legacyPoints?: number;
    // A price the user saw in Chase Travel, in points. Chase applies any
    // Boost or legacy rate before showing it, so this is the real price.
    travelPricePoints?: number;
  };
  cash: CashInputs;
  // ISO date (YYYY-MM-DD) to treat as today. Defaults to the real date;
  // tests pin it so the 2027 legacy cutoff is deterministic.
  today?: string;
}

export interface PointsOption {
  kind: 'transfer' | 'chaseTravel' | 'portal';
  issuer: Issuer;
  // The card to transfer from / book through.
  card: CardConfig | null;
  partner: TransferPartner | null;
  // Issuer points this option spends.
  pointsUsed: number;
  // Partner points already held that this option puts toward the award.
  partnerPointsApplied: number;
  cashFees: number;
  // Cents per issuer point spent. null when no issuer points are spent at
  // all (the award is fully covered by partner points already held).
  cppCents: number | null;
  benchmarkCents: number;
  // cppCents ÷ benchmarkCents: how many times the benchmark this option gets.
  // The only fair way to compare options across currencies, since a Chase
  // point and a Capital One mile have different benchmarks. Infinity when
  // cppCents is null.
  benchmarkRatio: number;
  // True when the points figure is an estimate (Chase Travel without a
  // pasted price) rather than a price the user actually saw.
  isEstimate: boolean;
}

export interface RunwayResult {
  outlay: number;
  bufferAfter: number;
  monthsOfBuffer: number;
  strained: boolean;
  // Which strain rules fired, for the "why" in the result view.
  strainReasons: Array<'negativeBuffer' | 'thinBuffer' | 'negativeLeftover'>;
}

export interface ChaseTravelResult {
  cardType: ChaseCardType;
  cardTypeName: string;
  legacyApplied: boolean;
  legacyPoints: number;
  // Points Chase Travel would charge outside any Boost offer.
  nonBoostPoints: number;
  // The range a Chase Travel booking can land in, in cents per point. The
  // floor is what any booking gets; the max is the best Boost Chase states for
  // this card, or null where Chase doesn't state one ("check Chase Travel").
  floorCents: number;
  maxCents: number | null;
  boostEligible: boolean;
  // The cpp Chase Travel must reach to be the verdict, and the price in
  // points that achieves it.
  hurdleCents: number;
  breakevenPoints: number;
  pastedPricePoints: number | null;
  // The verdict if Chase Travel isn't cheap enough — the "Otherwise, ..." in
  // the breakeven sentence.
  otherwise: { verdict: Verdict; option: PointsOption | null };
  // "If Chase Travel shows this trip at or below N points, book it there.
  // Otherwise, ..."
  sentence: string;
}

export interface VerdictResult {
  verdict: Verdict;
  reason: string;
  bestOption: PointsOption | null;
  // Every points option your balances cover, best first.
  options: PointsOption[];
  chaseTravel: ChaseTravelResult | null;
  runway: {
    payCash: RunwayResult;
    // The cash side of the best points option (its taxes and fees).
    usePoints: RunwayResult | null;
  };
  // Plain statements of every estimate or default behind the verdict.
  assumptions: string[];
}
