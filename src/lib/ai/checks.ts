import reportConfig from '../../data/report-config.json';
import { formatCents } from '../verdict';
import { partnerName } from '../trips';
import { formatUSD, formatUSDExact } from '../../utils/format';
import type { ParsedTrip } from './protocol';
import type { TripInputs } from '../trips';

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

// `filled`: the trip as it went into the form, which can keep what was
// already there (a price, or the program) when the words didn't say.
export function readingChecks(t: ParsedTrip, filled: TripInputs | null = null): ReadingChecks {
  const read: string[] = [];
  const warnings: string[] = [];
  const keptPrice = t.trip_cash_price_usd === null && filled && filled.tripCashPrice > 0 ? filled.tripCashPrice : null;
  const price = t.trip_cash_price_usd ?? keptPrice;
  const programId = t.program ?? (t.award_points !== null && filled?.selectedPartnerId ? filled.selectedPartnerId : null);
  const keptProgram = t.program === null && programId !== null;
  const program = programId ? partnerName(programId) ?? programId : null;

  if (t.trip_cash_price_usd !== null) read.push(`${formatUSD(t.trip_cash_price_usd)} cash`);
  if (t.award_points !== null) {
    read.push(`${pts(t.award_points)} ${program ?? ''} points${t.award_taxes_usd !== null ? ` + ${formatUSDExact(t.award_taxes_usd)}` : ''}`.replace(/\s+/g, ' '));
  } else if (t.award_taxes_usd !== null) {
    read.push(`${formatUSDExact(t.award_taxes_usd)} in taxes and fees`);
  }
  if (t.partner_points_held !== null) read.push(`${pts(t.partner_points_held)} ${program ?? ''} points you already have`.replace(/\s+/g, ' '));
  if (t.chase_travel_points !== null) read.push(`${pts(t.chase_travel_points)} points in Chase Travel`);

  if (keptPrice !== null) warnings.push(`No cash price in that, so the ${formatUSD(keptPrice)} already in the form was kept. Change it below if it's a different trip.`);
  else if (price === null) warnings.push('No cash price found. Add it below to get a recommendation.');
  if (t.award_points !== null && !program) warnings.push('Found an award price but not its program. Choose the program below.');
  if (keptProgram) warnings.push(`No program in that, so the points were put with ${program}, already in the form. Change it below if that's wrong.`);

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
