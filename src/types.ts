export type Issuer = 'chase' | 'capitalOne' | 'amex' | 'citi' | 'bankOfAmerica';

export interface CardConfig {
  id: string;
  name: string;
  issuer: Issuer;
  annualFee: number;
  portalMultiplier: number;
  transferEligible: boolean;
  // Partner ids where THIS specific card's real transfer ratio is known to
  // be worse than the issuer-wide rate this app otherwise assumes uniformly
  // across every card in the issuer (e.g. Chase Sapphire Preferred's Hyatt
  // ratio specifically). Use the sentinel "*" to mean every partner (e.g. a
  // no-fee card whose whole tier gets a blanket reduced ratio). Omit, or
  // leave empty, for a card with no known exceptions.
  reducedRatioPartners?: string[];
  // Only meaningful when reducedRatioPartners includes "*". The real
  // multiplier on top of the issuer-wide ratio when THIS card is the only
  // one available to redeem with (no better same-issuer card to pool the
  // balance into first) — e.g. Citi Strata's real 10:7 transfer ratio is
  // 0.7. Defaults to 1 (no further degradation) if omitted.
  blanketRatioMultiplier?: number;
  // This specific card's real unconditional cash-back rate, when it differs
  // from its issuer's usual rate (CASH_BACK_RATE). Every issuer modeled so
  // far has one uniform floor across its whole lineup EXCEPT Bank of
  // America, where the no-fee Travel Rewards card's true cash-out rate
  // (0.6 cents/point) is genuinely worse than its own Premium Rewards/Elite
  // siblings (1 cent/point, the issuer default) — a real per-card exception,
  // not a per-issuer one. Omit for a card that matches its issuer's default.
  cashBackRateOverride?: number;
}

export type PartnerType = 'hotel' | 'airline';

export interface TransferPartner {
  id: string;
  name: string;
  type: PartnerType;
  // Some partners (e.g. Air France-KLM Flying Blue) accept transfers from
  // more than one issuer, often at different ratios each — this is a map
  // of every issuer that can reach this partner, not a single owner.
  ratiosByIssuer: Partial<Record<Issuer, number>>;
}

export type ViewName = 'portfolio' | 'tripOptimizer';

// Which of the three per-point rates this app models should drive every
// dollar figure it shows. These map 1:1 onto the floor / realistic /
// ceiling figures Portfolio already displays, so the choice is "which end
// of the range do you actually believe" rather than a new concept — and
// every option traces to an existing documented constant, with nothing
// invented in between.
//
// This exists because the basis is a genuine judgment call about YOUR
// redemption behavior, not a fact: someone who reliably books premium
// transfers really is giving up ~1.75c/point by using the portal, while
// someone whose realistic alternative IS the portal is not. Note it
// changes the verdict (savings, "poor deal") far more than the ranking,
// since scaling every path's rate together leaves the cheapest one
// cheapest.
export type ValuationBasis = 'cashBack' | 'guaranteed' | 'transfer';

export const DEFAULT_VALUATION_BASIS: ValuationBasis = 'guaranteed';

// Which field of a CardValuation (and of any floor/marker/ceiling total
// built from one) each basis selects. Shared so the portfolio summary, the
// per-card range bar, and anything else reading a valuation all highlight
// the same figure for a given basis.
export const VALUATION_KEY_BY_BASIS: Record<ValuationBasis, 'floor' | 'marker' | 'ceiling'> = {
  cashBack: 'floor',
  guaranteed: 'marker',
  transfer: 'ceiling',
};

// Label for the selected figure, used wherever that figure is shown on its
// own rather than as part of the floor-to-ceiling range.
export const VALUATION_LABEL_BY_BASIS: Record<ValuationBasis, string> = {
  cashBack: 'Cash-back floor',
  guaranteed: 'Realistic value',
  transfer: 'Transfer value',
};

export interface CardValuation {
  floor: number;
  marker: number;
  ceiling: number;
  isFixedValue: boolean;
  isPooled: boolean;
  pooledViaCard: CardConfig | null;
}

export type RedemptionKind = 'transfer' | 'portal';

export interface RedemptionPath {
  // For transfer paths, the card named as the one to actually execute the
  // transfer from — the lowest-fee owned transfer-eligible card, since cost
  // no longer depends on which specific card is used. For portal paths,
  // the specific card whose own portal rate this path represents.
  card: CardConfig;
  issuer: Issuer;
  kind: RedemptionKind;
  partner: TransferPartner | null;
  pointsUsed: number;
  // Out-of-pocket cash you still have to pay on top of the points — award
  // taxes and carrier-imposed surcharges. Only ever nonzero on transfer
  // paths: a portal booking is paid entirely in points at the trip's cash
  // price, which already includes taxes, so there's nothing left to pay.
  cashFees: number;
  // The full cost of getting this trip via this path: what these points are
  // worth at your issuer's best guaranteed rate (the opportunity cost of
  // using them this way instead of your best alternative) PLUS any cash
  // fees you'd still pay out of pocket. Lower is better; ranking sorts
  // ascending by this value.
  cost: number;
  sufficient: boolean;
  isPoorDeal: boolean;
  usesPooling: boolean;
  pooledFromCards: CardConfig[];
}
