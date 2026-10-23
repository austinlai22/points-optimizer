// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { migrateLegacyToolLink } from './lib/router';

function visit(url: string) {
  window.history.replaceState(null, '', url);
  migrateLegacyToolLink();
  return render(<App />);
}

describe('routes', () => {
  it('shows the landing page at /', () => {
    visit('/');
    expect(screen.getByRole('heading', { level: 1, name: /points or cash/i })).toBeInTheDocument();
  });

  it("runs the landing page's worked example through the real engine", () => {
    visit('/');
    // The example is built so transferring wins; if the engine or data
    // changes so it doesn't, this is the test that says so.
    expect(screen.getByText(/^Transfer 60,000 Chase points to United MileagePlus/)).toBeInTheDocument();
  });

  it('goes from the landing page to the tool', () => {
    visit('/');
    fireEvent.click(screen.getAllByRole('link', { name: 'Check a trip' })[0]);
    expect(window.location.pathname).toBe('/app');
  });

  it('moves a pre-v2 share link on / to /app, keeping the trip', () => {
    visit('/?price=900&partner=hyatt');
    expect(window.location.pathname).toBe('/app');
    expect(window.location.search).toContain('price=900');
    expect(screen.getByRole('heading', { name: 'Check a trip' })).toBeInTheDocument();
  });

  it('shows the privacy page', () => {
    visit('/privacy');
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
  });

  it('mentions WhatsApp nowhere, since there is no WhatsApp version', () => {
    for (const url of ['/', '/app', '/portfolio', '/privacy']) {
      const { container, unmount } = visit(url);
      expect(container.textContent, url).not.toMatch(/whatsapp/i);
      unmount();
    }
  });

  it('gives Portfolio its own page', () => {
    visit('/portfolio');
    expect(screen.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeInTheDocument();
  });

  it('shows the same banner on every page', () => {
    for (const url of ['/', '/app', '/portfolio', '/privacy']) {
      const { unmount } = visit(url);
      const banner = screen.getByRole('banner');
      for (const name of ['How it works', 'FAQ', 'The numbers', 'Portfolio', 'Check a trip']) {
        expect(within(banner).getAllByRole('link', { name }).length, `${url}: ${name}`).toBeGreaterThan(0);
      }
      unmount();
    }
  });

  it('scrolls to a section on the same page without leaving it', () => {
    visit('/');
    const scrollTo = vi.spyOn(window, 'scrollTo');
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'FAQ' }));
    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('#faq');
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  it('goes home and to the section from another page', () => {
    visit('/portfolio');
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'The numbers' }));
    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('#numbers');
    expect(screen.getByRole('heading', { name: 'Where every figure comes from.' })).toBeInTheDocument();
  });

  it('sends an unknown path home', () => {
    visit('/nope');
    expect(window.location.pathname).toBe('/');
  });
});

describe('usage counting controls', () => {
  it('lets a visitor turn counting off from the privacy page', () => {
    visit('/privacy');
    const toggle = screen.getByRole('switch', { name: /count my visits anonymously/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(localStorage.getItem('cco:analyticsOptOut')).toBe('1');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('marks a browser internal from /?internal=1 and tidies the address', async () => {
    const { initAnalytics, isInternal } = await import('./utils/analytics');
    window.history.replaceState(null, '', '/?internal=1');
    initAnalytics();
    expect(isInternal()).toBe(true);
    expect(window.location.search).toBe('');
  });
});
