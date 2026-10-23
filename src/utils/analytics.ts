import { inject } from '@vercel/analytics';
import type { Verdict } from '../lib/verdict/types';

// Usage counts (v3 spec §7b), and nothing more: an event name, which verdict it
// was, and for trip checks a random id this browser made up. No prices,
// balances or cash figures ever leave the page.
//
// Nothing is sent outside production, under Do Not Track, from a browser
// marked internal (visit /?internal=1), or after opting out on the privacy
// page. The same switch covers Vercel's page-view counts.

const ID_KEY = 'cco:anonId';
const INTERNAL_KEY = 'cco:internal';
const OPT_OUT_KEY = 'cco:analyticsOptOut';

type WebEvent = { event: 'trip_check'; verdict: Verdict } | { event: 'price_check' };

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked: the setting just won't persist.
  }
}

export function isOptedOut(): boolean {
  return readFlag(OPT_OUT_KEY);
}

export function setOptedOut(optedOut: boolean): void {
  writeFlag(OPT_OUT_KEY, optedOut);
}

export function isInternal(): boolean {
  return readFlag(INTERNAL_KEY);
}

function countingOff(): boolean {
  return navigator.doNotTrack === '1' || isOptedOut() || isInternal();
}

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
  if (!import.meta.env.PROD || countingOff()) return;
  // Only trip checks carry the id; it's what lets active and returning users
  // be counted. A price check is a bare count.
  let body: Record<string, unknown> = { ...event };
  if (event.event === 'trip_check') {
    const id = anonymousId();
    if (!id) return;
    body = { ...body, id };
  }
  try {
    navigator.sendBeacon?.('/api/event', new Blob([JSON.stringify(body)], { type: 'application/json' }));
  } catch {
    // Counting is best-effort; never let it break the page.
  }
}

// Once, before the first render. Marks this browser internal if the URL asks
// (then tidies the URL), and starts Vercel's page-view counting, which drops
// every view while counting is off.
export function initAnalytics(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('internal') === '1') {
    writeFlag(INTERNAL_KEY, true);
    params.delete('internal');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  if (!import.meta.env.PROD) return;
  inject({ beforeSend: (event) => (countingOff() ? null : event) });
}
