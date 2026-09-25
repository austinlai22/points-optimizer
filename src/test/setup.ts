import { afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// AnimatedNumber counts up via requestAnimationFrame unless the user prefers
// reduced motion, which would make any figure it renders a moving target
// mid-assertion. Reporting reduced motion pins it to the final value — and
// exercises a path real users with that preference actually get.
beforeEach(() => {
  if (typeof window === 'undefined') return;
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

// This file runs for EVERY test, including the logic-layer suites that stay in
// the fast node environment and never touch a DOM. Guarding on `document`
// keeps those suites from paying for — or tripping over — DOM teardown they
// don't need. Component files opt into jsdom with a
// `// @vitest-environment jsdom` docblock.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  // Component state persists to localStorage, so without this a test's
  // balances, ownership and basis would leak into the next one.
  try {
    localStorage.clear();
  } catch {
    // Unavailable in some environments; nothing to clear if so.
  }
});
