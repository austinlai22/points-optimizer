import { describe, expect, it } from 'vitest';
import cardsData from '../../data/cards.json';
import transferPartnersData from '../../data/transferPartners.json';
import type { CardConfig, TransferPartner } from '../../types';
import { computeRedemptionPaths } from '../../utils/valuation';
import { breakevenPoints, computeRunway, evaluateVerdict, priceChaseTravel } from '.';
import type { CashInputs, VerdictInput } from '.';

// Real shipped data, so these also catch a data change that would flip a
// verdict. "today" is pinned: the legacy rate has a hard end date.
const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];
const card = (id: string) => cards.find((c) => c.id === id)!;

const TODAY = '2026-10-21';
const HEALTHY: CashInputs = { available: 10_000, monthlyLeftover: 500, monthlySpend: 2_000 };
// $800 against a $1,000 trip: paying cash leaves you $200 short.
const SHORT: CashInputs = { available: 800, monthlyLeftover: 100, monthlySpend: 1_500 };

function run(overrides: Partial<VerdictInput> = {}) {
  return evaluateVerdict({
    tripCashPrice: 1_000,
    ownedCards: [card('csr')],
    balances: { csr: 200_000 },
    transferPartners,
    cash: HEALTHY,
    today: TODAY,
    ...overrides,
  });
}

describe('Chase Points Boost and the Reserve legacy rate', () => {
  // Spec case 1.
  it('prices Chase Travel at 1.5¢ for a legacy-eligible Reserve holder, and 1¢ once the window closes', () => {
    const chase = { reserveAppliedBeforeCutoff: true };
    const before = run({ chase, today: '2027-10-25' }).chaseTravel!;
    expect(before.legacyApplied).toBe(true);
    expect(before.floorCents).toBeCloseTo(1.5);
    expect(before.maxCents).toBe(2);

    const after = run({ chase, today: '2027-10-26' }).chaseTravel!;
    expect(after.legacyApplied).toBe(false);
    expect(after.floorCents).toBeCloseTo(1);
  });

  it('gives no legacy rate to a Reserve opened on or after June 23, 2025', () => {
    const result = run({ chase: { reserveAppliedBeforeCutoff: false } }).chaseTravel!;
    expect(result.legacyApplied).toBe(false);
    expect(result.floorCents).toBeCloseTo(1);
  });

  it('applies 1.5¢ only to the legacy points, spending them first', () => {
    // 50k legacy points cover $750; the other $250 costs 25k regular points.
    expect(priceChaseTravel(1_000, 50_000).points).toBeCloseTo(75_000);
    const result = run({
      balances: { csr: 100_000 },
      chase: { reserveAppliedBeforeCutoff: true, legacyPoints: 50_000 },
    }).chaseTravel!;
    expect(result.nonBoostPoints).toBeCloseTo(75_000);
    expect(result.floorCents).toBeCloseTo(1_000 * 100 / 75_000);
  });

  // Spec case 2.
  it('gives Sapphire Preferred a 1¢–1.5¢ Boost range and no legacy rate', () => {
    const result = run({
      ownedCards: [card('csp')],
      balances: { csp: 200_000 },
      chase: { reserveAppliedBeforeCutoff: true },
    });
    expect(result.chaseTravel!.cardType).toBe('preferred');
    expect(result.chaseTravel!.legacyApplied).toBe(false);
    expect(result.chaseTravel!.floorCents).toBeCloseTo(1);
    expect(result.chaseTravel!.maxCents).toBe(1.5);
    expect(result.assumptions.join(' ')).toMatch(/Preferred legacy/);
  });

  // Spec case 3.
  it("shows Ink Plus a floor but no max, since Chase doesn't state one", () => {
    const result = run({
      ownedCards: [card('freedom')],
      balances: { freedom: 200_000 },
      chase: { cardType: 'inkPlus' },
    }).chaseTravel!;
    expect(result.boostEligible).toBe(true);
    expect(result.floorCents).toBeCloseTo(1);
    expect(result.maxCents).toBeNull();
  });

  it('gives Sapphire Reserve for Business the 2x Chase states for it', () => {
    expect(run({ chase: { cardType: 'reserveForBusiness' } }).chaseTravel!.maxCents).toBe(2);
  });

  it('gives a card outside the Boost list a flat range', () => {
    const result = run({ ownedCards: [card('freedom')], balances: { freedom: 200_000 } }).chaseTravel!;
    expect(result.cardType).toBe('other');
    expect(result.boostEligible).toBe(false);
    expect(result.maxCents).toBeCloseTo(result.floorCents);
  });
});

