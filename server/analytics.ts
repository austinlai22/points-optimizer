import type { Verdict } from '../src/lib/verdict/types';
import type { Store } from './store';

// Usage counts (v3 spec §7b): what happened, on which day, and for trip checks
// a random id the browser made up, so active and returning users can be
// counted. Never inputs, prices, balances or cash figures, and never anything
// tied to a person: price reports and agent calls carry no id at all.
//
// Everything is keyed by UTC day, so any week is just seven days added up.

export type UsageEvent =
  | { name: 'trip_check'; verdict: Verdict }
  | { name: 'price_check' }
  | { name: 'price_report' }
  | { name: 'price_report_rejected' }
  | { name: 'agent_call'; tool: string };

export const VERDICTS: Verdict[] = [
  'PAY_CASH',
  'TRANSFER_POINTS',
  'BOOK_CHASE_TRAVEL',
  'BOOK_TRAVEL_PORTAL',
  'WAIT_OR_RECONSIDER',
];

const DAY = 24 * 60 * 60;
// Daily counts are kept for a little over a year.
const COUNTS_TTL = 400 * DAY;
// Which days an anonymous id checked a trip, kept only long enough to tell a
// returning user from a new one.
const ID_DAYS_TTL = 120 * DAY;

export function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function fieldFor(event: UsageEvent): string {
  if (event.name === 'trip_check') return `trip_check:${event.verdict}`;
  if (event.name === 'agent_call') return `agent_call:${event.tool}`;
  return event.name;
}

export async function recordEvent(
  store: Store,
  event: UsageEvent,
  anonId: string | null,
  now: Date = new Date(),
): Promise<void> {
  const day = utcDate(now);
  const countsKey = `stats:day:${day}`;
  await store.hincrby(countsKey, fieldFor(event), 1);
  await store.expire(countsKey, COUNTS_TTL);

  if (event.name !== 'trip_check' || !anonId) return;

  const activeKey = `stats:active:${day}`;
  const daysKey = `stats:iddays:${anonId}`;
  await Promise.all([store.pfadd(activeKey, anonId), store.sadd(daysKey, day)]);
  await Promise.all([store.expire(activeKey, COUNTS_TTL), store.expire(daysKey, ID_DAYS_TTL)]);
  // Returning: has checked trips on two or more different days.
  if ((await store.scard(daysKey)) >= 2) {
    const returningKey = `stats:returning:${day}`;
    await store.pfadd(returningKey, anonId);
    await store.expire(returningKey, COUNTS_TTL);
  }
}

export interface PeriodStats {
  from: string;
  to: string;
  counts: Record<string, number>;
  activeUsers: number;
  returningUsers: number;
}

// Totals for the days from `from` to `to` inclusive (YYYY-MM-DD, UTC).
export async function readPeriod(store: Store, from: string, to: string): Promise<PeriodStats> {
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); utcDate(d) <= to; d = new Date(d.getTime() + DAY * 1000)) {
    days.push(utcDate(d));
  }
  const counts: Record<string, number> = {};
  for (const daily of await Promise.all(days.map((day) => store.hgetall(`stats:day:${day}`)))) {
    for (const [field, n] of Object.entries(daily)) counts[field] = (counts[field] ?? 0) + n;
  }
  const [activeUsers, returningUsers] = await Promise.all([
    store.pfcount(...days.map((day) => `stats:active:${day}`)),
    store.pfcount(...days.map((day) => `stats:returning:${day}`)),
  ]);
  return { from, to, counts, activeUsers, returningUsers };
}
