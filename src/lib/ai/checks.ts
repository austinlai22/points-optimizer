import reportConfig from '../../data/report-config.json';
import { formatCents } from '../verdict';
import { partnerName } from '../trips';
import { formatUSD, formatUSDExact } from '../../utils/format';
import type { ParsedTrip } from './protocol';

// After a trip is read from someone's words, whichever reader did it (the
// browser's AI, Gemini or the rules): what was read, in plain words, and
// anything that looks off, so a slip like "6k" for "60k" is caught before
// it decides the answer. These only point things out; nothing is changed.

const BAND = reportConfig.implied_cpp_band;

const pts = (n: number) => Math.round(n).toLocaleString('en-US');

export interface ReadingChecks {
  // "$900 cash", "60,000 United MileagePlus points + $85", ...
  read: string[];
  warnings: string[];
}

export function readingChecks(t: ParsedTrip): ReadingChecks {
  const read: string[] = [];
  const warnings: string[] = [];
  const price = t.trip_cash_price_usd;
  const program = t.program ? partnerName(t.program) ?? t.program : null;

  if (price !== null) read.push(`${formatUSD(price)} cash`);
  if (t.award_points !== null) {
    read.push(`${pts(t.award_points)} ${program ?? ''} points${t.award_taxes_usd !== null ? ` + ${formatUSDExact(t.award_taxes_usd)}` : ''}`.replace(/\s+/g, ' '));
  } else if (t.award_taxes_usd !== null) {
    read.push(`${formatUSDExact(t.award_taxes_usd)} in taxes and fees`);
  }
  if (t.partner_points_held !== null) read.push(`${pts(t.partner_points_held)} ${program ?? ''} points you already have`.replace(/\s+/g, ' '));
  if (t.chase_travel_points !== null) read.push(`${pts(t.chase_travel_points)} points in Chase Travel`);

  if (price === null) warnings.push('No cash price found. Add it below to get a recommendation.');
  if (t.award_points !== null && !program) warnings.push('Found an award price but not its program. Choose the program below.');

  if (price !== null && t.award_taxes_usd !== null && t.award_taxes_usd >= price) {
    warnings.push(`The taxes and fees (${formatUSDExact(t.award_taxes_usd)}) are as much as the cash price (${formatUSD(price)}). Check both.`);
  }

  const outside = (cents: number, what: string, points: number) => {
    if (cents < BAND.min) {
      warnings.push(`That's ${formatCents(cents)} a point for ${what}, far below usual. Check the points: ${pts(points)} may have a zero too many.`);
    } else if (cents > BAND.max) {
      warnings.push(`That's ${formatCents(cents)} a point for ${what}, far above usual. Check the points: ${pts(points)} may be missing a zero.`);
    }
  };
  // Taxes at or above the price already have their own warning.
  if (price !== null && t.award_points !== null && !(t.award_taxes_usd !== null && t.award_taxes_usd >= price)) {
    outside(((price - (t.award_taxes_usd ?? 0)) * 100) / t.award_points, 'the award', t.award_points);
  }
  if (price !== null && t.chase_travel_points !== null) outside((price * 100) / t.chase_travel_points, 'Chase Travel', t.chase_travel_points);

  if (t.partner_points_held !== null && t.award_points !== null && t.partner_points_held > t.award_points) {
    warnings.push(
      `You have more ${program ?? 'program'} points (${pts(t.partner_points_held)}) than the award costs (${pts(t.award_points)}), so no transfer is needed. Check the two weren't swapped.`,
    );
  }
  return { read, warnings };
}
