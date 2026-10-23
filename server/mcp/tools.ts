import cardsData from '../../src/data/cards.json';
import transferPartnersData from '../../src/data/transferPartners.json';
import boostData from '../../src/data/chase-points-boost.json';
import verdictConfig from '../../src/data/verdict-config.json';
import { breakevenPoints, describeRunway, evaluateVerdict, listChaseCardTypes, verdictHeadline } from '../../src/lib/verdict';
import { cardsForBankBalances } from '../../src/lib/verdict/byBank';
import type { ChaseCardType, PointsOption } from '../../src/lib/verdict/types';
import { CARD_TERMS_VERIFIED_ON } from '../../src/utils/freshness';
import { ISSUER_LABELS } from '../../src/utils/issuers';
import type { CardConfig, Issuer, TransferPartner, ValuationBasis } from '../../src/types';

// The agent tool's logic: plain functions over the same engine and data files
// the web app uses, so the two can't give different answers. Every fact
// carries source_url and verified_on; estimates say they're estimates.

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

export const BANKS = ['chase', 'capital_one', 'amex', 'citi', 'bank_of_america', 'bilt'] as const;
export type Bank = (typeof BANKS)[number];

const ISSUER_BY_BANK: Record<Bank, Issuer> = {
  chase: 'chase',
  capital_one: 'capitalOne',
  amex: 'amex',
  citi: 'citi',
  bank_of_america: 'bankOfAmerica',
  bilt: 'bilt',
};

export const CHASE_CARD_TYPES = listChaseCardTypes().map((t) => t.id);

export class ToolInputError extends Error {}

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;

// "1,000 Chase points → 750 World of Hyatt points"
function transferText(issuer: Issuer, partner: TransferPartner, ratio: number): string {
  return `1,000 ${ISSUER_LABELS[issuer]} points → ${Math.round(1000 * ratio).toLocaleString('en-US')} ${partner.name} points`;
}

// --- list_transfer_partners ------------------------------------------------

export function listTransferPartners(bank: Bank) {
  const issuer = ISSUER_BY_BANK[bank];
  const partners = transferPartners
    .filter((p) => p.ratiosByIssuer[issuer] !== undefined)
    .map((p) => ({
      program_id: p.id,
      program: p.name,
      type: p.type,
      points_received_per_point: p.ratiosByIssuer[issuer]!,
      transfer: transferText(issuer, p, p.ratiosByIssuer[issuer]!),
      source_url: p.sourceUrls?.[issuer] ?? null,
      verified_on: p.verifiedOn ?? null,
    }));

  // Cards that transfer at a worse ratio than the bank's standard one.
  const cardExceptions = cards
    .filter((c) => c.issuer === issuer && c.partnerRatioOverrides)
    .flatMap((c) =>
      Object.entries(c.partnerRatioOverrides!).map(([partnerId, multiplier]) => ({
        card: c.name,
        applies_to: partnerId === '*' ? 'every partner' : (transferPartners.find((p) => p.id === partnerId)?.name ?? partnerId),
        ratio_multiplier: multiplier,
        note:
          partnerId === '*'
            ? `Transfers at ${Math.round(multiplier * 100)}% of the standard ratio to every partner.`
            : `Transfers at ${Math.round(multiplier * 100)}% of the standard ratio to this partner.`,
        source_url: c.sourceUrl ?? null,
        verified_on: CARD_TERMS_VERIFIED_ON,
      })),
    );

  return {
    bank: ISSUER_LABELS[issuer],
    partner_count: partners.length,
    partners,
    card_exceptions: cardExceptions,
    note:
      partners.length === 0
        ? `${ISSUER_LABELS[issuer]} points do not transfer to any airline or hotel program.`
        : 'Ratios as published by the bank or a recent public guide. Banks change them without notice; confirm before transferring, since transfers are usually irreversible.',
  };
}

// --- compute_cents_per_point ------------------------------------------------

