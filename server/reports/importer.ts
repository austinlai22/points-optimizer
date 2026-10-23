import { validateReport, type PriceReport } from '../../src/lib/reports/validate';
import type { Store } from '../store';
import { toAirlineCode, toHotelChainId } from '../../src/lib/reports/brands';
import { retentionEnd, saveReport } from './save';

// Bulk import of Austin's own Chase Travel price entries from a CSV. Every row
// goes through exactly the website's validation, and is marked as entered by
// an admin so it can be told apart from visitors' reports later.

export const IMPORT_COLUMNS = [
  'submitted_on',
  'card_type',
  'booking_type',
  'origin',
  'destination',
  'travel_month',
  'cabin',
  'airline',
  'hotel_chain',
  'cash_price_usd',
  'chase_points_price',
  'boost_shown',
] as const;

export interface RowCheck {
  // Spreadsheet line number, counting the header as line 1.
  line: number;
  report?: PriceReport;
  errors: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const blankToNull = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : v.trim());
// "Basic Economy", "basic" and "basic_economy" all mean the same cabin.
function normalizeCabin(value: string | undefined): string | null {
  const cabin = blankToNull(value)?.toLowerCase().replace(/[\s-]+/g, '_') ?? null;
  return cabin === 'basic' ? 'basic_economy' : cabin;
}
const asNumber = (v: string | undefined) => (blankToNull(v) === null ? undefined : Number(v!.replace(/[$,\s]/g, '')));

export function checkRows(rows: Record<string, string>[], today: string): RowCheck[] {
  return rows.map((row, i) => {
    const line = i + 2;
    const errors: string[] = [];

    // The day you saw the price; blank means today. It also sets when the
    // report is deleted, so it can't be in the future or already expired.
    const submittedOn = blankToNull(row.submitted_on) ?? today;
    if (!DATE.test(submittedOn)) errors.push('submitted_on must be YYYY-MM-DD, or blank for today.');
    else if (submittedOn > today) errors.push('submitted_on is in the future.');
    else if (retentionEnd(submittedOn).toISOString().slice(0, 10) <= today) errors.push('submitted_on is older than the retention period.');

    const raw = {
      card_type: blankToNull(row.card_type),
      booking_type: blankToNull(row.booking_type)?.toLowerCase(),
      origin: blankToNull(row.origin)?.toUpperCase() ?? null,
      destination: blankToNull(row.destination)?.toUpperCase(),
      travel_month: blankToNull(row.travel_month),
      cabin: normalizeCabin(row.cabin),
      airline: blankToNull(row.airline) === null ? null : toAirlineCode(row.airline),
      hotel_chain: blankToNull(row.hotel_chain) === null ? null : toHotelChainId(row.hotel_chain),
      cash_price_usd: asNumber(row.cash_price_usd),
      chase_points_price: asNumber(row.chase_points_price),
      boost_shown: blankToNull(row.boost_shown)?.toLowerCase(),
    };

    if (errors.length > 0) return { line, errors };
    const result = validateReport(raw, submittedOn);
    if (!result.ok) return { line, errors: result.errors };
    return { line, report: { ...result.report, source: 'admin' }, errors: [] };
  });
}

export interface ImportOutcome {
  checked: number;
  stored: number;
  problems: RowCheck[];
}

// Stores every valid row, but only if no row has a problem, unless
// skipInvalid is set. A dry run checks without storing anything.
export async function importReports(
  store: Store | null,
  rows: Record<string, string>[],
  { today, dryRun = false, skipInvalid = false, now = new Date() }: { today: string; dryRun?: boolean; skipInvalid?: boolean; now?: Date },
): Promise<ImportOutcome> {
  const checks = checkRows(rows, today);
  const problems = checks.filter((c) => c.errors.length > 0);
  const valid = checks.filter((c) => c.report).map((c) => c.report!);
  if (dryRun || !store || (problems.length > 0 && !skipInvalid)) {
    return { checked: checks.length, stored: 0, problems };
  }
  let stored = 0;
  for (const report of valid) if (await saveReport(store, report, now)) stored += 1;
  return { checked: checks.length, stored, problems };
}
