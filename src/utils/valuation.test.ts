import { describe, expect, it } from 'vitest';
import {
  BASE_CPP,
  CASH_BACK_RATE,
  TRANSFER_PREMIUM_FACTOR,
  computeCardValuation,
  computeRedemptionPaths,
  getBestTransferRatio,
} from './valuation';
import type { CardConfig, TransferPartner } from '../types';

// Small, explicit fixtures — deliberately decoupled from the real data files
// so these tests describe the LOGIC's behavior and don't silently break (or
// silently stop testing anything meaningful) if cards.json changes again.
const reserve: CardConfig = {
  id: 'reserve',
  name: 'Reserve',
  issuer: 'chase',
  annualFee: 795,
  portalMultiplier: 1.0,
  transferEligible: true,
};
const preferred: CardConfig = {
  id: 'preferred',
  name: 'Preferred',
  issuer: 'chase',
  annualFee: 95,
  portalMultiplier: 1.0,
  transferEligible: true,
};
const freedom: CardConfig = {
  id: 'freedom',
  name: 'Freedom',
  issuer: 'chase',
  annualFee: 0,
  portalMultiplier: 1.0,
  transferEligible: false,
};
const ventureOne: CardConfig = {
  id: 'ventureone',
  name: 'VentureOne',
  issuer: 'capitalOne',
  annualFee: 0,
  portalMultiplier: 1.0,
  transferEligible: true,
};
const boostedCard: CardConfig = {
  id: 'boosted',
  name: 'Boosted',
  issuer: 'chase',
  annualFee: 500,
  portalMultiplier: 1.5,
  transferEligible: true,
};

const hyatt: TransferPartner = {
  id: 'hyatt',
  name: 'World of Hyatt',
  type: 'hotel',
  ratiosByIssuer: { chase: 1 },
};
const flyingBlue: TransferPartner = {
  id: 'flyingblue',
  name: 'Flying Blue',
  type: 'airline',
  ratiosByIssuer: { chase: 1, capitalOne: 1 },
};
const bonusPartner: TransferPartner = {
  id: 'bonus',
  name: 'Bonus Partner',
  type: 'airline',
  ratiosByIssuer: { capitalOne: 2 }, // 1 CO mile -> 2 partner points
};

describe('getBestTransferRatio', () => {
  it('returns 1 when no partners are given', () => {
    expect(getBestTransferRatio([], 'chase')).toBe(1);
  });

  it('returns the max ratio for the given issuer, ignoring other issuers', () => {
    const partners = [hyatt, flyingBlue, bonusPartner];
    expect(getBestTransferRatio(partners, 'capitalOne')).toBe(2); // bonusPartner
    expect(getBestTransferRatio(partners, 'chase')).toBe(1); // hyatt/flyingBlue only
  });
});

