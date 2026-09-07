import { describe, expect, it } from 'vitest';
import cardsData from './cards.json';
import transferPartnersData from './transferPartners.json';
import {
  computeCardValuation,
  computeRedemptionPaths,
  getRateForBasis,
  CASH_BACK_RATE,
} from '../utils/valuation';
import {
  CARD_TERMS_VERIFIED_ON,
  MAX_VERIFICATION_AGE_MONTHS,
  isStale,
  isValidIsoDate,
  monthsSince,
} from '../utils/freshness';
import { ISSUER_ORDER } from '../styles/constants';
import type {
  CardConfig,
  Issuer,
  PartnerType,
  TransferPartner,
  ValuationBasis,
} from '../types';

// These tests validate the ACTUAL shipped data files, not synthetic
// fixtures — catching data-entry mistakes (typo'd issuer keys, malformed
// ratios, duplicate ids) that pure-logic unit tests can't see, since those
// tests intentionally use their own small, controlled fixtures instead.
const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];
const VALID_ISSUERS = new Set<Issuer>(ISSUER_ORDER);
const VALID_PARTNER_TYPES = new Set<PartnerType>(['hotel', 'airline']);

describe('cards.json shape and sanity', () => {
  it('has at least one card', () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it('has unique card ids', () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses issuers that are actually declared in ISSUER_ORDER', () => {
    for (const card of cards) {
      expect(VALID_ISSUERS.has(card.issuer), `card "${card.id}" has unknown issuer "${card.issuer}"`).toBe(
        true,
      );
    }
  });

  it('has a sane annual fee, portal multiplier, and non-empty name for every card', () => {
    for (const card of cards) {
      expect(card.annualFee, `${card.id} annualFee`).toBeGreaterThanOrEqual(0);
      expect(card.portalMultiplier, `${card.id} portalMultiplier`).toBeGreaterThan(0);
      expect(card.name.length, `${card.id} name`).toBeGreaterThan(0);
      expect(typeof card.transferEligible, `${card.id} transferEligible`).toBe('boolean');
    }
  });

  it('gives every issuer at least one transfer-eligible card, EXCEPT Bank of America (which genuinely has none)', () => {
    // Bank of America is a real, deliberate exception: none of its cards
    // have any airline/hotel transfer partners at all, unlike every other
    // issuer here. This test still guards against a FUTURE issuer silently
    // ending up with zero transfer-eligible cards by accident.
    const issuersAllowedNoTransferEligible = new Set<Issuer>(['bankOfAmerica']);
    for (const issuer of ISSUER_ORDER) {
      const issuerCards = cards.filter((c) => c.issuer === issuer);
      if (issuerCards.length === 0) continue; // issuer not represented yet is fine
      if (issuersAllowedNoTransferEligible.has(issuer)) continue;
      const hasTransferEligible = issuerCards.some((c) => c.transferEligible);
      expect(hasTransferEligible, `${issuer} has no transfer-eligible card at all`).toBe(true);
    }
  });

  it('Bank of America genuinely has zero transfer-eligible cards (no transfer partners exist for it)', () => {
    const boaCards = cards.filter((c) => c.issuer === 'bankOfAmerica');
    expect(boaCards.length).toBeGreaterThan(0);
    expect(boaCards.every((c) => !c.transferEligible)).toBe(true);
    expect(transferPartners.some((p) => p.ratiosByIssuer.bankOfAmerica !== undefined)).toBe(false);
  });

  it('has a CASH_BACK_RATE entry for every issuer actually used by a card', () => {
    for (const card of cards) {
      expect(CASH_BACK_RATE[card.issuer], `CASH_BACK_RATE missing for ${card.issuer}`).toBeGreaterThan(0);
      // The unconditional floor should never exceed the guaranteed travel
      // rate — that would invert the whole floor/marker/ceiling story.
      expect(CASH_BACK_RATE[card.issuer], `${card.issuer} floor exceeds travel rate`).toBeLessThanOrEqual(
        0.01,
      );
    }
  });
});