export function computeCentsPerPoint(cashPriceUsd: number, pointsPrice: number, taxesUsd = 0) {
  if (!(pointsPrice > 0)) throw new ToolInputError('points_price must be greater than 0.');
  if (taxesUsd > cashPriceUsd) throw new ToolInputError('taxes_usd cannot exceed cash_price_usd.');
  // The engine's own formula for an award: the taxes are paid in cash either
  // way, so they aren't value the points bought.
  return {
    cents_per_point: round(((cashPriceUsd - taxesUsd) * 100) / pointsPrice),
    formula: '(cash_price_usd − taxes_usd) × 100 ÷ points_price',
    inputs: { cash_price_usd: cashPriceUsd, points_price: pointsPrice, taxes_usd: taxesUsd },
    note: 'For a Chase Travel or other portal price, leave taxes_usd at 0: portal prices already include taxes.',
  };
}

// --- chase_travel_breakeven -------------------------------------------------

export function chaseTravelBreakeven(cashPriceUsd: number, targetCentsPerPoint: number) {
  if (!(targetCentsPerPoint > 0)) throw new ToolInputError('target_cents_per_point must be greater than 0.');
  return {
    max_points_price: breakevenPoints(cashPriceUsd, targetCentsPerPoint),
    formula: 'floor(cash_price_usd × 100 ÷ target_cents_per_point)',
    meaning: `If Chase Travel shows this trip at or below this many points, each point is worth at least ${targetCentsPerPoint}¢.`,
    inputs: { cash_price_usd: cashPriceUsd, target_cents_per_point: targetCentsPerPoint },
  };
}

// --- points_boost_rules -----------------------------------------------------

export function pointsBoostRules(cardType: ChaseCardType) {
  const card = (boostData.card_types as Record<string, { name: string; boost_eligible: boolean; max_multiplier: number | null; quote: string; source_url: string; verified_on: string }>)[cardType];
  const legacy = boostData.reserve_legacy;
  return {
    card: card.name,
    points_boost: {
      eligible: card.boost_eligible,
      max_multiplier: card.max_multiplier ?? (card.boost_eligible ? 'not stated by Chase' : null),
      chase_says: card.quote,
      source_url: card.source_url,
      verified_on: card.verified_on,
    },
    standard_rate: {
      cents_per_point: boostData.non_boost_rate.cents_per_point,
      chase_says: boostData.non_boost_rate.quote,
      source_url: boostData.non_boost_rate.source_url,
      verified_on: boostData.non_boost_rate.verified_on,
    },
    legacy_rate:
      cardType === 'reserve'
        ? {
            cents_per_point: legacy.cents_per_point,
            applies_to: `Points earned before ${legacy.points_earned_before} by cardmembers who applied before ${legacy.applied_before}.`,
            ends_on: legacy.expires_on,
            chase_says: legacy.quote,
            source_url: legacy.source_url,
            verified_on: legacy.verified_on,
          }
        : cardType === 'preferred'
          ? {
              cents_per_point: null,
              applies_to: 'Not stated by Chase. PointCompass applies no Sapphire Preferred legacy rate until Chase confirms one.',
              source_url: boostData.preferred_legacy.source_url,
              verified_on: boostData.preferred_legacy.verified_on,
            }
          : null,
    note: 'Points Boost offers rotate and are only visible inside Chase Travel. PointCompass cannot see current offers.',
  };
}

// --- recommend_payment ------------------------------------------------------

export interface RecommendInput {
  trip_cash_price_usd: number;
  award_taxes_usd?: number;
  balances: Partial<Record<Bank, number>>;
  chase_card_type?: ChaseCardType;
  reserve_applied_before_2025_06_23?: boolean;
  chase_travel_points_price?: number;
  award?: { program: string; points_required: number; points_already_held?: number };
  cash_position?: { available_usd: number; monthly_leftover_usd: number; monthly_spending_usd: number };
  value_points_at?: ValuationBasis;
}

export function findProgram(query: string): TransferPartner {
  const q = query.trim().toLowerCase();
  const match =
    transferPartners.find((p) => p.id === q) ??
    transferPartners.find((p) => p.name.toLowerCase() === q) ??
    transferPartners.filter((p) => p.name.toLowerCase().includes(q));
  if (Array.isArray(match)) {
    if (match.length === 1) return match[0];
    throw new ToolInputError(
      match.length === 0
        ? `Unknown program "${query}". Use a program_id from list_transfer_partners.`
        : `"${query}" matches ${match.map((p) => p.name).join(', ')}. Use a program_id from list_transfer_partners.`,
    );
  }
  return match;
}

