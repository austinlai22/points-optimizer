import { useEffect, useState, type MouseEvent } from 'react';

// Centsible's router, ported: pushState plus a popstate listener. A handful
// of routes doesn't justify react-router. Real paths rather than #hashes so
// pages are linkable and bookmarkable; vercel.json serves index.html for any
// path without a file behind it. Hashes are kept for in-page sections.

// Height of the sticky banner, so a section scrolled to isn't hidden under it.
const HEADER_OFFSET_PX = 80;
const SCROLL_DURATION_MS = 250;

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

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// A short eased scroll with a fixed duration. The browser's own smooth
// scrolling takes longer the further it travels, which feels slow on a long
// page; this always arrives in a quarter of a second.
function scrollToY(target: number, smooth: boolean): void {
  if (!smooth) {
    window.scrollTo(0, target);
    return;
  }
  const start = window.scrollY;
  const distance = target - start;
  let startTime: number | null = null;
  const step = (now: number) => {
    startTime ??= now;
    const t = Math.min((now - startTime) / SCROLL_DURATION_MS, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    window.scrollTo(0, start + distance * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Scrolls to the element with this id, below the banner. Returns false if it
// isn't on the page (yet).
export function scrollToSection(id: string, { smooth = true } = {}): boolean {
  const element = document.getElementById(id);
  if (!element) return false;
  const top = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;
  scrollToY(Math.max(top, 0), smooth && !prefersReducedMotion());
  return true;
}

// After a route change the target section renders a frame or two later, so
// keep looking for a short while before giving up.
function scrollWhenReady(id: string, attempts = 30): void {
  if (scrollToSection(id) || attempts <= 0) return;
  requestAnimationFrame(() => scrollWhenReady(id, attempts - 1));
}

// pushState doesn't fire popstate, so one is dispatched by hand to tell
// usePath. `replace` is for corrections the user shouldn't go Back to.
export function navigate(to: string, { replace = false } = {}): void {
  const url = new URL(to, window.location.origin);
  const targetPath = normalize(url.pathname);
  const target = targetPath + url.search + url.hash;
  const samePage = normalize(window.location.pathname) === targetPath;
  const sectionId = url.hash.slice(1);

  if (samePage && sectionId) {
    // A section on this page: no route change, just scroll to it.
    window.history[replace ? 'replaceState' : 'pushState'](null, '', target);
    scrollToSection(sectionId);
    return;
  }

  const current = normalize(window.location.pathname) + window.location.search + window.location.hash;
  if (current === target && !replace) {
    scrollToY(0, !prefersReducedMotion());
    return;
  }
  window.history[replace ? 'replaceState' : 'pushState'](null, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
  if (sectionId) scrollWhenReady(sectionId);
}

// onClick for an <a href> that should route client-side. The href stays real,
// so middle-click, copy-link and crawlers still work; only a plain left-click
// is intercepted.
export function linkHandler(to: string, after?: () => void) {
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
    after?.();
  };
}

// Trip links shared before v2 point at "/?price=...". The tool now lives at
// /app, so carry those along rather than dropping someone who followed an
// old link on the landing page.
const TOOL_PARAMS = ['price', 'partner', 'points', 'held', 'fees', 'basis', 'ct'];

export function migrateLegacyToolLink(): void {
  if (normalize(window.location.pathname) !== '/') return;
  const params = new URLSearchParams(window.location.search);
  if (TOOL_PARAMS.some((key) => params.has(key))) {
    window.history.replaceState(null, '', `/app${window.location.search}`);
  }
}
