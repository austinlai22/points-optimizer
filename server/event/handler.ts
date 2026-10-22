import { readStats, recordEvent, VERDICTS, type PilotEvent } from '../analytics';
import type { Verdict } from '../../src/lib/verdict/types';
import type { Store } from '../store';

export interface EventDeps {
  store: Store | null;
  // Bearer token for reading the counts back. Unset means nobody can.
  statsToken: string;
}

// The web app's anonymous id: a random UUID made in the browser, nothing else.
const ANON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Accepts only the exact events the pilot measures, so nothing else can be
// written through here.
function parseEvent(body: unknown): { event: PilotEvent; id: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { event, verdict, id } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !ANON_ID.test(id)) return null;
  if (event === 'pasted_price_used') return { event: { name: event }, id };
  if (event === 'verdict_shown' && VERDICTS.includes(verdict as never)) {
    return { event: { name: event, verdict: verdict as Verdict }, id };
  }
  return null;
}

export function createEventHandler(deps: EventDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'GET') {
        const auth = request.headers.get('authorization');
        if (!deps.store || deps.statsToken.length < 16 || auth !== `Bearer ${deps.statsToken}`) {
          return new Response('Not found', { status: 404 });
        }
        return Response.json(await readStats(deps.store));
      }

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
      if (deps.store) await recordEvent(deps.store, parsed.event, 'web', parsed.id);
      return new Response(null, { status: 204 });
    },
  };
}
