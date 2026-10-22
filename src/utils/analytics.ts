import type { Verdict } from '../lib/verdict/types';

// Pilot event counts (spec §9), and nothing more: an event name, which verdict
// it was, and a random id this browser made up. No prices, balances or cash
// figures ever leave the page. Skipped entirely outside production and for
// anyone with Do Not Track on.

const ID_KEY = 'cco:anonId';

type WebEvent = { event: 'verdict_shown'; verdict: Verdict } | { event: 'pasted_price_used' };

function anonymousId(): string | null {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(event: WebEvent): void {
  if (!import.meta.env.PROD || navigator.doNotTrack === '1') return;
  const id = anonymousId();
  if (!id) return;
  const body = JSON.stringify({ ...event, id });
  try {
    navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }));
  } catch {
    // Counting is best-effort; never let it break the page.
  }
}
