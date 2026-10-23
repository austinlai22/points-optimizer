import transferPartnersData from '../src/data/transferPartners.json';
import boostData from '../src/data/chase-points-boost.json';
import { breakevenPoints } from '../src/lib/verdict';
import { ISSUER_LABELS, ISSUER_ORDER } from '../src/utils/issuers';
import type { Issuer, TransferPartner } from '../src/types';
import { computeCentsPerPoint } from '../server/mcp/tools';

// The question set, with every correct answer computed from the app's own
// data files and engine at generation time, so the key always matches the
// product. Objective questions only: each has one right answer.

const transferPartners = transferPartnersData as TransferPartner[];
const ENGINE_SOURCE = 'https://github.com/austinlai22/points-optimizer/blob/main/server/mcp/tools.ts';

export const CATEGORIES = ['transfer_facts', 'arithmetic', 'points_boost_rules', 'breakeven'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Question {
  id: string;
  category: Category;
  question: string;
  correct_answer: string;
  acceptable_variants: string;
  source_url: string;
  verified_date: string;
}

function partner(id: string): TransferPartner {
  const p = transferPartners.find((x) => x.id === id);
  if (!p) throw new Error(`No partner ${id} in the data`);
  return p;
}

// "1:1", "5:4", "1:1.6": the bank's points on the left.
function ratioText(ratio: number): string {
  const known: Record<string, string> = { '0.8': '5:4', '0.75': '4:3', '0.6': '5:3', '0.5': '2:1', '0.7': '10:7' };
  return known[String(ratio)] ?? `1:${ratio}`;
}

function transferQuestion(id: string, issuer: Issuer, partnerId: string, question: string): Question {
  const p = partner(partnerId);
  const ratio = p.ratiosByIssuer[issuer];
  return {
    id,
    category: 'transfer_facts',
    question,
    correct_answer:
      ratio === undefined
        ? `No. ${ISSUER_LABELS[issuer]} points do not transfer to ${p.name}.`
        : `Yes, at ${ratioText(ratio)} (1,000 ${ISSUER_LABELS[issuer]} points become ${Math.round(1000 * ratio).toLocaleString('en-US')} ${p.name} points).`,
    acceptable_variants: ratio === undefined ? 'No; not a transfer partner; partnership ended' : `${ratioText(ratio)}; ${Math.round(1000 * ratio)} per 1,000`,
    source_url: (ratio === undefined ? Object.values(p.sourceUrls ?? {})[0] : p.sourceUrls?.[issuer]) ?? '',
    verified_date: p.verifiedOn ?? '',
  };
}

function arithmeticQuestion(id: string, question: string, cash: number, points: number, taxes: number, today: string): Question {
  const { cents_per_point } = computeCentsPerPoint(cash, points, taxes);
  const shown = Number(cents_per_point.toFixed(2));
  return {
    id,
    category: 'arithmetic',
    question,
    correct_answer: `${shown}¢ per point, from (${cash} − ${taxes}) × 100 ÷ ${points}.`,
    acceptable_variants: `${shown} cents; $${(shown / 100).toFixed(4)} per point; within 0.01¢`,
    source_url: ENGINE_SOURCE,
    verified_date: today,
  };
}

function breakevenQuestion(id: string, question: string, cash: number, target: number, today: string): Question {
  const max = breakevenPoints(cash, target);
  return {
    id,
    category: 'breakeven',
    question,
    correct_answer: `${max.toLocaleString('en-US')} points (${cash} × 100 ÷ ${target}, rounded down).`,
    acceptable_variants: `${max}; ${(max + 1).toLocaleString('en-US')} if rounded up is "partly"`,
    source_url: ENGINE_SOURCE,
    verified_date: today,
  };
}

export function buildQuestions(today: string): Question[] {
  const reserve = boostData.card_types.reserve;
  const preferred = boostData.card_types.preferred;
  const legacy = boostData.reserve_legacy;
  const standard = boostData.non_boost_rate;

  const atmos = partner('atmos');
  const atmosBanks = ISSUER_ORDER.filter((i) => atmos.ratiosByIssuer[i] !== undefined);

  return [
    transferQuestion('T1', 'chase', 'hyatt', 'I have a Chase Sapphire Reserve. Can I move my Ultimate Rewards points to World of Hyatt, and at what ratio?'),
    transferQuestion('T2', 'amex', 'cathay', 'Do Amex Membership Rewards points transfer to Cathay Pacific Asia Miles? What ratio?'),
    transferQuestion('T3', 'citi', 'aeromexico', 'Can I transfer Citi ThankYou points to Aeromexico Rewards right now?'),
    {
      id: 'T4',
      category: 'transfer_facts',
      question:
        'Of Chase, Capital One, Amex, Citi, Bank of America and Bilt, which banks let you transfer points to Atmos Rewards (Alaska and Hawaiian Airlines)?',
      correct_answer: `Only ${atmosBanks.map((i) => ISSUER_LABELS[i]).join(' and ')}, at ${atmosBanks.map((i) => ratioText(atmos.ratiosByIssuer[i]!)).join(', ')}.`,
      acceptable_variants: `${atmosBanks.map((i) => ISSUER_LABELS[i]).join(', ')} only`,
      source_url: atmos.sourceUrls?.[atmosBanks[0]] ?? '',
      verified_date: atmos.verifiedOn ?? '',
    },

    arithmeticQuestion('A1', 'A flight costs $900 in cash, or 60,000 miles plus $90 in taxes. How many cents per mile is that redemption worth?', 900, 60000, 90, today),
    arithmeticQuestion('A2', 'A hotel night is $450, or 30,000 points with no fees. What is each point worth in cents?', 450, 30000, 0, today),
    arithmeticQuestion('A3', 'A business class seat is $4,200 cash or 70,000 miles plus $280 in taxes and fees. What is the value per mile in cents?', 4200, 70000, 280, today),
    arithmeticQuestion('A4', 'Chase Travel prices a $1,000 trip at 66,667 points. How many cents is each point worth there?', 1000, 66667, 0, today),

    {
      id: 'B1',
      category: 'points_boost_rules',
      question: 'With Chase Points Boost, what is the most my points can be worth on a Sapphire Reserve?',
      correct_answer: `Up to ${reserve.max_multiplier}x (${reserve.max_multiplier}¢ per point) on selected hotels, including The Edit, and selected flights in Chase Travel.`,
      acceptable_variants: `${reserve.max_multiplier}x; ${reserve.max_multiplier} cents`,
      source_url: reserve.source_url,
      verified_date: reserve.verified_on,
    },
    {
      id: 'B2',
      category: 'points_boost_rules',
      question: 'What is the maximum Points Boost value on the Chase Sapphire Preferred?',
      correct_answer: `Up to ${preferred.max_multiplier}x (${preferred.max_multiplier}¢ per point) on top-booked hotels and flights with select airlines in Chase Travel.`,
      acceptable_variants: `${preferred.max_multiplier}x; ${preferred.max_multiplier} cents`,
      source_url: preferred.source_url,
      verified_date: preferred.verified_on,
    },
    {
      id: 'B3',
      category: 'points_boost_rules',
      question: "I've had my Sapphire Reserve since 2023. Are my older points still worth 1.5 cents each in Chase Travel, and until when?",
      correct_answer: `Yes, for points earned before ${legacy.points_earned_before} (you applied before ${legacy.applied_before}): ${legacy.cents_per_point}x in Chase Travel until ${legacy.expires_on}.`,
      acceptable_variants: `Yes until October 26, 2027, for points earned before October 26, 2025`,
      source_url: legacy.source_url,
      verified_date: legacy.verified_on,
    },
    {
      id: 'B4',
      category: 'points_boost_rules',
      question: "Without a Points Boost offer, how much is a Chase Sapphire Reserve point worth when booking through Chase Travel? (Assume I opened the card this year.)",
      correct_answer: `${standard.cents_per_point}¢ per point (1:1).`,
      acceptable_variants: '1 cent; 1:1',
      source_url: standard.source_url,
      verified_date: standard.verified_on,
    },

    breakevenQuestion('K1', 'A trip costs $1,000 in Chase Travel. I only want to use points if I get at least 1.6 cents each. What is the most points I should pay?', 1000, 1.6, today),
    breakevenQuestion('K2', 'A hotel is $750. What is the highest points price that still gets me 1.25 cents per point?', 750, 1.25, today),
    breakevenQuestion('K3', 'A $1,300 flight: what is the maximum number of points I should accept if I want at least 1.5 cents per point?', 1300, 1.5, today),
  ];
}

export const QUESTION_COLUMNS: (keyof Question)[] = [
  'id', 'category', 'question', 'correct_answer', 'acceptable_variants', 'source_url', 'verified_date',
];
