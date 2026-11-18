import { inject } from '@vercel/analytics';
import type { Verdict } from '../lib/verdict/types';

// Usage counts (v3 spec §7b), and nothing more: an event name, which verdict it
// was and whether a cash position was given, and for trip checks a random id
// this browser made up. No prices,
// balances or cash figures ever leave the page.
//
// Nothing is sent outside production, under Do Not Track, from a browser
// marked internal (visit /?internal=1), or after opting out on the privacy
// page. The same switch covers Vercel's page-view counts.

const ID_KEY = 'cco:anonId';
const INTERNAL_KEY = 'cco:internal';
const OPT_OUT_KEY = 'cco:analyticsOptOut';

type WebEvent =
  | { event: 'trip_check'; verdict: Verdict; cash: boolean }
  | { event: 'price_check' }
  // Bare counts: no trip details, no id.
  | { event: 'trip_saved' }
  | { event: 'trips_compared' }
  // Once per visit: where it came from, as one word ("reddit", "search",
  // "direct", or a link's own utm_source tag). Never the page or link itself.
  | { event: 'visit'; source: string }
  // Once per visit: started entering a trip on Check a trip.
  | { event: 'trip_started' }
  // A question asked of the assistant. Never what was asked.
  | { event: 'assistant_question' };

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
  // be counted. Everything else is a bare count.
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

// Where a visit came from, as one plain word: a link's utm_source tag if it
// has one (so links shared on Reddit, LinkedIn or a QR code can be told
// apart), otherwise the kind of site that sent it.
export function visitSource(search: string, referrer: string, ownHost: string): string {
  const tag = (new URLSearchParams(search).get('utm_source') ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (tag) return tag;
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }
  if (!host || host === ownHost.replace(/^www\./, '')) return 'direct';
  const is = (...domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));
  if (is('claude.ai', 'chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'gemini.google.com', 'copilot.microsoft.com')) return 'ai';
  if (is('google.com', 'bing.com', 'duckduckgo.com', 'search.yahoo.com', 'ecosia.org', 'search.brave.com') || /^google\.[a-z.]+$/.test(host)) return 'search';
  if (is('reddit.com')) return 'reddit';
  if (is('x.com', 'twitter.com', 't.co')) return 'x';
  if (is('linkedin.com', 'lnkd.in')) return 'linkedin';
  if (is('facebook.com', 'instagram.com', 'threads.net')) return 'meta';
  if (is('news.ycombinator.com')) return 'hackernews';
  return 'other';
}

// Some counts are once per visit (a browser tab's session).
export function trackOncePerVisit(key: string, event: WebEvent): void {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Without session storage, count anyway; at worst a visit counts twice.
  }
  track(event);
}

// Once, before the first render. Marks this browser internal if the URL asks
// (then tidies the URL), counts where the visit came from, and starts Vercel's page-view counting, which drops
// every view while counting is off.
export function initAnalytics(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('internal') === '1') {
    writeFlag(INTERNAL_KEY, true);
    params.delete('internal');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  // Where this visit came from, counted once; utm_ tags are then taken out of
  // the address so they aren't copied along with a link.
  trackOncePerVisit('cco:visitCounted', { event: 'visit', source: visitSource(window.location.search, document.referrer, window.location.hostname) });
  if ([...params.keys()].some((k) => k.startsWith('utm_'))) {
    for (const k of [...params.keys()]) if (k.startsWith('utm_')) params.delete(k);
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  if (!import.meta.env.PROD) return;
  inject({ beforeSend: (event) => (countingOff() ? null : event) });
}
