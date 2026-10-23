import { readPeriod, utcDate, VERDICTS, type PeriodStats } from './analytics';
import type { Store } from './store';
import type { PriceReport } from '../src/lib/reports/validate';

// The logic behind the two local admin scripts (npm run stats, npm run
// export-reports). They read Upstash directly with the keys in .env.local, so
// there is no stats page or export endpoint on the website at all.

const DAY_MS = 24 * 60 * 60 * 1000;

// Monday-to-Sunday weeks (UTC), most recent last, ending with the current week.
export function recentWeeks(count: number, now: Date = new Date()): { from: string; to: string }[] {
  const today = new Date(`${utcDate(now)}T00:00:00Z`);
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(monday.getTime() - (count - 1 - i) * 7 * DAY_MS);
    return { from: utcDate(start), to: utcDate(new Date(start.getTime() + 6 * DAY_MS)) };
  });
}

export async function weeklyStats(store: Store, weeks: number, now?: Date): Promise<PeriodStats[]> {
  return Promise.all(recentWeeks(weeks, now).map(({ from, to }) => readPeriod(store, from, to)));
}

function sumPrefix(counts: Record<string, number>, prefix: string): number {
  return Object.entries(counts)
    .filter(([field]) => field.startsWith(prefix))
    .reduce((sum, [, n]) => sum + n, 0);
}

export interface WeekRow {
  week_starting: string;
  trip_checks: number;
  active_users: number;
  returning_users: number;
  price_checks: number;
  price_reports: number;
  price_reports_rejected: number;
  agent_calls: number;
  [detail: string]: string | number;
}

// One row per week: the headline metrics, then trip checks by verdict and
// agent calls by tool. Page visitors come from Vercel's Analytics dashboard.
export function toRows(weeks: PeriodStats[]): WeekRow[] {
  const tools = [...new Set(weeks.flatMap((w) => Object.keys(w.counts).filter((f) => f.startsWith('agent_call:'))))].sort();
  return weeks.map((w) => {
    const row: WeekRow = {
      week_starting: w.from,
      trip_checks: sumPrefix(w.counts, 'trip_check:'),
      active_users: w.activeUsers,
      returning_users: w.returningUsers,
      price_checks: w.counts.price_check ?? 0,
      price_reports: w.counts.price_report ?? 0,
      price_reports_rejected: w.counts.price_report_rejected ?? 0,
      agent_calls: sumPrefix(w.counts, 'agent_call:'),
    };
    for (const verdict of VERDICTS) row[`trip_checks_${verdict}`] = w.counts[`trip_check:${verdict}`] ?? 0;
    for (const tool of tools) row[tool.replace('agent_call:', 'agent_calls_')] = w.counts[tool] ?? 0;
    return row;
  });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const header = columns ?? Object.keys(rows[0] ?? {});
  return [header.join(','), ...rows.map((row) => header.map((c) => csvCell(row[c])).join(','))].join('\n') + '\n';
}

export const REPORT_COLUMNS: (keyof PriceReport)[] = [
  'submitted_on',
  'card_type',
  'booking_type',
  'origin',
  'destination',
  'travel_month',
  'cabin',
  'cash_price_usd',
  'chase_points_price',
  'boost_shown',
  'implied_cpp',
];

// Every stored report, oldest first.
export async function allReports(store: Store): Promise<PriceReport[]> {
  const keys = await store.keys('report:*');
  const values = await store.mget(keys);
  return values
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as PriceReport)
    .sort((a, b) => a.submitted_on.localeCompare(b.submitted_on));
}
