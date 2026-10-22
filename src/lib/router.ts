import { useEffect, useState, type MouseEvent } from 'react';

// Centsible's router, ported: pushState plus a popstate listener. Three
// routes (/, /app, /privacy) don't justify react-router. Real paths rather
// than #hashes so /app is linkable and bookmarkable; vercel.json serves
// index.html for any path without a file behind it.

export function normalize(path: string): string {
  const trimmed = (path || '/').replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

// Current pathname, re-rendering on back/forward and on navigate().
export function usePath(): string {
  const [path, setPath] = useState(() => normalize(window.location.pathname));
  useEffect(() => {
    const onPop = () => setPath(normalize(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

// pushState doesn't fire popstate, so one is dispatched by hand to tell
// usePath. `replace` is for corrections the user shouldn't go Back to.
export function navigate(to: string, { replace = false } = {}): void {
  const url = new URL(to, window.location.origin);
  const target = normalize(url.pathname) + url.search + url.hash;
  const current = normalize(window.location.pathname) + window.location.search + window.location.hash;
  if (current === target && !replace) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!url.hash) window.scrollTo(0, 0);
}

// onClick for an <a href> that should route client-side. The href stays real,
// so middle-click, copy-link and crawlers still work; only a plain left-click
// is intercepted.
export function linkHandler(to: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
}

// Trip Optimizer links shared before v2 point at "/?price=...". The tool now
// lives at /app, so carry those along rather than dropping someone who
// followed an old link on the landing page.
const TOOL_PARAMS = ['price', 'partner', 'points', 'held', 'fees', 'basis', 'ct'];

export function migrateLegacyToolLink(): void {
  if (normalize(window.location.pathname) !== '/') return;
  const params = new URLSearchParams(window.location.search);
  if (TOOL_PARAMS.some((key) => params.has(key))) {
    window.history.replaceState(null, '', `/app${window.location.search}`);
  }
}