describe('verdicts', () => {
  // Spec case 4.
  it('says pay cash when points are weak and cash is healthy', () => {
    // United at 150k points for a $1,000 trip is 0.67¢ a point.
    const result = run({ award: { partnerId: 'united', pointsRequired: 150_000 } });
    expect(result.verdict).toBe('PAY_CASH');
    expect(result.reason).toMatch(/^Pay cash/);
  });

  it('says pay cash when every option is below a higher basis', () => {
    // Against the 1.75¢ transfer estimate, both 0.67¢ and 1¢ fall short.
    const result = run({ basis: 'transfer', award: { partnerId: 'united', pointsRequired: 150_000 } });
    expect(result.options.every((o) => o.benchmarkRatio < 1)).toBe(true);
    expect(result.verdict).toBe('PAY_CASH');
  });

  it('keeps points when they only match their usual value and cash is fine', () => {
    // Chase Travel at the plain 1¢ is exactly the benchmark: not worth spending.
    const result = run();
    expect(result.options[0].kind).toBe('chaseTravel');
    expect(result.verdict).toBe('PAY_CASH');
    expect(result.reason).toMatch(/keep your points/);
  });

  // Spec case 5.
  it('says transfer when a transfer is strong and cash is strained', () => {
    // Hyatt at 25k points for a $1,000 room is 4¢ a point.
    const result = run({ cash: SHORT, award: { partnerId: 'hyatt', pointsRequired: 25_000 } });
    expect(result.runway.payCash.strained).toBe(true);
    expect(result.verdict).toBe('TRANSFER_POINTS');
    expect(result.bestOption!.partner!.id).toBe('hyatt');
    expect(result.bestOption!.cppCents).toBeCloseTo(4);
    expect(result.reason).toMatch(/leave you \$200 short/);
  });

  it('says transfer when a transfer clearly beats the benchmark even with healthy cash', () => {
    const result = run({ award: { partnerId: 'hyatt', pointsRequired: 25_000 } });
    expect(result.verdict).toBe('TRANSFER_POINTS');
  });

  // Spec case 6.
  it('says wait when cash is short and points are weak', () => {
    // Too few Chase points for Chase Travel, and an award whose $900 of
    // surcharges leaves the points buying $100 of value.
    const result = run({
      balances: { csr: 30_000 },
      cash: SHORT,
      awardTaxes: 900,
      award: { partnerId: 'united', pointsRequired: 28_000 },
    });
    expect(result.options.every((o) => o.benchmarkRatio < 1)).toBe(true);
    expect(result.verdict).toBe('WAIT_OR_RECONSIDER');
  });

  it('says wait when cash covers the trip but leaves under a month, and points are weak', () => {
    const thin: CashInputs = { available: 1_500, monthlyLeftover: 100, monthlySpend: 2_000 };
    const result = run({ balances: { csr: 30_000 }, cash: thin });
    expect(result.runway.payCash.strainReasons).toEqual(['thinBuffer']);
    expect(result.verdict).toBe('WAIT_OR_RECONSIDER');
    expect(result.reason).toBe(
      "Wait to book. Paying cash would leave about 0.3 months of your usual spending, and your points are not enough to cover it.",
    );
  });

  it('says wait when you are losing money and the trip is a big share of your cash', () => {
    const losing: CashInputs = { available: 3_000, monthlyLeftover: -400, monthlySpend: 1_000 };
    const result = run({ balances: { csr: 30_000 }, cash: losing });
    expect(result.runway.payCash.strainReasons).toEqual(['negativeLeftover']);
    expect(result.verdict).toBe('WAIT_OR_RECONSIDER');
    expect(result.reason).toMatch(/spending exceeds your income/);
  });

  it('uses points at their usual value when that protects strained cash', () => {
    const result = run({ cash: SHORT });
    expect(result.verdict).toBe('BOOK_CHASE_TRAVEL');
    // Points leave the whole $800 cushion in place.
    expect(result.runway.usePoints!.bufferAfter).toBe(800);
  });

  it('says book through the portal when that beats the chosen basis', () => {
    // Capital One's portal pays 1¢; its cash-back is 0.5¢.
    const result = run({
      ownedCards: [card('venturex')],
      balances: { venturex: 200_000 },
      basis: 'cashBack',
    });
    expect(result.verdict).toBe('BOOK_TRAVEL_PORTAL');
    expect(result.bestOption!.benchmarkRatio).toBeCloseTo(2);
  });

  it('does not tell a legacy holder to transfer at less than their 1.5¢', () => {
    // United at 80k is 1.25¢: above the plain 1¢, below what legacy points get.
    const result = run({
      chase: { reserveAppliedBeforeCutoff: true },
      award: { partnerId: 'united', pointsRequired: 80_000 },
    });
    const transfer = result.options.find((o) => o.kind === 'transfer')!;
    expect(transfer.benchmarkCents).toBeCloseTo(1.5);
    expect(result.verdict).not.toBe('TRANSFER_POINTS');
  });

  it('says no transfer is needed when partner points already cover the award', () => {
    const result = run({
      award: { partnerId: 'hyatt', pointsRequired: 25_000, partnerPointsHeld: 30_000 },
    });
    expect(result.verdict).toBe('TRANSFER_POINTS');
    expect(result.bestOption!.pointsUsed).toBe(0);
    expect(result.reason).toMatch(/No transfer is needed/);
  });

  it('says pay cash when no balance covers the trip', () => {
    const result = run({ balances: { csr: 1_000 } });
    expect(result.options).toEqual([]);
    expect(result.verdict).toBe('PAY_CASH');
  });
});

