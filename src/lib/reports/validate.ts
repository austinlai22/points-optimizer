import reportConfig from '../../data/report-config.json';
import { listChaseCardTypes } from '../verdict/chaseTravel';
import type { ChaseCardType } from '../verdict/types';

// An opt-in Chase Travel price report: what Chase Travel charged in points for
// a trip, and nothing about the person who saw it. The browser form and the
// server both validate with this, so they can't disagree about what's allowed.

export const CARD_TYPES = listChaseCardTypes().map((t) => t.id);
export const BOOKING_TYPES = ['flight', 'hotel'] as const;
export const CABINS = ['basic_economy', 'economy', 'premium_economy', 'business', 'first'] as const;
export const BOOST_ANSWERS = ['yes', 'no', 'unsure'] as const;

export type BookingType = (typeof BOOKING_TYPES)[number];
export type Cabin = (typeof CABINS)[number];
export type BoostAnswer = (typeof BOOST_ANSWERS)[number];

// What the form sends. Every field is a fixed choice, a number or a 3-letter
// code, so nothing typed freely is ever stored.
export interface PriceReportInput {
  card_type: ChaseCardType;
  booking_type: BookingType;
  // Airport or city code. Null for hotels, which have no origin.
  origin: string | null;
  destination: string;
  travel_month: string;
  cabin: Cabin | null;
  cash_price_usd: number;
  chase_points_price: number;
  boost_shown: BoostAnswer;
}

// Who entered a report: a visitor through the website, or Austin through the
// bulk import. Set by the server or the import script, never by the sender.
export type ReportSource = 'visitor' | 'admin';

// What is stored: the input plus the values the server works out.
export interface PriceReport extends PriceReportInput {
  submitted_on: string;
  implied_cpp: number;
  source: ReportSource;
}

export type ValidationResult =
  | { ok: true; report: PriceReport }
  // "invalid": malformed or outside the allowed values.
  // "out_of_range": well-formed, but the implied value per point is outside
  // the plausible band, almost always a typo. Counted, never stored.
  | { ok: false; reason: 'invalid' | 'out_of_range'; errors: string[] };

const CODE = /^[A-Z]{3}$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

function monthIndex(yyyyMm: string): number {
  const [, y, m] = yyyyMm.match(MONTH)!;
  return Number(y) * 12 + Number(m) - 1;
}

// Cents per point, as the server computes it. Chase Travel prices include
// taxes, so the whole cash price is what the points bought.
export function impliedCpp(cashPriceUsd: number, pointsPrice: number): number {
  return Math.round(((cashPriceUsd * 100) / pointsPrice) * 1000) / 1000;
}

function inRange(value: unknown, { min, max }: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

// `today` is an ISO date (YYYY-MM-DD); travel months are checked against it.
export function validateReport(raw: unknown, today: string): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid', errors: ['Report must be an object.'] };
  }
  const r = raw as Record<string, unknown>;

  // Anything beyond the known fields is refused rather than ignored, so a
  // client can't slip extra data in.
  const allowed = new Set([
    'card_type', 'booking_type', 'origin', 'destination', 'travel_month',
    'cabin', 'cash_price_usd', 'chase_points_price', 'boost_shown',
  ]);
  for (const key of Object.keys(r)) if (!allowed.has(key)) errors.push(`Unknown field: ${key}.`);

  if (!CARD_TYPES.includes(r.card_type as ChaseCardType)) errors.push('Unknown card type.');
  if (!BOOKING_TYPES.includes(r.booking_type as BookingType)) errors.push('Booking type must be flight or hotel.');
  const isFlight = r.booking_type === 'flight';

  if (isFlight) {
    if (typeof r.origin !== 'string' || !CODE.test(r.origin)) errors.push('Origin must be a 3-letter airport or city code.');
  } else if (r.origin !== null && r.origin !== undefined) {
    errors.push('Hotels have no origin.');
  }
  if (typeof r.destination !== 'string' || !CODE.test(r.destination)) {
    errors.push('Destination must be a 3-letter airport or city code.');
  }

  if (typeof r.travel_month !== 'string' || !MONTH.test(r.travel_month)) {
    errors.push('Travel month must be YYYY-MM.');
  } else {
    const { months_back, months_ahead } = reportConfig.travel_month_window;
    const delta = monthIndex(r.travel_month) - monthIndex(today.slice(0, 7));
    if (delta < -months_back || delta > months_ahead) errors.push('Travel month is too far from today.');
  }

  if (isFlight) {
    if (r.cabin !== null && r.cabin !== undefined && !CABINS.includes(r.cabin as Cabin)) errors.push('Unknown cabin.');
  } else if (r.cabin !== null && r.cabin !== undefined) {
    errors.push('Hotels have no cabin.');
  }

  if (!inRange(r.cash_price_usd, reportConfig.cash_price_usd)) errors.push('Cash price is outside the allowed range.');
  if (!inRange(r.chase_points_price, reportConfig.chase_points_price) || !Number.isInteger(r.chase_points_price)) {
    errors.push('Points price must be a whole number within the allowed range.');
  }
  if (!BOOST_ANSWERS.includes(r.boost_shown as BoostAnswer)) errors.push('Points Boost answer must be yes, no or unsure.');

  if (errors.length > 0) return { ok: false, reason: 'invalid', errors };

  const implied = impliedCpp(r.cash_price_usd as number, r.chase_points_price as number);
  const band = reportConfig.implied_cpp_band;
  if (implied < band.min || implied > band.max) {
    return {
      ok: false,
      reason: 'out_of_range',
      errors: [`That works out to ${implied}¢ per point, outside the ${band.min}¢ to ${band.max}¢ a real price lands in. Please check the numbers.`],
    };
  }

  return {
    ok: true,
    report: {
      card_type: r.card_type as ChaseCardType,
      booking_type: r.booking_type as BookingType,
      origin: isFlight ? (r.origin as string) : null,
      destination: r.destination as string,
      travel_month: r.travel_month as string,
      cabin: isFlight ? ((r.cabin as Cabin | undefined) ?? null) : null,
      cash_price_usd: r.cash_price_usd as number,
      chase_points_price: r.chase_points_price as number,
      boost_shown: r.boost_shown as BoostAnswer,
      submitted_on: today,
      implied_cpp: implied,
      source: 'visitor',
    },
  };
}