describe('computeCardValuation', () => {
  it('computes floor using the issuer-specific cash-back rate', () => {
    const chaseResult = computeCardValuation({
      card: reserve,
      balance: 10_000,
      allCards: [reserve],
      transferPartners: [hyatt],
    });
    expect(chaseResult.floor).toBeCloseTo(10_000 * CASH_BACK_RATE.chase);

    const capitalOneResult = computeCardValuation({
      card: ventureOne,
      balance: 10_000,
      allCards: [ventureOne],
      transferPartners: [flyingBlue],
    });
    expect(capitalOneResult.floor).toBeCloseTo(10_000 * CASH_BACK_RATE.capitalOne);
    // Capital One's true unconditional floor is half Chase's, per issuer.
    expect(capitalOneResult.floor).toBeLessThan(chaseResult.floor);
  });

  it('gives every card the same realistic value when portal rates tie (no pooling benefit)', () => {
    const allCards = [reserve, preferred, freedom];
    const balance = 20_000;
    const results = allCards.map((card) =>
      computeCardValuation({ card, balance, allCards, transferPartners: [hyatt] }),
    );
    const markers = results.map((r) => r.marker);
    expect(new Set(markers).size).toBe(1);
    expect(markers[0]).toBeCloseTo(balance * BASE_CPP * 1.0);
  });

  it('still pools Freedom into a transfer-eligible card for ceiling, even though its portal rate already ties', () => {
    const allCards = [reserve, preferred, freedom];
    const balance = 20_000;
    const freedomResult = computeCardValuation({
      card: freedom,
      balance,
      allCards,
      transferPartners: [hyatt],
    });
    expect(freedomResult.isPooled).toBe(true);
    expect(freedomResult.pooledViaCard?.id).toBe('reserve');
    // Ceiling should reflect the transfer premium, not just the flat portal rate.
    expect(freedomResult.ceiling).toBeGreaterThan(freedomResult.marker);
    expect(freedomResult.ceiling).toBeCloseTo(
      balance * BASE_CPP * 1.0 * TRANSFER_PREMIUM_FACTOR * getBestTransferRatio([hyatt], 'chase'),
    );
  });

  it('does not mark a card as pooled when it already IS the best card', () => {
    const allCards = [reserve, preferred, freedom];
    const result = computeCardValuation({
      card: reserve,
      balance: 20_000,
      allCards,
      transferPartners: [hyatt],
    });
    expect(result.isPooled).toBe(false);
    expect(result.pooledViaCard).toBeNull();
  });

  it('pools a genuinely weaker portal rate up to the best card in its issuer', () => {
    const allCards = [boostedCard, preferred];
    const balance = 10_000;
    const preferredResult = computeCardValuation({
      card: preferred,
      balance,
      allCards,
      transferPartners: [hyatt],
    });
    expect(preferredResult.isPooled).toBe(true);
    expect(preferredResult.pooledViaCard?.id).toBe('boosted');
    expect(preferredResult.marker).toBeCloseTo(balance * BASE_CPP * 1.5);
  });

  it('never lets pooling cross issuers', () => {
    const allCards = [reserve, freedom, ventureOne];
    const freedomResult = computeCardValuation({
      card: freedom,
      balance: 20_000,
      allCards,
      transferPartners: [hyatt, flyingBlue],
    });
    // Should still pool into Reserve (same issuer), never into VentureOne.
    expect(freedomResult.pooledViaCard?.issuer).toBe('chase');
  });

  it('returns a fixed value (floor === ceiling) at zero balance', () => {
    const result = computeCardValuation({
      card: freedom,
      balance: 0,
      allCards: [reserve, freedom],
      transferPartners: [hyatt],
    });
    expect(result.isFixedValue).toBe(true);
    expect(result.floor).toBe(0);
    expect(result.ceiling).toBe(0);
  });

  it('prefers a transfer-eligible card on a portal-rate tie, regardless of array order', () => {
    // Freedom listed BEFORE Reserve here — the opposite of cards.json's real
    // order — to prove the tiebreak doesn't depend on array position.
    const allCards = [freedom, reserve, preferred];
    const result = computeCardValuation({
      card: freedom,
      balance: 20_000,
      allCards,
      transferPartners: [hyatt],
    });
    // Must still pool into a transfer-eligible card, not just "whichever
    // non-transfer-eligible card happened to come first".
    expect(result.pooledViaCard?.transferEligible).toBe(true);
    expect(result.ceiling).toBeGreaterThan(result.marker);
  });

  it('maintains floor <= marker <= ceiling', () => {
    const allCards = [reserve, preferred, freedom, boostedCard];
    for (const card of allCards) {
      const result = computeCardValuation({
        card,
        balance: 37_500,
        allCards,
        transferPartners: [hyatt],
      });
      expect(result.floor).toBeLessThanOrEqual(result.marker);
      expect(result.marker).toBeLessThanOrEqual(result.ceiling);
    }
  });

  describe('blanket ratio shortfall (e.g. Citi Strata)', () => {
    const strataLike: CardConfig = {
      id: 'strata',
      name: 'Strata-like',
      issuer: 'citi',
      annualFee: 0,
      portalMultiplier: 1.0,
      transferEligible: true,
      reducedRatioPartners: ['*'],
      blanketRatioMultiplier: 0.7,
    };
    const strataPremierLike: CardConfig = {
      id: 'strataPremier',
      name: 'Strata Premier-like',
      issuer: 'citi',
      annualFee: 95,
      portalMultiplier: 1.0,
      transferEligible: true,
    };
    const citiPartner: TransferPartner = {
      id: 'citipartner',
      name: 'Citi Partner',
      type: 'airline',
      ratiosByIssuer: { citi: 1 },
    };

    it('applies its own worse ratio to the ceiling when it is the only card in its issuer', () => {
      const result = computeCardValuation({
        card: strataLike,
        balance: 20_000,
        allCards: [strataLike],
        transferPartners: [citiPartner],
      });
      expect(result.isPooled).toBe(false);
      expect(result.ceiling).toBeCloseTo(
        20_000 * BASE_CPP * 1.0 * TRANSFER_PREMIUM_FACTOR * 1 * 0.7,
      );
    });

    it('escapes its own shortfall via pooling when a better same-issuer card exists', () => {
      const allCards = [strataLike, strataPremierLike];
      const result = computeCardValuation({
        card: strataLike,
        balance: 20_000,
        allCards,
        transferPartners: [citiPartner],
      });
      expect(result.isPooled).toBe(true);
      expect(result.pooledViaCard?.id).toBe('strataPremier');
      // Full rate, no 0.7 discount, since it rides Premier's better rate.
      expect(result.ceiling).toBeCloseTo(20_000 * BASE_CPP * 1.0 * TRANSFER_PREMIUM_FACTOR * 1);
    });

    it('never lets a plain-tie reduce() pick the blanket-reduced card as bestCard when a better one exists', () => {
      // strataLike listed FIRST to prove getBestPortalCard doesn't just take
      // array position on a portal-rate + transferEligible tie.
      const allCards = [strataLike, strataPremierLike];
      const premierResult = computeCardValuation({
        card: strataPremierLike,
        balance: 20_000,
        allCards,
        transferPartners: [citiPartner],
      });
      expect(premierResult.isPooled).toBe(false);
      expect(premierResult.pooledViaCard).toBeNull();
    });
  });
});

