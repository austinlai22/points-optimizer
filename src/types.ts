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
