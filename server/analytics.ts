import type { Verdict } from '../src/lib/verdict/types';
import type { Store } from './store';

// Usage counts (v3 spec §7b): what happened, on which day, and for trip checks
// a random id the browser made up, so active and returning users can be
// counted. Never inputs, prices, balances or cash figures, and never anything
// tied to a person: price reports and agent calls carry no id at all.
//
// Everything is keyed by UTC day, so any week is just seven days added up.

export type UsageEvent =
  // cash: whether a cash position was given. Before it became optional every
  // check had one, so "with cash" compares like for like across that change.
  | { name: 'trip_check'; verdict: Verdict; cash: boolean }
  | { name: 'price_check' }
  | { name: 'trip_saved' }
  | { name: 'trips_compared' }
  | { name: 'price_report' }
  | { name: 'price_report_rejected' }
  | { name: 'agent_call'; tool: string }
  // A call to /api/ai, by kind ('parse' or 'chat'). Nothing about its content.
  | { name: 'ai_call'; mode: 'parse' | 'chat' }
  // Once per visit, with where it came from as one word.
  | { name: 'visit'; source: string }
  | { name: 'trip_started' }
  | { name: 'assistant_question' };

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
  if (event.name === 'ai_call') return `ai_call:${event.mode}`;
  if (event.name === 'visit') return `visit:${event.source}`;
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
  if (event.name === 'trip_check' && event.cash) await store.hincrby(countsKey, 'trip_check_with_cash', 1);
  await store.expire(countsKey, COUNTS_TTL);

  if (event.name !== 'trip_check' || !anonId) return;

  const activeKey = `stats:active:${day}`;
  const daysKey = `stats:iddays:${anonId}`;
  const firstKey = `stats:idfirst:${anonId}`;
  // The first day this id checked a trip, to tell whether it came back within
  // 30 days. Ids seen before this was kept are marked, not counted as new.
  const seenBefore = (await store.scard(daysKey)) > 0;
  const isNew = await store.set(firstKey, seenBefore ? 'earlier' : day, { ttlSeconds: ID_DAYS_TTL, nx: true });
  await Promise.all([store.pfadd(activeKey, anonId), store.sadd(daysKey, day)]);
  await Promise.all([store.expire(activeKey, COUNTS_TTL), store.expire(daysKey, ID_DAYS_TTL), store.expire(firstKey, ID_DAYS_TTL)]);
  if (isNew && !seenBefore) {
    await store.pfadd(`stats:new:${day}`, anonId);
    await store.expire(`stats:new:${day}`, COUNTS_TTL);
  } else if (!isNew) {
    // Came back on a later day within 30 days of the first: counted against
    // the day it was first seen, so each week's newcomers get a rate.
    const first = await store.get(firstKey);
    if (first && first !== 'earlier' && first < day && daysBetween(first, day) <= COME_BACK_DAYS) {
      await store.pfadd(`stats:back30:${first}`, anonId);
      await store.expire(`stats:back30:${first}`, COUNTS_TTL);
    }
  }
  // Returning: has checked trips on two or more different days.
  if ((await store.scard(daysKey)) >= 2) {
    const returningKey = `stats:returning:${day}`;
    await store.pfadd(returningKey, anonId);
    await store.expire(returningKey, COUNTS_TTL);
  }
}

export const COME_BACK_DAYS = 30;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (DAY * 1000));
}

export interface PeriodStats {
  from: string;
  to: string;
  counts: Record<string, number>;
  activeUsers: number;
  returningUsers: number;
  // Ids whose first trip check was in this period, and of those, how many
  // checked again on a later day within 30 days.
  newUsers: number;
  cameBackWithin30Days: number;
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
  const [activeUsers, returningUsers, newUsers, cameBackWithin30Days] = await Promise.all([
    store.pfcount(...days.map((day) => `stats:active:${day}`)),
    store.pfcount(...days.map((day) => `stats:returning:${day}`)),
    store.pfcount(...days.map((day) => `stats:new:${day}`)),
    store.pfcount(...days.map((day) => `stats:back30:${day}`)),
  ]);
  return { from, to, counts, activeUsers, returningUsers, newUsers, cameBackWithin30Days };
}
