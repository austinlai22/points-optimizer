// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('shows the privacy page, including how to delete WhatsApp data', () => {
    visit('/privacy');
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getAllByText(/RESET/).length).toBeGreaterThan(0);
  });

  it('sends an unknown path home', () => {
    visit('/nope');
    expect(window.location.pathname).toBe('/');
  });
});