describe('computeRedemptionPaths — reduced-ratio recommendation avoidance', () => {
  const noFeeButWorse: CardConfig = {
    id: 'nofeeworse',
    name: 'No-fee but worse',
    issuer: 'chase',
    annualFee: 0,
    portalMultiplier: 1.0,
    transferEligible: true,
    reducedRatioPartners: ['*'], // worse on every partner, e.g. Citi Strata
  };
  const hyattSpecificWorse: CardConfig = {
    id: 'hyattworse',
    name: 'Hyatt-specific worse',
    issuer: 'chase',
    annualFee: 50,
    portalMultiplier: 1.0,
    transferEligible: true,
    reducedRatioPartners: ['hyatt'], // worse ONLY on Hyatt, e.g. Chase Preferred
  };

  it('never recommends a blanket-reduced-ratio card when a normal alternative exists, even if it has the lowest fee', () => {
    const paths = computeRedemptionPaths({
      cards: [noFeeButWorse, preferred], // noFeeButWorse has the lower fee ($0 vs $95)
      transferPartners: [hyatt],
      balances: { nofeeworse: 50_000, preferred: 50_000 },
      tripCashPrice: 600,
      pointsRequiredByPartner: { hyatt: 40_000 },
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    expect(transferPath?.card.id).toBe('preferred');
  });

  it('avoids a partner-specific reduced-ratio card only for that partner, not others', () => {
    const flyingBlueChase: TransferPartner = {
      id: 'flyingblue',
      name: 'Flying Blue',
      type: 'airline',
      ratiosByIssuer: { chase: 1 },
    };
    const commonBalances = { hyattworse: 50_000, reserve: 50_000 };

    // On Hyatt specifically, hyattworse ($50 fee) should be passed over for
    // reserve ($795 fee) since hyattworse is flagged as worse for Hyatt.
    const hyattPaths = computeRedemptionPaths({
      cards: [hyattSpecificWorse, reserve],
      transferPartners: [hyatt],
      balances: commonBalances,
      tripCashPrice: 600,
      pointsRequiredByPartner: { hyatt: 40_000 },
    });
    expect(hyattPaths.find((p) => p.kind === 'transfer')?.card.id).toBe('reserve');

    // On Flying Blue, hyattworse has no known caveat, so its lower fee wins.
    const flyingBluePaths = computeRedemptionPaths({
      cards: [hyattSpecificWorse, reserve],
      transferPartners: [flyingBlueChase],
      balances: commonBalances,
      tripCashPrice: 600,
      pointsRequiredByPartner: { flyingblue: 40_000 },
    });
    expect(flyingBluePaths.find((p) => p.kind === 'transfer')?.card.id).toBe('hyattworse');
  });

  it('falls back to a reduced-ratio card when it is the only transfer-eligible option', () => {
    const paths = computeRedemptionPaths({
      cards: [noFeeButWorse],
      transferPartners: [hyatt],
      balances: { nofeeworse: 50_000 },
      tripCashPrice: 600,
      pointsRequiredByPartner: { hyatt: 40_000 },
    });
    expect(paths.find((p) => p.kind === 'transfer')?.card.id).toBe('nofeeworse');
  });

  it('inflates points used (and cost) by a blanket-reduced card\'s real ratio multiplier when it is the only option', () => {
    const strataLikeOnly: CardConfig = {
      id: 'strataonly',
      name: 'Strata-like',
      issuer: 'citi',
      annualFee: 0,
      portalMultiplier: 1.0,
      transferEligible: true,
      reducedRatioPartners: ['*'],
      blanketRatioMultiplier: 0.7,
    };
    const citiPartner: TransferPartner = {
      id: 'citipartner',
      name: 'Citi Partner',
      type: 'airline',
      ratiosByIssuer: { citi: 1 },
    };
    const paths = computeRedemptionPaths({
      cards: [strataLikeOnly],
      transferPartners: [citiPartner],
      balances: { strataonly: 50_000 },
      tripCashPrice: 600,
      pointsRequiredByPartner: { citipartner: 10_000 },
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    // 10,000 partner points / ratio 1 / blanketRatioMultiplier 0.7 = ~14,285.7
    expect(transferPath?.pointsUsed).toBeCloseTo(10_000 / 0.7);
    expect(transferPath?.cost).toBeCloseTo((10_000 / 0.7) * BASE_CPP);
  });

  it('does not inflate points used when a better same-issuer card absorbs the recommendation', () => {
    const strataLike: CardConfig = {
      id: 'strata',
      name: 'Strata-like',
      issuer: 'citi',
      annualFee: 0,
      portalMultiplier: 1.0,
      transferEligible: true,
      reducedRatioPartners: ['*'],
      blanketRatioMultiplier: 0.7,
    };
    const strataPremierLike: CardConfig = {
      id: 'strataPremier',
      name: 'Strata Premier-like',
      issuer: 'citi',
      annualFee: 95,
      portalMultiplier: 1.0,
      transferEligible: true,
    };
    const citiPartner: TransferPartner = {
      id: 'citipartner',
      name: 'Citi Partner',
      type: 'airline',
      ratiosByIssuer: { citi: 1 },
    };
    const paths = computeRedemptionPaths({
      cards: [strataLike, strataPremierLike],
      transferPartners: [citiPartner],
      balances: { strata: 50_000, strataPremier: 50_000 },
      tripCashPrice: 600,
      pointsRequiredByPartner: { citipartner: 10_000 },
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    expect(transferPath?.card.id).toBe('strataPremier');
    expect(transferPath?.pointsUsed).toBeCloseTo(10_000);
  });
});

describe('computeRedemptionPaths', () => {
  const balances = { reserve: 50_000, preferred: 50_000, ventureone: 50_000 };

  it('returns nothing for a zero or missing trip price', () => {
    expect(
      computeRedemptionPaths({
        cards: [reserve],
        transferPartners: [hyatt],
        balances,
        tripCashPrice: 0,
        pointsRequiredByPartner: { hyatt: 40_000 },
      }),
    ).toEqual([]);
  });

  it('collapses same-issuer transfer options into one path naming the lowest-fee eligible card', () => {
    const paths = computeRedemptionPaths({
      cards: [reserve, preferred],
      transferPartners: [hyatt],
      balances,
      tripCashPrice: 600,
      pointsRequiredByPartner: { hyatt: 40_000 },
    });
    const transferPaths = paths.filter((p) => p.kind === 'transfer');
    expect(transferPaths).toHaveLength(1);
    expect(transferPaths[0].card.id).toBe('preferred'); // lower annual fee than reserve
  });

  it('prices cost using the issuer best rate, not the trip price and not any weaker card rate', () => {
    const paths = computeRedemptionPaths({
      cards: [boostedCard, preferred],
      transferPartners: [hyatt],
      balances: { boosted: 50_000, preferred: 50_000 },
      tripCashPrice: 600,
      pointsRequiredByPartner: { hyatt: 40_000 },
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    // 40,000 pts * (0.01 * 1.5 best-in-issuer rate) = 600, regardless of
    // which specific card is named (preferred has the lower fee here).
    expect(transferPath?.cost).toBeCloseTo(600);
  });

  it('converts partner-currency points to issuer points via that issuer-partner ratio', () => {
    const paths = computeRedemptionPaths({
      cards: [ventureOne],
      transferPartners: [bonusPartner],
      balances: { ventureone: 10_000 },
      tripCashPrice: 200,
      pointsRequiredByPartner: { bonus: 20_000 }, // 20,000 partner points / ratio 2 = 10,000 CO miles
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    expect(transferPath?.pointsUsed).toBeCloseTo(10_000);
  });

  it('never lets balances pool across issuers', () => {
    const paths = computeRedemptionPaths({
      cards: [reserve, ventureOne],
      transferPartners: [flyingBlue],
      balances: { reserve: 5_000, ventureone: 100_000 }, // huge CO balance, tiny Chase balance
      tripCashPrice: 1000,
      pointsRequiredByPartner: { flyingblue: 40_000 }, // Chase alone (5k) can't cover this
    });
    const chasePath = paths.find((p) => p.issuer === 'chase' && p.kind === 'transfer');
    expect(chasePath).toBeUndefined(); // must not be "rescued" by Capital One's balance
  });

  it('flags insufficient-balance paths as excluded, and pooled paths as using pooling', () => {
    const paths = computeRedemptionPaths({
      cards: [reserve, freedom],
      transferPartners: [hyatt],
      balances: { reserve: 5_000, freedom: 40_000 }, // reserve alone insufficient, pooled is enough
      tripCashPrice: 500,
      pointsRequiredByPartner: { hyatt: 30_000 },
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    expect(transferPath?.sufficient).toBe(true);
    expect(transferPath?.usesPooling).toBe(true);
    expect(transferPath?.pooledFromCards.map((c) => c.id)).toContain('freedom');
  });

  it('marks a redemption as a poor deal exactly when cost exceeds the trip price', () => {
    const paths = computeRedemptionPaths({
      cards: [reserve],
      transferPartners: [hyatt],
      balances: { reserve: 200_000 },
      tripCashPrice: 50,
      pointsRequiredByPartner: { hyatt: 40_000 }, // cost = 40,000 * 0.01 = $400 >> $50 trip
    });
    const transferPath = paths.find((p) => p.kind === 'transfer');
    expect(transferPath?.cost).toBeGreaterThan(50);
    expect(transferPath?.isPoorDeal).toBe(true);
  });

  it('sorts ascending by cost (lowest cost first)', () => {
    const paths = computeRedemptionPaths({
      cards: [reserve, preferred],
      transferPartners: [hyatt],
      balances,
      tripCashPrice: 1000,
      pointsRequiredByPartner: { hyatt: 40_000 },
    });
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i].cost).toBeGreaterThanOrEqual(paths[i - 1].cost);
    }
  });
});
