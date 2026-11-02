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

// Taps the year, then the month, in the travel month picker.
function pickMonth(yyyyMm: string) {
  const picker = within(screen.getByRole('group', { name: /travel month/i }));
  fireEvent.click(picker.getByRole('button', { name: yyyyMm.slice(0, 4) }));
  const name = new Date(`${yyyyMm}-15`).toLocaleString('en-US', { month: 'long' });
  fireEvent.click(picker.getByRole('button', { name: `${name} ${yyyyMm.slice(0, 4)}` }));
}

function verdictCard() {
  return within(document.getElementById('verdict-heading')!.closest('section')!);
}

describe('TripOptimizerView verdict', () => {
  it('gives a value-only recommendation without a cash position, and says so', () => {
    renderView();
    expect(screen.getByText(/add the trip price to see it/i)).toBeInTheDocument();
    type(/trip cash price/i, '1000');
    expect(verdictCard().getByRole('heading', { name: 'Pay cash' })).toBeInTheDocument();
    expect(verdictCard().getByText(/on value alone/i)).toBeInTheDocument();
    expect(verdictCard().getByText(/no cash position was given/i, { selector: 'li' })).toBeInTheDocument();
  });

  it('treats the June 23, 2025 question as optional, and says so when it is skipped', () => {
    renderView();
    type(/trip cash price/i, '1000');
    const group = screen.getByRole('group', { name: /applied before june 23, 2025\? \(optional\)/i });
    expect(verdictCard().getByText(/legacy rate isn't counted/i, { selector: 'li' })).toBeInTheDocument();

    const yes = within(group).getByRole('button', { name: 'Yes' });
    fireEvent.click(yes);
    expect(yes).toHaveAttribute('aria-pressed', 'true');
    expect(verdictCard().queryByText(/legacy rate isn't counted/i, { selector: 'li' })).toBeNull();
    // Tapping it again clears the answer.
    fireEvent.click(yes);
    expect(yes).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("folds Chase Travel details away for a program Chase doesn't transfer to, and keeps Chase Travel in the answer", () => {
    renderView({ owned: { csr: true, citistratapremier: true }, balances: { csr: 200_000, citistratapremier: 100_000 } });
    type(/trip cash price/i, '500');
    expect(screen.getByLabelText(/chase card your points are on/i)).toBeInTheDocument();

    type(/airline or hotel program/i, 'aa');
    expect(screen.queryByLabelText(/chase card your points are on/i)).toBeNull();
    expect(screen.getByText(/chase doesn't transfer to american airlines aadvantage/i)).toBeInTheDocument();
    expect(verdictCard().getAllByText(/chase travel/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /add chase travel details/i }));
    expect(screen.getByLabelText(/chase card your points are on/i)).toBeInTheDocument();

    // A Chase partner keeps it open.
    type(/airline or hotel program/i, 'united');
    expect(screen.getByLabelText(/chase card your points are on/i)).toBeInTheDocument();
  });

  it('puts the optional cash position after the trip and Chase Travel', () => {
    renderView();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('Your cash position (optional)')).toBeGreaterThan(headings.indexOf('Chase Travel'));
    expect(headings.indexOf('Chase Travel')).toBeGreaterThan(headings.indexOf('The trip'));
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
    fireEvent.click(screen.getByRole('button', { name: 'One way' }));
    type(/^from$/i, 'jfk');
    type(/^to$/i, 'lis');
    const month = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7);
    pickMonth(month);
    fireEvent.click(screen.getByRole('button', { name: 'Share price' }));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/report');
    expect(JSON.parse(init!.body as string)).toEqual({
      card_type: 'reserve',
      booking_type: 'flight',
      origin: 'JFK',
      destination: 'LIS',
      trip_type: 'one_way',
      travel_month: month,
      travel_date: null,
      cabin: null,
      airline: null,
      fare: null,
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
    fireEvent.click(screen.getByRole('button', { name: 'One way' }));
    type(/^from$/i, 'JFK');
    type(/^to$/i, 'LIS');
    pickMonth(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7));
    expect(screen.getByRole('button', { name: 'Share price' })).toBeDisabled();
  });

  const nextMonth = () => new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 7);
  const sentBodies = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

  it('fills in the airline from step 1 and offers its own fares', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    withRecommendation();
    type(/airline or hotel program/i, 'southwest');
    type(/chase travel price in points/i, '45000');
    fireEvent.click(priceCheck().getByRole('button', { name: 'No' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    fireEvent.click(screen.getByRole('button', { name: 'One way' }));

    expect(screen.getByLabelText(/^airline \(optional\)/i)).toHaveValue('WN');
    expect(screen.getByRole('button', { name: 'Flight' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Choice Preferred' }));
    expect(screen.getByText(/counted as economy/i)).toBeInTheDocument();

    type(/^from$/i, 'SFO');
    type(/^to$/i, 'LGA');
    pickMonth(nextMonth());
    fireEvent.click(screen.getByRole('button', { name: 'Share price' }));
    expect(sentBodies(fetchSpy)[0]).toMatchObject({ airline: 'WN', fare: 'choice_preferred', cabin: null });
    await screen.findByText(/shared anonymously/);
    fetchSpy.mockRestore();
  });

  it('switches to the cabins for an airline without a fare list', () => {
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    type(/^airline \(optional\)/i, 'DL');
    expect(screen.getByRole('button', { name: 'Main Classic' })).toBeInTheDocument();
    // A fare missing from Delta's list: the shared cabins instead.
    expect(screen.queryByRole('button', { name: 'Premium economy' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Other fare' }));
    expect(screen.getByRole('button', { name: 'Premium economy' })).toBeInTheDocument();
    type(/^airline \(optional\)/i, 'JL');
    expect(screen.queryByRole('button', { name: 'Main Classic' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Other fare' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Premium economy' })).toBeInTheDocument();
  });

  it('will not share a flight until it says one way or round trip', () => {
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(priceCheck().getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    type(/^from$/i, 'JFK');
    type(/^to$/i, 'LIS');
    pickMonth(nextMonth());
    expect(screen.getByRole('button', { name: 'Share price' })).toBeDisabled();
    expect(screen.getByText(/choose one way or round trip/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Round trip' }));
    expect(screen.getByRole('button', { name: 'Share price' })).toBeEnabled();
    expect(screen.getByText(/fare for the first flight/i)).toBeInTheDocument();
  });

  it('fills in hotel and the chain from a hotel program in step 1', () => {
    withRecommendation();
    type(/airline or hotel program/i, 'hyatt');
    type(/chase travel price in points/i, '45000');
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    expect(screen.getByRole('button', { name: 'Hotel' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/hotel chain/i)).toHaveValue('hyatt');
  });

  it('finds the airport code from a city name', async () => {
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    const from = screen.getByLabelText(/^from$/i);
    fireEvent.focus(from);
    fireEvent.change(from, { target: { value: 'san francisco' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /^SFO/ }));
    expect(from).toHaveValue('San Francisco · San Francisco International Airport (SFO)');
  });

  it('offers a travel day once the month is picked, and sends the date', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(priceCheck().getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    expect(screen.queryByLabelText(/travel day/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'One way' }));
    type(/^from$/i, 'SFO');
    type(/^to$/i, 'LGA');
    pickMonth(nextMonth());
    type(/travel day/i, '14');
    fireEvent.click(screen.getByRole('button', { name: 'Share price' }));
    expect(sentBodies(fetchSpy)[0]).toMatchObject({ travel_month: nextMonth(), travel_date: `${nextMonth()}-14` });
    await screen.findByText(/shared anonymously/);
    fetchSpy.mockRestore();
  });

  it('shares another fare for the same trip without retyping it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(priceCheck().getByRole('button', { name: 'No' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    fireEvent.click(screen.getByRole('button', { name: 'One way' }));
    type(/^from$/i, 'SFO');
    type(/^to$/i, 'LGA');
    pickMonth(nextMonth());
    type(/^airline \(optional\)/i, 'DL');
    fireEvent.click(screen.getByRole('button', { name: 'Main Basic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share price' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Share another fare for this trip' }));
    type(/^cash price$/i, '562');
    type(/^price in points$/i, '48818');
    const boost = within(screen.getByRole('group', { name: /points boost offer shown/i }));
    fireEvent.click(boost.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main Classic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share price' }));

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const [first, second] = sentBodies(fetchSpy);
    expect(second).toEqual({
      ...first,
      fare: 'main_classic',
      cash_price_usd: 562,
      chase_points_price: 48818,
      boost_shown: 'yes',
    });
    // The recommendation above still uses the trip's own price.
    expect(screen.getByLabelText(/chase travel price in points/i)).toHaveValue(45000);
    fetchSpy.mockRestore();
  });

  it('offers this month through 18 months ahead, one tap each', () => {
    withRecommendation();
    type(/chase travel price in points/i, '45000');
    fireEvent.click(screen.getByRole('checkbox', { name: /share this price anonymously/i }));
    const picker = within(screen.getByRole('group', { name: /travel month/i }));
    const now = new Date();
    const thisMonth = now.toLocaleString('en-US', { month: 'long' });
    expect(picker.getByRole('button', { name: `${thisMonth} ${now.getFullYear()}` })).toBeEnabled();
    if (now.getMonth() > 0) {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toLocaleString('en-US', { month: 'long' });
      expect(picker.getByRole('button', { name: `${lastMonth} ${now.getFullYear()}` })).toBeDisabled();
    }
    pickMonth(nextMonth());
    const picked = new Date(`${nextMonth()}-15`).toLocaleString('en-US', { month: 'long' });
    expect(picker.getByRole('button', { name: `${picked} ${nextMonth().slice(0, 4)}` })).toHaveAttribute('aria-pressed', 'true');
  });
});