describe('Chase Travel breakeven', () => {
  // Spec case 8.
  it('is floor(cash × 100 ÷ best alternative cpp)', () => {
    expect(breakevenPoints(1_000, 1.6)).toBe(62_500);
    expect(breakevenPoints(1_000, 1.7)).toBe(58_823);
  });

  // Spec case 7. United at 70k is 1.43¢, so Chase Travel has to beat that.
  const award = { partnerId: 'united', pointsRequired: 70_000 };

  it('names the transfer as the alternative, at its cpp', () => {
    const result = run({ award });
    expect(result.verdict).toBe('TRANSFER_POINTS');
    expect(result.chaseTravel!.breakevenPoints).toBe(70_000);
    expect(result.chaseTravel!.sentence).toBe(
      'If Chase Travel shows this trip at or below 70,000 points, book it there. Otherwise, transfer to United MileagePlus.',
    );
  });

  it('books Chase Travel when the pasted price is at or below the breakeven', () => {
    expect(run({ award, chase: { travelPricePoints: 60_000 } }).verdict).toBe('BOOK_CHASE_TRAVEL');
    expect(run({ award, chase: { travelPricePoints: 70_000 } }).verdict).toBe('BOOK_CHASE_TRAVEL');
  });

  it('falls back to the next best option when the pasted price is above it', () => {
    const result = run({ award, chase: { travelPricePoints: 70_001 } });
    expect(result.verdict).toBe('TRANSFER_POINTS');
    expect(result.verdict).toBe(result.chaseTravel!.otherwise.verdict);
  });

  it('agrees with the verdict at every price, with nothing else on the table', () => {
    // With no transfer, healthy cash needs 1.2x the 1¢ benchmark: 83,333 points.
    const breakeven = run().chaseTravel!.breakevenPoints;
    expect(breakeven).toBe(83_333);
    expect(run({ chase: { travelPricePoints: breakeven } }).verdict).toBe('BOOK_CHASE_TRAVEL');
    expect(run({ chase: { travelPricePoints: breakeven + 1 } }).verdict).toBe('PAY_CASH');
  });

  it('lowers the bar when cash is strained', () => {
    // Strained cash only asks points to hold their value: the plain 1¢ price.
    expect(run({ cash: SHORT }).chaseTravel!.breakevenPoints).toBe(100_000);
  });
});