function describeOptionForAgent(option: PointsOption) {
  const base = {
    kind: option.kind,
    bank: ISSUER_LABELS[option.issuer],
    points_used: Math.round(option.pointsUsed),
    cents_per_point: option.cppCents === null ? null : round(option.cppCents),
    usual_cents_per_point: round(option.benchmarkCents),
    is_estimate: option.isEstimate,
    cash_fees_usd: option.cashFees,
  };
  if (option.kind === 'transfer') {
    const issuer = option.issuer;
    return {
      ...base,
      program: option.partner!.name,
      partner_points_used: option.partnerPointsApplied,
      card_to_transfer_from: option.card?.name ?? null,
      source_url: option.partner!.sourceUrls?.[issuer] ?? null,
      verified_on: option.partner!.verifiedOn ?? null,
    };
  }
  if (option.kind === 'chaseTravel') {
    return { ...base, source_url: boostData.non_boost_rate.source_url, verified_on: boostData.non_boost_rate.verified_on };
  }
  return { ...base, card: option.card?.name ?? null, source_url: option.card?.sourceUrl ?? null, verified_on: CARD_TERMS_VERIFIED_ON };
}

export function recommendPayment(input: RecommendInput, today?: string) {
  const balancesByIssuer = Object.fromEntries(
    Object.entries(input.balances).map(([bank, amount]) => [ISSUER_BY_BANK[bank as Bank], amount]),
  ) as Partial<Record<Issuer, number>>;
  const { ownedCards, balances } = cardsForBankBalances(balancesByIssuer, input.chase_card_type);
  const partner = input.award ? findProgram(input.award.program) : null;

  const assumptions: string[] = [];
  if (Object.keys(balances).length > 0) {
    assumptions.push(
      "Balances are given per bank, so each bank's points are treated as held on a typical transfer-capable card from it. A card with a worse transfer ratio (such as Citi Strata) can change the answer.",
    );
  }
  // Without a cash position the strain check can't run, so it's switched off
  // explicitly and said so, rather than guessed.
  const cash = input.cash_position
    ? {
        available: input.cash_position.available_usd,
        monthlyLeftover: input.cash_position.monthly_leftover_usd,
        monthlySpend: input.cash_position.monthly_spending_usd,
      }
    : { available: Number.MAX_SAFE_INTEGER, monthlyLeftover: 0, monthlySpend: 1 };
  if (!input.cash_position) {
    assumptions.push('No cash position was given, so paying cash is assumed not to strain the traveller. Supply cash_position to include that check.');
  }

  const result = evaluateVerdict({
    tripCashPrice: input.trip_cash_price_usd,
    awardTaxes: input.award_taxes_usd ?? 0,
    ownedCards,
    balances,
    transferPartners,
    award: partner
      ? { partnerId: partner.id, pointsRequired: input.award!.points_required, partnerPointsHeld: input.award!.points_already_held ?? 0 }
      : undefined,
    basis: input.value_points_at,
    chase: {
      cardType: input.chase_card_type,
      reserveAppliedBeforeCutoff: input.reserve_applied_before_2025_06_23,
      travelPricePoints: input.chase_travel_points_price,
    },
    cash,
    today,
  });

  return {
    recommendation: result.verdict,
    headline: verdictHeadline(result),
    reason: result.reason,
    options: result.options.map(describeOptionForAgent),
    cash_after_paying: input.cash_position ? describeRunway(result.runway.payCash) : null,
    chase_travel: result.chaseTravel
      ? {
          card: result.chaseTravel.cardTypeName,
          standard_points_price: Math.round(result.chaseTravel.nonBoostPoints),
          cents_per_point_range: {
            from: round(result.chaseTravel.floorCents),
            to: result.chaseTravel.maxCents === null ? 'not stated by Chase' : round(result.chaseTravel.maxCents),
          },
          breakeven_points: result.chaseTravel.breakevenPoints,
          advice: result.chaseTravel.sentence,
          source_url: boostData.non_boost_rate.source_url,
          verified_on: boostData.non_boost_rate.verified_on,
        }
      : null,
    assumptions: [...assumptions, ...result.assumptions],
    rules_of_thumb: {
      clearly_beats_usual_value_by: `${Math.round((verdictConfig.clearly_beats_benchmark_multiplier - 1) * 100)}%`,
      is_estimate: true,
      note: "These thresholds are PointCompass's own rules of thumb, not published figures.",
    },
  };
}
