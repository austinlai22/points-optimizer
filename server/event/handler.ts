import { recordEvent, VERDICTS, type UsageEvent } from '../analytics';
import type { Verdict } from '../../src/lib/verdict/types';
import type { Store } from '../store';

export interface EventDeps {
  store: Store | null;
}

// The web app's anonymous id: a random UUID made in the browser, nothing else.
const ANON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Accepts only the events the browser sends, so nothing else can be
// written through here. Reading the counts is a local script (npm run stats),
// not an endpoint, so there is no stats page to protect.
function parseEvent(body: unknown): { event: UsageEvent; id: string | null } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { event, verdict, id, cash } = body as Record<string, unknown>;
  if (event === 'trip_check') {
    if (typeof id !== 'string' || !ANON_ID.test(id)) return null;
    if (!VERDICTS.includes(verdict as Verdict)) return null;
    // A page loaded before cash became optional sends no flag; back then
    // every check had a cash position.
    if (cash !== undefined && typeof cash !== 'boolean') return null;
    return { event: { name: 'trip_check', verdict: verdict as Verdict, cash: cash ?? true }, id };
  }
  // The rest are counted without any id.
  if (event === 'price_check' || event === 'trip_saved' || event === 'trips_compared') return { event: { name: event }, id: null };
  return null;
}

export function createEventHandler(deps: EventDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

      const raw = await request.text();
      if (raw.length > 1024) return new Response('Too large', { status: 413 });
      let parsed: ReturnType<typeof parseEvent>;
      try {
        parsed = parseEvent(JSON.parse(raw));
      } catch {
        parsed = null;
      }
      if (!parsed) return new Response('Bad request', { status: 400 });

      // No store configured: counting is simply off.
      if (deps.store) await recordEvent(deps.store, parsed.event, parsed.id);
      return new Response(null, { status: 204 });
    },
  };
}