describe('cash runway', () => {
  // Spec case 9.
  it('handles a negative monthly leftover', () => {
    const cash: CashInputs = { available: 3_000, monthlyLeftover: -400, monthlySpend: 2_000 };
    const result = run({ cash });
    // $1,000 is over 25% of $3,000 while losing money each month.
    expect(result.runway.payCash.strainReasons).toEqual(['negativeLeftover']);
    expect(Number.isFinite(result.runway.payCash.monthsOfBuffer)).toBe(true);
    expect(result.verdict).toBe('BOOK_CHASE_TRAVEL');
  });

  it("doesn't flag a small trip for someone losing money", () => {
    const runway = computeRunway({ available: 3_000, monthlyLeftover: -400, monthlySpend: 1_000 }, 500);
    expect(runway.strained).toBe(false);
  });

  it('says "less than a week" rather than "about 0 months"', () => {
    const result = run({
      cash: { available: 1_050, monthlyLeftover: 100, monthlySpend: 2_000 },
      award: { partnerId: 'hyatt', pointsRequired: 25_000 },
    });
    expect(result.reason).toMatch(/leave less than a week of your usual spending\.$/);
  });

  it('reports months of buffer left after paying', () => {
    const runway = computeRunway({ available: 5_000, monthlyLeftover: 0, monthlySpend: 2_000 }, 1_000);
    expect(runway.bufferAfter).toBe(4_000);
    expect(runway.monthsOfBuffer).toBe(2);
    expect(runway.strained).toBe(false);
  });

  it('survives zero monthly spending', () => {
    const runway = computeRunway({ available: 5_000, monthlyLeftover: 0, monthlySpend: 0 }, 1_000);
    expect(runway.monthsOfBuffer).toBe(4_000);
  });

  it('flags a purchase you cannot cover', () => {
    const runway = computeRunway(SHORT, 1_000);
    expect(runway.bufferAfter).toBe(-200);
    expect(runway.strainReasons).toEqual(['negativeBuffer']);
  });
});

describe('agreement with Trip Optimizer', () => {
  // The verdict judges cpp against a benchmark; Trip Optimizer ranks by cost.
  // Outside Chase's legacy rate those are the same test, so an option the
  // verdict calls good must be one Trip Optimizer shows as saving money.
  it.each(['cashBack', 'guaranteed', 'transfer'] as const)('matches on the %s basis', (basis) => {
    const ownedCards = [card('venturex'), card('amexgold'), card('citistratapremier')];
    const balances = { venturex: 150_000, amexgold: 150_000, citistratapremier: 150_000 };
    const awardTaxes = 120;
    for (const pointsRequired of [30_000, 60_000, 90_000, 120_000]) {
      const award = { partnerId: 'flyingblue', pointsRequired };
      const result = evaluateVerdict({
        tripCashPrice: 1_000, awardTaxes, ownedCards, balances, transferPartners,
        award, basis, cash: HEALTHY, today: TODAY,
      });
      const paths = computeRedemptionPaths({
        cards: ownedCards, transferPartners, balances, tripCashPrice: 1_000,
        pointsRequiredByPartner: { flyingblue: pointsRequired }, awardCashFees: awardTaxes, basis,
      });
      for (const option of result.options) {
        const path = paths.find((p) => p.issuer === option.issuer && p.kind === option.kind)!;
        expect(option.benchmarkRatio >= 1 - 1e-9).toBe(path.cost <= 1_000 + 1e-6);
      }
    }
  });
});

describe('input validation', () => {
  it('rejects a missing trip price', () => {
    expect(() => run({ tripCashPrice: 0 })).toThrow(RangeError);
  });

  it('rejects a non-numeric cash input', () => {
    expect(() => run({ cash: { ...HEALTHY, available: Number.NaN } })).toThrow(RangeError);
  });
});
