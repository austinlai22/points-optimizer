export type Issuer = 'chase' | 'capitalOne' | 'amex' | 'citi';

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
  // What these points are worth at your issuer's best guaranteed rate —
  // the opportunity cost of using them this way instead of your best
  // alternative. Lower is better; ranking sorts ascending by this value.
  cost: number;
  sufficient: boolean;
  isPoorDeal: boolean;
  usesPooling: boolean;
  pooledFromCards: CardConfig[];
}