describe('transferPartners.json shape and sanity', () => {
  it('has unique partner ids', () => {
    const ids = transferPartners.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses valid partner types', () => {
    for (const partner of transferPartners) {
      expect(VALID_PARTNER_TYPES.has(partner.type), `${partner.id} has invalid type "${partner.type}"`).toBe(
        true,
      );
    }
  });

  it('every partner reaches at least one issuer, at a positive ratio, using only known issuers', () => {
    for (const partner of transferPartners) {
      const issuerEntries = Object.entries(partner.ratiosByIssuer);
      expect(issuerEntries.length, `${partner.id} has no issuers at all`).toBeGreaterThan(0);
      for (const [issuer, ratio] of issuerEntries) {
        expect(VALID_ISSUERS.has(issuer as Issuer), `${partner.id} references unknown issuer "${issuer}"`).toBe(
          true,
        );
        expect(ratio, `${partner.id}/${issuer} ratio must be positive`).toBeGreaterThan(0);
      }
    }
  });

  it('has a non-empty, human-readable name for every partner', () => {
    for (const partner of transferPartners) {
      expect(partner.name.length, `${partner.id} name`).toBeGreaterThan(0);
    }
  });
});

describe('real data end-to-end valuation sanity', () => {
  it('maintains floor <= marker <= ceiling for every real card at a representative balance', () => {
    for (const card of cards) {
      const result = computeCardValuation({
        card,
        balance: 50_000,
        allCards: cards,
        transferPartners,
      });
      expect(result.floor, `${card.id} floor`).toBeLessThanOrEqual(result.marker);
      expect(result.marker, `${card.id} marker`).toBeLessThanOrEqual(result.ceiling);
      expect(result.floor, `${card.id} floor should be non-negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it('never pools a card into a different issuer, for every real card', () => {
    for (const card of cards) {
      const result = computeCardValuation({
        card,
        balance: 50_000,
        allCards: cards,
        transferPartners,
      });
      if (result.pooledViaCard) {
        expect(result.pooledViaCard.issuer, `${card.id} pooled cross-issuer`).toBe(card.issuer);
      }
    }
  });

  it('gives every non-transfer-eligible card a ceiling boost from pooling, when its issuer has a transfer-eligible card', () => {
    const nonTransferEligible = cards.filter((c) => !c.transferEligible);
    for (const card of nonTransferEligible) {
      const issuerHasTransferEligible = cards.some(
        (c) => c.issuer === card.issuer && c.transferEligible,
      );
      if (!issuerHasTransferEligible) continue;
      const result = computeCardValuation({
        card,
        balance: 50_000,
        allCards: cards,
        transferPartners,
      });
      expect(result.isPooled, `${card.id} should be pooled`).toBe(true);
      expect(result.ceiling, `${card.id} ceiling should exceed its marker`).toBeGreaterThan(result.marker);
    }
  });
});

describe('real data: known reduced-ratio cards are never recommended when a better option exists', () => {
  const allBalances = Object.fromEntries(cards.map((c) => [c.id, 100_000]));

  it('never recommends Citi Strata (blanket reduced ratio) over Premier/Elite for any Citi partner', () => {
    const citiPartners = transferPartners.filter((p) => p.ratiosByIssuer.citi !== undefined);
    expect(citiPartners.length).toBeGreaterThan(0); // sanity: Citi must actually reach something
    for (const partner of citiPartners) {
      const paths = computeRedemptionPaths({
        cards,
        transferPartners,
        balances: allBalances,
        tripCashPrice: 500,
        pointsRequiredByPartner: { [partner.id]: 30_000 },
      });
      const citiPath = paths.find((p) => p.issuer === 'citi' && p.kind === 'transfer');
      expect(citiPath?.card.id, `Citi path for ${partner.id}`).not.toBe('citistrata');
    }
  });

  it('recommends Chase Reserve over Preferred specifically for Hyatt, but Preferred for other Chase partners', () => {
    const hyattPaths = computeRedemptionPaths({
      cards,
      transferPartners,
      balances: allBalances,
      tripCashPrice: 500,
      pointsRequiredByPartner: { hyatt: 30_000 },
    });
    const hyattChasePath = hyattPaths.find((p) => p.issuer === 'chase' && p.kind === 'transfer');
    expect(hyattChasePath?.card.id).toBe('csr');

    const unitedPaths = computeRedemptionPaths({
      cards,
      transferPartners,
      balances: allBalances,
      tripCashPrice: 500,
      pointsRequiredByPartner: { united: 30_000 },
    });
    const unitedChasePath = unitedPaths.find((p) => p.issuer === 'chase' && p.kind === 'transfer');
    expect(unitedChasePath?.card.id).toBe('csp'); // lower fee, no known caveat on United
  });
});

describe('real data: Citi Strata\'s blanket ratio shortfall is priced, not just avoided', () => {
  const strata = cards.find((c) => c.id === 'citistrata')!;
  const strataOnly = cards.filter((c) => c.id === 'citistrata');
  const strataPlusPremier = cards.filter((c) => c.id === 'citistrata' || c.id === 'citistratapremier');

  it('discounts Strata\'s own ceiling when it is the only Citi card held', () => {
    const result = computeCardValuation({
      card: strata,
      balance: 50_000,
      allCards: strataOnly,
      transferPartners,
    });
    expect(result.isPooled).toBe(false);
    const undiscounted = computeCardValuation({
      card: strata,
      balance: 50_000,
      allCards: strataPlusPremier,
      transferPartners,
    });
    // Holding Premier too should make Strata's ceiling strictly higher
    // (full rate, via pooling) than holding Strata alone (its own worse rate).
    expect(undiscounted.ceiling).toBeGreaterThan(result.ceiling);
  });

  it('inflates Trip Optimizer cost through Strata when it is the only held Citi card', () => {
    const aaPartner = transferPartners.find((p) => p.ratiosByIssuer.citi !== undefined)!;
    const soloPaths = computeRedemptionPaths({
      cards: strataOnly,
      transferPartners,
      balances: { citistrata: 100_000 },
      tripCashPrice: 500,
      pointsRequiredByPartner: { [aaPartner.id]: 30_000 },
    });
    const pooledPaths = computeRedemptionPaths({
      cards: strataPlusPremier,
      transferPartners,
      balances: { citistrata: 100_000, citistratapremier: 100_000 },
      tripCashPrice: 500,
      pointsRequiredByPartner: { [aaPartner.id]: 30_000 },
    });
    const soloCost = soloPaths.find((p) => p.issuer === 'citi' && p.kind === 'transfer')?.cost;
    const pooledCost = pooledPaths.find((p) => p.issuer === 'citi' && p.kind === 'transfer')?.cost;
    expect(soloCost).toBeGreaterThan(pooledCost!);
  });
});

describe('real data: Bank of America (no transfer partners, per-card cash-back floor)', () => {
  const travelRewards = cards.find((c) => c.id === 'boatravelrewards')!;
  const premiumRewardsElite = cards.find((c) => c.id === 'boapremiumrewardselite')!;
  const travelRewardsOnly = cards.filter((c) => c.id === 'boatravelrewards');
  const travelRewardsPlusElite = cards.filter(
    (c) => c.id === 'boatravelrewards' || c.id === 'boapremiumrewardselite',
  );

  it('gives Travel Rewards its own worse cash-back floor when held alone', () => {
    const result = computeCardValuation({
      card: travelRewards,
      balance: 50_000,
      allCards: travelRewardsOnly,
      transferPartners,
    });
    expect(result.floor).toBeCloseTo(50_000 * 0.006);
    expect(result.isPooled).toBe(false);
    // No transfer-eligible BoA card exists anywhere, so ceiling never gets
    // a transfer premium — it just equals the realistic value.
    expect(result.ceiling).toBeCloseTo(result.marker);
  });

  it('rescues Travel Rewards\' floor via pooling when Premium Rewards Elite is also held', () => {
    const result = computeCardValuation({
      card: travelRewards,
      balance: 50_000,
      allCards: travelRewardsPlusElite,
      transferPartners,
    });
    expect(result.isPooled).toBe(true);
    expect(result.pooledViaCard?.id).toBe('boapremiumrewardselite');
    // Rescued up to Premium Rewards Elite's full $0.01/point cash-back rate.
    expect(result.floor).toBeCloseTo(50_000 * 0.01);
  });

  it('gives Premium Rewards Elite its 1.25x airfare-redemption boost, with no transfer premium on top', () => {
    const result = computeCardValuation({
      card: premiumRewardsElite,
      balance: 50_000,
      allCards: travelRewardsPlusElite,
      transferPartners,
    });
    expect(result.marker).toBeCloseTo(50_000 * 0.01 * 1.25);
    expect(result.ceiling).toBeCloseTo(result.marker); // never transfer-eligible, so no premium
  });

  it('rescues Travel Rewards\' floor via Premium Rewards (not just Elite) when both tie on portal rate', () => {
    // Travel Rewards and plain Premium Rewards both have portalMultiplier
    // 1.0 and neither is transfer-eligible — a full tie on every dimension
    // except cash-back rate, which is exactly the scenario that exposed a
    // real getBestPortalCard tiebreak gap during development.
    const travelRewardsPlusPremium = cards.filter(
      (c) => c.id === 'boatravelrewards' || c.id === 'boapremiumrewards',
    );
    const result = computeCardValuation({
      card: travelRewards,
      balance: 50_000,
      allCards: travelRewardsPlusPremium,
      transferPartners,
    });
    expect(result.isPooled).toBe(true);
    expect(result.pooledViaCard?.id).toBe('boapremiumrewards');
    expect(result.floor).toBeCloseTo(50_000 * 0.01);
  });

  it('lets the no-fee Citi Strata reach American Airlines at the reduced ratio, not zero', () => {
    // Worth pinning because the published guidance genuinely conflicts, and
    // the conflict is a timeline rather than a disagreement. American was
    // added in July 2025 for premium Citi cards only (Strata Premier, Elite,
    // Prestige at 1:1), and several guides still describe that state. Later
    // in July 2025 Citi extended it to the no-annual-fee cards at 10:7. So
    // Strata DOES reach American, just badly — the blanket 0.7 is right, and
    // an { aa: 0 } "no access" entry would be wrong.
    const strataOnly = cards.filter((c) => c.id === 'citistrata');
    const paths = computeRedemptionPaths({
      cards: strataOnly,
      transferPartners,
      balances: { citistrata: 500_000 },
      tripCashPrice: 900,
      pointsRequiredByPartner: { aa: 30_000 },
    });
    const aaPath = paths.find((p) => p.kind === 'transfer' && p.partner?.id === 'aa');
    expect(aaPath).toBeDefined();
    expect(aaPath?.pointsUsed).toBeCloseTo(30_000 / 0.7);
  });

  it('produces zero transfer paths for Bank of America in Trip Optimizer (portal-only)', () => {
    const boaCards = cards.filter((c) => c.issuer === 'bankOfAmerica');
    const paths = computeRedemptionPaths({
      cards: boaCards,
      transferPartners,
      balances: Object.fromEntries(boaCards.map((c) => [c.id, 100_000])),
      tripCashPrice: 500,
      pointsRequiredByPartner: {},
    });
    expect(paths.every((p) => p.kind === 'portal')).toBe(true);
    expect(paths.length).toBe(boaCards.length);
  });
});

describe('real data: freshness', () => {
  // These are the only tests here designed to fail with the passage of time
  // rather than a code change, and that is the point. Every ratio and rate in
  // this app is a snapshot of terms issuers change without notice — two
  // changed within six months while it was being built, and three published
  // guides were already stale when checked. Silent staleness is the most
  // likely way this app becomes wrong, so it is made loud.
  it('records when every real partner was last verified', () => {
    for (const partner of transferPartners) {
      expect(partner.verifiedOn, `${partner.id} has no verifiedOn date`).toBeDefined();
      expect(
        isValidIsoDate(partner.verifiedOn ?? ''),
        `${partner.id} verifiedOn must be YYYY-MM-DD`,
      ).toBe(true);
    }
  });

  it('never claims to have verified anything in the future', () => {
    const today = new Date();
    for (const partner of transferPartners) {
      expect(monthsSince(partner.verifiedOn!, today), `${partner.id}`).toBeGreaterThanOrEqual(0);
    }
    expect(monthsSince(CARD_TERMS_VERIFIED_ON, today)).toBeGreaterThanOrEqual(0);
  });

  it(`has no transfer ratio older than ${MAX_VERIFICATION_AGE_MONTHS} months`, () => {
    const stale = transferPartners
      .filter((p) => isStale(p.verifiedOn!))
      .map((p) => `${p.name} (${p.verifiedOn})`);
    expect(
      stale,
      `Transfer ratios need re-checking against each issuer's published list, then ` +
        `bump verifiedOn. Stale: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it(`has card terms no older than ${MAX_VERIFICATION_AGE_MONTHS} months`, () => {
    expect(
      isStale(CARD_TERMS_VERIFIED_ON),
      `Annual fees, portal rates and cash-back rates need re-checking, then bump ` +
        `CARD_TERMS_VERIFIED_ON (currently ${CARD_TERMS_VERIFIED_ON}).`,
    ).toBe(false);
  });
});

describe('real data: transfer partner roster is complete per issuer', () => {
  // Counts verified against each issuer's published partner list. Pinned so
  // that dropping or duplicating a partner fails loudly rather than quietly
  // shrinking what Trip Optimizer can compare. Update deliberately when an
  // issuer actually adds or removes a partner.
  const EXPECTED: Record<Issuer, { airlines: number; hotels: number }> = {
    chase: { airlines: 10, hotels: 4 },
    capitalOne: { airlines: 18, hotels: 4 },
    amex: { airlines: 16, hotels: 4 },
    citi: { airlines: 15, hotels: 5 },
    // Bank of America has no transfer partners at all — see the dedicated
    // Bank of America block above.
    bankOfAmerica: { airlines: 0, hotels: 0 },
  };

  it('matches each issuer\'s published airline and hotel partner counts', () => {
    for (const issuer of ISSUER_ORDER) {
      const reachable = transferPartners.filter((p) => p.ratiosByIssuer[issuer] !== undefined);
      const airlines = reachable.filter((p) => p.type === 'airline').length;
      const hotels = reachable.filter((p) => p.type === 'hotel').length;
      expect({ issuer, airlines, hotels }).toEqual({ issuer, ...EXPECTED[issuer] });
    }
  });

  it('gives every issuer-partner pairing a positive, finite ratio', () => {
    for (const partner of transferPartners) {
      for (const [issuer, ratio] of Object.entries(partner.ratiosByIssuer)) {
        expect(Number.isFinite(ratio), `${partner.id}/${issuer}`).toBe(true);
        expect(ratio, `${partner.id}/${issuer}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('real data: valuation basis holds up across every issuer', () => {
  const ALL_BASES: ValuationBasis[] = ['cashBack', 'guaranteed', 'transfer'];

  it('keeps cashBack <= guaranteed <= transfer for every real issuer', () => {
    for (const issuer of ISSUER_ORDER) {
      const issuerCards = cards.filter((c) => c.issuer === issuer);
      if (issuerCards.length === 0) continue;
      const [floor, marker, ceiling] = ALL_BASES.map((basis) =>
        getRateForBasis(issuerCards, transferPartners, issuer, basis),
      );
      expect(floor, `${issuer} floor rate`).toBeLessThanOrEqual(marker);
      expect(marker, `${issuer} marker rate`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('collapses the transfer basis to the guaranteed rate for Bank of America', () => {
    // BoA has no transfer partners at all, so "best case transfer value"
    // has nothing to reach for — it must degrade to the guaranteed rate
    // rather than silently applying a premium that can't be realized.
    const boaCards = cards.filter((c) => c.issuer === 'bankOfAmerica');
    const transferRate = getRateForBasis(boaCards, transferPartners, 'bankOfAmerica', 'transfer');
    const guaranteedRate = getRateForBasis(
      boaCards,
      transferPartners,
      'bankOfAmerica',
      'guaranteed',
    );
    expect(transferRate).toBeCloseTo(guaranteedRate);
  });

  it('still applies Citi Strata\'s blanket ratio shortfall at the transfer basis', () => {
    const strataOnly = cards.filter((c) => c.id === 'citistrata');
    const strataPlusPremier = cards.filter(
      (c) => c.id === 'citistrata' || c.id === 'citistratapremier',
    );
    const soloRate = getRateForBasis(strataOnly, transferPartners, 'citi', 'transfer');
    const pooledRate = getRateForBasis(strataPlusPremier, transferPartners, 'citi', 'transfer');
    expect(soloRate).toBeLessThan(pooledRate);
  });

  it('produces usable, ordered paths at every basis for a full real portfolio', () => {
    const allBalances = Object.fromEntries(cards.map((c) => [c.id, 100_000]));
    for (const basis of ALL_BASES) {
      const paths = computeRedemptionPaths({
        cards,
        transferPartners,
        balances: allBalances,
        tripCashPrice: 500,
        pointsRequiredByPartner: { hyatt: 30_000 },
        basis,
      });
      expect(paths.length, `${basis} produced no paths`).toBeGreaterThan(0);
      for (let i = 1; i < paths.length; i++) {
        expect(paths[i].cost, `${basis} sort order`).toBeGreaterThanOrEqual(paths[i - 1].cost);
      }
      expect(paths.every((p) => Number.isFinite(p.cost)), `${basis} produced a non-finite cost`).toBe(
        true,
      );
    }
  });
});
