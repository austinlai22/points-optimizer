import verdictConfig from '../../data/verdict-config.json';
import { DEFAULT_VALUATION_BASIS, type Issuer, type ValuationBasis } from '../../types';
import { formatPoints, formatUSD } from '../../utils/format';
import { ISSUER_LABELS } from '../../utils/issuers';
import { computeRedemptionPaths, getRateForBasis } from '../../utils/valuation';
import {
  LEGACY_CENTS,
  LEGACY_EXPIRES_ON,
  NON_BOOST_CENTS,
  breakevenPoints,
  getChaseCardType,
  inferChaseCardType,
  isLegacyActive,
  priceChaseTravel,
} from './chaseTravel';
import { describeMonths, formatCents, formatMonths } from './labels';
import { computeRunway } from './runway';
import type {
  ChaseTravelResult,
  PointsOption,
  RunwayResult,
  Verdict,
  VerdictInput,
  VerdictResult,
} from './types';

const CLEARLY_BEATS = verdictConfig.clearly_beats_benchmark_multiplier;

// Ratios are compared with a little slack so an option priced at exactly the
// breakeven isn't lost to float noise.
const EPSILON = 1e-9;
const atLeast = (value: number, threshold: number) => value >= threshold - EPSILON;

const BASIS_DESCRIPTION: Record<ValuationBasis, string> = {
  cashBack: 'cash-back value',
  guaranteed: 'guaranteed travel value',
  transfer: "potential transfer value, which is this app's own estimate",
};

type DecisionCode =
  | 'noOptions'
  | 'belowBenchmark'
  | 'strainedNoGoodOption'
  | 'protectsCash'
  | 'clearlyBeats'
  | 'marginal';

interface Decision {
  verdict: Verdict;
  // The points option the verdict tells you to use, if any.
  option: PointsOption | null;
  // The best points option on the table, used or not — PAY_CASH still says
  // what it turned down.
  best: PointsOption | null;
  code: DecisionCode;
}

function verdictFor(option: PointsOption): Verdict {
  if (option.kind === 'transfer') return 'TRANSFER_POINTS';
  if (option.kind === 'chaseTravel') return 'BOOK_CHASE_TRAVEL';
  return 'BOOK_TRAVEL_PORTAL';
}

// The spec's decision order (§4.6), with rules 1 and 5 merged: when no points
// option holds its value, healthy cash means pay cash, and strained cash means
// wait. The spec's rule 1 would still say pay cash whenever the money is
// technically there, but "strained" already means paying leaves under a
// month of spending (or a big bite while you're losing money each month), so
// paying anyway is the advice the strain rule exists to stop.
function decide(options: PointsOption[], payCash: RunwayResult): Decision {
  const best = options[0] ?? null;

  // 1 & 5. Nothing reaches its benchmark.
  if (!best || !atLeast(best.benchmarkRatio, 1)) {
    if (payCash.strained) {
      return { verdict: 'WAIT_OR_RECONSIDER', option: null, best, code: 'strainedNoGoodOption' };
    }
    return { verdict: 'PAY_CASH', option: null, best, code: best ? 'belowBenchmark' : 'noOptions' };
  }
  // 2. Cash is tight and points hold their value: use points.
  if (payCash.strained) {
    return { verdict: verdictFor(best), option: best, best, code: 'protectsCash' };
  }
  // 3. Cash is fine, so points must clearly beat their benchmark to be worth it.
  if (atLeast(best.benchmarkRatio, CLEARLY_BEATS)) {
    return { verdict: verdictFor(best), option: best, best, code: 'clearlyBeats' };
  }
  // 4. Marginal: keep the points for something better.
  return { verdict: 'PAY_CASH', option: null, best, code: 'marginal' };
}

// Best first. Ties go to Chase Travel, so a price exactly at the breakeven
// really is "book it there", then to whichever costs less cash.
function compareOptions(a: PointsOption, b: PointsOption): number {
  if (Math.abs(a.benchmarkRatio - b.benchmarkRatio) > EPSILON) {
    return b.benchmarkRatio - a.benchmarkRatio;
  }
  if ((a.kind === 'chaseTravel') !== (b.kind === 'chaseTravel')) {
    return a.kind === 'chaseTravel' ? -1 : 1;
  }
  return a.cashFees - b.cashFees;
}

