import type { Verdict } from '../src/lib/verdict/types';
import type { Store } from './store';

// Pilot measurement (spec §9): counts only. No inputs, no prices, no balances
// — an event is a name plus, for verdicts, which verdict. Unique users go into
// a HyperLogLog, which estimates how many distinct ids it has seen without
// keeping any of them.

export type Channel = 'web' | 'whatsapp';

export type PilotEvent =
  | { name: 'verdict_shown'; verdict: Verdict }
  | { name: 'pasted_price_used' }
  | { name: 'whatsapp_conversation_started' };

export const VERDICTS: Verdict[] = [
  'PAY_CASH',
  'TRANSFER_POINTS',
  'BOOK_CHASE_TRAVEL',
  'BOOK_TRAVEL_PORTAL',
  'WAIT_OR_RECONSIDER',
];

const EVENTS_KEY = 'stats:events';

function fieldFor(event: PilotEvent, channel: Channel): string {
  return event.name === 'verdict_shown'
    ? `${event.name}:${channel}:${event.verdict}`
    : `${event.name}:${channel}`;
}

export async function recordEvent(
  store: Store,
  event: PilotEvent,
  channel: Channel,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const field = fieldFor(event, channel);
  const month = now.toISOString().slice(0, 7);
  await Promise.all([
    store.hincrby(EVENTS_KEY, field, 1),
    store.hincrby(`${EVENTS_KEY}:${month}`, field, 1),
    store.pfadd(`stats:users:${channel}`, userId),
  ]);
}

export async function readStats(store: Store, now: Date = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const [allTime, thisMonth, web, whatsapp] = await Promise.all([
    store.hgetall(EVENTS_KEY),
    store.hgetall(`${EVENTS_KEY}:${month}`),
    store.pfcount('stats:users:web'),
    store.pfcount('stats:users:whatsapp'),
  ]);
  return { allTime, [month]: thisMonth, uniqueUsers: { web, whatsapp } };
}
