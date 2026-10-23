// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TripOptimizerView } from './TripOptimizerView';
import { CardBalancesProvider } from '../context/CardBalancesContext';

// The verdict is the headline of this view now, so these drive the real view
// the way someone would: type a trip and a cash cushion, read the verdict.

function renderView({
  owned = { csr: true } as Record<string, boolean>,
  balances = { csr: 200_000 } as Record<string, number>,
} = {}) {
  window.history.replaceState(null, '', '/app');
  localStorage.setItem('cco:ownership', JSON.stringify(owned));
  localStorage.setItem('cco:balances', JSON.stringify(balances));
  return render(
    <CardBalancesProvider>
      <TripOptimizerView />
    </CardBalancesProvider>,
  );
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function verdictCard() {
  return within(document.getElementById('verdict-heading')!.closest('section')!);
}

describe('TripOptimizerView verdict', () => {
  it('asks for the cash cushion before giving a verdict', () => {
    renderView();
    type(/trip cash price/i, '1000');
    expect(document.getElementById('verdict-heading')).toBeNull();
    expect(screen.getByText(/add your cash position to see it/i)).toBeInTheDocument();
  });

  it('says pay cash and keep points when cash is healthy and points only match their value', () => {
    renderView();
    type(/trip cash price/i, '1000');
    type(/cash for travel now/i, '10000');
    type(/left over each month/i, '500');
    type(/monthly spending/i, '2000');
    expect(verdictCard().getByRole('heading', { name: 'Pay cash' })).toBeInTheDocument();
    expect(verdictCard().getByText(/If Chase Travel shows this trip at or below 83,333 points/)).toBeInTheDocument();
  });

  it('accepts a negative monthly leftover and protects strained cash with points', () => {
    renderView();
    type(/trip cash price/i, '1000');
    type(/cash for travel now/i, '3000');
    type(/left over each month/i, '-400');
    type(/monthly spending/i, '2000');
    expect(verdictCard().getByRole('heading', { name: 'Book in Chase Travel' })).toBeInTheDocument();
  });

  it('checks a pasted Chase Travel price', () => {
    renderView();
    type(/trip cash price/i, '1000');
    type(/cash for travel now/i, '10000');
    type(/left over each month/i, '500');
    type(/monthly spending/i, '2000');
    type(/chase travel price in points/i, '50000');
    expect(verdictCard().getByRole('heading', { name: 'Book in Chase Travel' })).toBeInTheDocument();
    expect(window.location.search).toContain('ct=50000');
  });

  it('keeps cash figures out of the share link', () => {
    renderView();
    type(/trip cash price/i, '1000');
    type(/cash for travel now/i, '12345');
    expect(window.location.search).toBe('?price=1000');
    expect(localStorage.getItem('cco:cash')).toContain('12345');
  });

  it('points a first-time visitor to Portfolio', () => {
    renderView({ owned: {}, balances: {} });
    expect(screen.getByText(/add the cards you hold/i)).toBeInTheDocument();
  });
});

describe('Chase Travel price check and sharing', () => {
  const priceCheck = () =>
    within(screen.getByRole('heading', { name: 'Seeing this trip in Chase Travel?' }).closest('section')!);

  function withRecommendation() {
    renderView();
    type(/trip cash price/i, '900');
    type(/cash for travel now/i, '10000');
    type(/left over each month/i, '500');
    type(/monthly spending/i, '2000');
  }

  it('asks for the Chase Travel price after the recommendation, and updates it', () => {
    withRecommendation();
    expect(screen.getByRole('heading', { name: 'Seeing this trip in Chase Travel?' })).toBeInTheDocument();
    type(/chase travel price in points/i, '45000');
    expect(verdictCard().getByRole('heading', { name: 'Book in Chase Travel' })).toBeInTheDocument();
    expect(priceCheck().getByText(/returns/)).toHaveTextContent('2¢');
  });

  it('leaves sharing off by default and sends nothing unless it is ticked', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    const box = screen.getByRole('checkbox', { name: /share this price anonymously/i });
    expect(box).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Share price' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('shares exactly the agreed fields once ticked and filled in', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(priceCheck().getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    type(/from \(airport code\)/i, 'jfk');
    type(/to \(airport code\)/i, 'lis');
    const month = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7);
    type(/travel month/i, month);
    fireEvent.click(screen.getByRole('button', { name: 'Share price' }));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/report');
    expect(JSON.parse(init!.body as string)).toEqual({
      card_type: 'reserve',
      booking_type: 'flight',
      origin: 'JFK',
      destination: 'LIS',
      travel_month: month,
      cabin: null,
      airline: null,
      hotel_chain: null,
      cash_price_usd: 900,
      chase_points_price: 45000,
      boost_shown: 'yes',
    });
    expect(await screen.findByText(/shared anonymously/)).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('will not share until the Points Boost question is answered', () => {
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    type(/from \(airport code\)/i, 'JFK');
    type(/to \(airport code\)/i, 'LIS');
    type(/travel month/i, new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7));
    expect(screen.getByRole('button', { name: 'Share price' })).toBeDisabled();
  });
});