// Why paying cash is strained, as a sentence. Names the first rule that fired.
function strainSentence(runway: RunwayResult): string {
  if (runway.strainReasons.includes('negativeBuffer')) {
    return `Paying cash would leave you ${formatUSD(-runway.bufferAfter)} short`;
  }
  if (runway.strainReasons.includes('thinBuffer')) {
    return `Paying cash would leave ${describeMonths(runway.monthsOfBuffer)} of your usual spending`;
  }
  return 'Paying cash would use a large share of your savings while your spending exceeds your income';
}

function describeOption(option: PointsOption): string {
  if (option.kind === 'transfer') return `transfer to ${option.partner!.name}`;
  if (option.kind === 'chaseTravel') return 'book in Chase Travel';
  return `book through ${ISSUER_LABELS[option.issuer]}'s travel portal`;
}

function describeVerdict(decision: Decision): string {
  if (decision.option) return describeOption(decision.option);
  return decision.verdict === 'PAY_CASH' ? 'pay cash' : 'wait to book';
}

function valueClause(option: PointsOption): string {
  return `which returns ${formatCents(option.cppCents!)} per point against a usual value of ${formatCents(option.benchmarkCents)}.`;
}

function buildReason(decision: Decision, payCash: RunwayResult): string {
  const { option, best, code } = decision;

  if (option) {
    const cashNote = code === 'protectsCash' ? ` ${strainSentence(payCash)}.` : '';
    if (option.kind === 'transfer') {
      if (option.cppCents === null) {
        return `Book with ${option.partner!.name} using the points you already hold. No transfer is needed.${cashNote}`;
      }
      return `Transfer ${formatPoints(option.pointsUsed)} ${ISSUER_LABELS[option.issuer]} points to ${option.partner!.name}, ${valueClause(option)}${cashNote}`;
    }
    if (option.kind === 'chaseTravel') {
      return `Book in Chase Travel for ${formatPoints(option.pointsUsed)} points, ${valueClause(option)}${cashNote}`;
    }
    return `Book through ${ISSUER_LABELS[option.issuer]}'s travel portal for ${formatPoints(option.pointsUsed)} points, ${valueClause(option)}${cashNote}`;
  }

  switch (code) {
    case 'noOptions':
      return 'Pay cash. None of your points balances is large enough for this trip.';
    case 'belowBenchmark':
      return `Pay cash. Your best points option returns ${formatCents(best!.cppCents!)} per point, less than the ${formatCents(best!.benchmarkCents)} these points are usually worth.`;
    case 'marginal':
      return `Pay cash and keep your points. At ${formatCents(best!.cppCents!)} per point, this redemption is not clearly better than their usual value of ${formatCents(best!.benchmarkCents)}.`;
    default:
      return `Wait to book. ${strainSentence(payCash)}, and ${best ? 'your points do not offer good value for this trip' : 'your points are not enough to cover it'}.`;
  }
}

function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function requireFinite(name: string, value: number, { positive = false } = {}): void {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    throw new RangeError(`${name} must be a ${positive ? 'positive' : 'finite'} number, got ${value}`);
  }
}

export function evaluateVerdict(input: VerdictInput): VerdictResult {
  const {
    tripCashPrice,
    awardTaxes = 0,
    ownedCards,
    balances,
    transferPartners,
    award,
    basis = DEFAULT_VALUATION_BASIS,
    chase = {},
    cash,
  } = input;
  requireFinite('tripCashPrice', tripCashPrice, { positive: true });
  requireFinite('awardTaxes', awardTaxes);
  requireFinite('cash.available', cash.available);
  requireFinite('cash.monthlyLeftover', cash.monthlyLeftover);
  requireFinite('cash.monthlySpend', cash.monthlySpend);
  if (chase.travelPricePoints !== undefined) {
    requireFinite('chase.travelPricePoints', chase.travelPricePoints, { positive: true });
  }
  const today = input.today ?? localIsoDate(new Date());
  const assumptions: string[] = [];

  const issuers = [...new Set(ownedCards.map((c) => c.issuer))];
  const balanceOf = (issuer: Issuer) =>
    ownedCards
      .filter((c) => c.issuer === issuer)
      .reduce((sum, c) => sum + (balances[c.id] ?? 0), 0);

  // The benchmark is whatever the user's "Value points at" basis says the
  // points are worth — the same rate Portfolio and Trip Optimizer use, so the
  // verdict can't disagree with the ranked paths.
  const benchmarkCents = Object.fromEntries(
    issuers.map((issuer) => [
      issuer,
      getRateForBasis(
        ownedCards.filter((c) => c.issuer === issuer),
        transferPartners,
        issuer,
        basis,
      ) * 100,
    ]),
  ) as Partial<Record<Issuer, number>>;
  assumptions.push(`Points are compared with their ${BASIS_DESCRIPTION[basis]}.`);

  // --- Chase Travel ---------------------------------------------------------
  const holdsChase = issuers.includes('chase');
  const chaseBalance = holdsChase ? balanceOf('chase') : 0;
  const chaseCardType = holdsChase ? (chase.cardType ?? inferChaseCardType(ownedCards)) : null;
  const legacyApplied =
    chaseCardType !== null && isLegacyActive(chaseCardType, chase.reserveAppliedBeforeCutoff, today);
  const legacyPoints = legacyApplied
    ? Math.min(Math.max(chase.legacyPoints ?? chaseBalance, 0), chaseBalance)
    : 0;
  const nonBoost = priceChaseTravel(tripCashPrice, legacyPoints);
  // What a Chase Travel booking of this trip gets with no Boost: 1 cent, or
  // up to 1.5 where legacy points cover it.
  const chaseFloorCents = (tripCashPrice * 100) / nonBoost.points;

  // Legacy points are guaranteed 1.5 cents on Chase Travel, so spending them
  // for less is a loss even when the basis says 1 cent. Chase Travel uses them
  // first; for transfers Chase doesn't say which points go, so those are
  // judged against the balance's average. The cash-back basis is left alone:
  // it's the user saying "my alternative is cash".
  const chaseBlendedCents =
    chaseBalance > 0
      ? (legacyPoints * LEGACY_CENTS + (chaseBalance - legacyPoints) * NON_BOOST_CENTS) / chaseBalance
      : NON_BOOST_CENTS;
  const legacyAware = (cents: number) => (basis === 'cashBack' ? (benchmarkCents.chase ?? 0) : Math.max(benchmarkCents.chase ?? 0, cents));
  const chaseTransferBenchmark = legacyAware(chaseBlendedCents);
  const chaseTravelBenchmark = legacyAware(chaseFloorCents);

  // --- Options -------------------------------------------------------------
  // Transfer and non-Chase portal paths come from the same function that
  // ranks Trip Optimizer's paths, so sufficiency, pooling and partner ratios
  // can't drift between the two.
  const paths = computeRedemptionPaths({
    cards: ownedCards,
    transferPartners,
    balances,
    tripCashPrice,
    pointsRequiredByPartner: award ? { [award.partnerId]: award.pointsRequired } : {},
    awardCashFees: awardTaxes,
    basis,
    partnerPointsHeld: award?.partnerPointsHeld ?? 0,
  });

  const options: PointsOption[] = [];
  for (const path of paths) {
    // Chase's portal is modelled below, with Boost and legacy terms.
    if (path.kind === 'portal' && path.issuer === 'chase') continue;
    const benchmark =
      path.kind === 'transfer' && path.issuer === 'chase'
        ? chaseTransferBenchmark
        : benchmarkCents[path.issuer]!;
    // Award taxes are cash you pay either way, so they don't count as value
    // the points bought. Portal prices already include taxes.
    const valueBought = path.kind === 'transfer' ? tripCashPrice - awardTaxes : tripCashPrice;
    const cppCents = path.pointsUsed > 0 ? (valueBought * 100) / path.pointsUsed : null;
    options.push({
      kind: path.kind,
      issuer: path.issuer,
      card: path.card,
      partner: path.partner,
      pointsUsed: path.pointsUsed,
      partnerPointsApplied: path.partnerPointsApplied,
      cashFees: path.cashFees,
      cppCents,
      benchmarkCents: benchmark,
      benchmarkRatio: cppCents === null ? Infinity : cppCents / benchmark,
      isEstimate: false,
    });
  }

  const pastedPrice = chase.travelPricePoints ?? null;
  if (holdsChase) {
    const points = pastedPrice ?? nonBoost.points;
    if (chaseBalance >= points) {
      const cppCents = (tripCashPrice * 100) / points;
      options.push({
        kind: 'chaseTravel',
        issuer: 'chase',
        card: null,
        partner: null,
        pointsUsed: points,
        partnerPointsApplied: 0,
        cashFees: 0,
        cppCents,
        benchmarkCents: chaseTravelBenchmark,
        benchmarkRatio: cppCents / chaseTravelBenchmark,
        isEstimate: pastedPrice === null,
      });
    }
  }
  options.sort(compareOptions);

  // --- Decision -------------------------------------------------------------
  const payCash = computeRunway(cash, tripCashPrice);
  const decision = decide(options, payCash);

  let chaseTravel: ChaseTravelResult | null = null;
  if (chaseCardType !== null) {
    const cardType = getChaseCardType(chaseCardType);
    const otherOptions = options.filter((o) => o.kind !== 'chaseTravel');
    const otherwise = decide(otherOptions, payCash);
    // Chase Travel wins when it reaches the decision's own bar AND beats every
    // other option, both measured against each option's own benchmark. With
    // only Chase in play this is the spec's max(transfer cpp, Chase
    // benchmark); the ratio form lets a Capital One or Amex option compete
    // fairly too.
    const requiredRatio = payCash.strained ? 1 : CLEARLY_BEATS;
    const hurdleRatio = Math.max(requiredRatio, ...otherOptions.map((o) => o.benchmarkRatio));
    const hurdleCents = chaseTravelBenchmark * hurdleRatio;
    const maxCents = cardType.boost_eligible
      ? cardType.max_multiplier === null
        ? null
        : Math.max(cardType.max_multiplier * NON_BOOST_CENTS, legacyApplied ? LEGACY_CENTS : 0)
      : chaseFloorCents;

    chaseTravel = {
      cardType: chaseCardType,
      cardTypeName: cardType.name,
      legacyApplied,
      legacyPoints,
      nonBoostPoints: nonBoost.points,
      floorCents: chaseFloorCents,
      maxCents,
      boostEligible: cardType.boost_eligible,
      hurdleCents,
      breakevenPoints: breakevenPoints(tripCashPrice, hurdleCents),
      pastedPricePoints: pastedPrice,
      otherwise: { verdict: otherwise.verdict, option: otherwise.option },
      sentence: '',
    };
    chaseTravel.sentence =
      chaseTravel.breakevenPoints > 0
        ? `If Chase Travel shows this trip at or below ${formatPoints(chaseTravel.breakevenPoints)} points, book it there. Otherwise, ${describeVerdict(otherwise)}.`
        : `Chase Travel cannot match this option. The better choice is to ${describeVerdict(otherwise)}.`;

    if (pastedPrice === null) {
      assumptions.push(
        `Chase Travel is assumed to charge the ${formatUSD(tripCashPrice)} cash price, without a Points Boost offer. Offers change often, so check the price Chase Travel shows.`,
      );
    }
    if (legacyApplied) {
      assumptions.push(
        chase.legacyPoints === undefined
          ? `All ${formatPoints(chaseBalance)} of your Chase points are assumed to have been earned before October 26, 2025, so they redeem at ${formatCents(LEGACY_CENTS)} in Chase Travel until October 26, 2027.`
          : `${formatPoints(legacyPoints)} of your Chase points redeem at ${formatCents(LEGACY_CENTS)} in Chase Travel until October 26, 2027.`,
      );
    } else if (chaseCardType === 'reserve' && chase.reserveAppliedBeforeCutoff && today >= LEGACY_EXPIRES_ON) {
      assumptions.push('The Sapphire Reserve legacy rate of 1.5¢ ended on October 26, 2027.');
    } else if (chaseCardType === 'preferred') {
      assumptions.push('No Sapphire Preferred legacy rate is applied, because Chase has not confirmed one.');
    }
  }

  if (award && awardTaxes === 0 && options.some((o) => o.kind === 'transfer')) {
    assumptions.push('Taxes and fees on the award are assumed to be $0. Enter them if the airline or hotel charges any.');
  }
  if (payCash.strained || decision.code === 'protectsCash') {
    assumptions.push(
      `Cash is treated as stretched if paying would leave less than ${formatMonths(verdictConfig.strain.min_months_of_buffer)} of your usual spending, or if the trip costs more than ${verdictConfig.strain.negative_leftover_max_share_of_cash * 100}% of your cash while your spending exceeds your income. These thresholds are this app's own rule of thumb.`,
    );
  }

  return {
    verdict: decision.verdict,
    reason: buildReason(decision, payCash),
    bestOption: decision.option,
    options,
    chaseTravel,
    runway: {
      payCash,
      usePoints: decision.option ? computeRunway(cash, decision.option.cashFees) : null,
    },
    assumptions,
  };
}
