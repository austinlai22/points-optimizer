// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { setServerAiEnabled } from '../lib/ai/client';
import { saveTrip, type TripInputs } from '../lib/trips';

// An odd balance, so it would stand out in anything sent to the AI.
const BALANCE = 123_457;

function visit(url: string) {
  window.history.replaceState(null, '', url);
  return render(<App />);
}

const trip = (price: number, extra: Partial<TripInputs> = {}): TripInputs => ({
  tripCashPrice: price,
  selectedPartnerId: '',
  pointsRequired: 0,
  partnerPointsHeld: 0,
  awardCashFees: 0,
  chaseTravelPoints: 0,
  ...extra,
});

beforeEach(() => {
  localStorage.setItem('cco:ownership', JSON.stringify({ csr: true }));
  localStorage.setItem('cco:balances', JSON.stringify({ csr: BALANCE }));
});

describe('describing a trip in your own words', () => {
  it('fills in the form, without AI when none is available, and says so', async () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/describe your trip/i), { target: { value: '$900 cash or 60k United miles + $85' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' }));
    await waitFor(() => expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(900));
    expect(screen.getByLabelText(/airline or hotel program/i)).toHaveValue('united');
    expect(screen.getByLabelText(/award price in points/i)).toHaveValue(60000);
    expect(screen.getByLabelText(/taxes and fees on the award/i)).toHaveValue(85);
    expect(screen.getByText(/read without ai/i)).toBeInTheDocument();
  });

  it('leaves out an award with a program none of your cards reach', async () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/describe your trip/i), { target: { value: '$700 or 40k Delta miles' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' }));
    await waitFor(() => expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(700));
    expect(screen.getByText(/none of your cards in portfolio transfer to delta skymiles/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/airline or hotel program/i)).toHaveValue('');
  });
});

describe('asking PointCompass', () => {
  it('stays out of sight when the assistant is not set up', () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '900' } });
    expect(screen.queryByRole('button', { name: /ask pointcompass/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /explain this/i })).toBeNull();
  });

  it('runs the tools in the browser, fills in the form, and never sends balances', async () => {
    setServerAiEnabled(true);
    const replies = [
      { reply: { type: 'tool', tool: 'fill_trip_form', args: { trip_cash_price_usd: 700, program: 'united', award_points: 30000 } } },
      { reply: { type: 'answer', text: 'Done: transferring 30,000 Chase points to United beats paying cash.' } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));

    visit('/app');
    fireEvent.click(await screen.findByRole('button', { name: /ask pointcompass/i }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    fireEvent.change(panel.getByLabelText('Your question'), { target: { value: 'Set up $700 or 30k United miles' } });
    fireEvent.click(panel.getByRole('button', { name: 'Ask' }));

    expect(await panel.findByText(/beats paying cash/)).toBeInTheDocument();
    expect(panel.getByText('Filled in the trip form')).toBeInTheDocument();
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(700);
    expect(screen.getByLabelText(/airline or hotel program/i)).toHaveValue('united');

    const bodies = fetchSpy.mock.calls.map(([, init]) => String((init as RequestInit).body));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toContain('TOOL_RESULT fill_trip_form');
    for (const body of bodies) {
      expect(body).not.toContain(String(BALANCE));
      expect(body).not.toContain('123,457');
    }
    fetchSpy.mockRestore();
  });

  it('explains the recommendation on the page when asked', async () => {
    setServerAiEnabled(true);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({ reply: { type: 'answer', text: 'Because the points only match their usual value.' } }), { status: 200 }));
    visit('/app');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '900' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Explain this' }));
    expect(await screen.findByText(/only match their usual value/)).toBeInTheDocument();
    const first = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(first.messages[0].text).toMatch(/^Explain why PointCompass recommends “Pay cash”/);
    fetchSpy.mockRestore();
  });
});

describe('planning points across saved trips', () => {
  it('shows where points save the most within your balance', () => {
    localStorage.setItem('cco:balances', JSON.stringify({ csr: 60000 }));
    saveTrip('Lisbon', trip(600, { selectedPartnerId: 'united', pointsRequired: 30000 }));
    saveTrip('Tokyo', trip(1500, { selectedPartnerId: 'united', pointsRequired: 60000 }));
    visit('/trips');
    const plan = within(screen.getByRole('heading', { name: 'Plan your points' }).closest('section')!);
    expect(plan.getByText('Saves $900 in all')).toBeInTheDocument();
    expect(plan.getByText('Pay cash')).toBeInTheDocument();
    expect(plan.getByText('60,000 of 60,000 Chase points')).toBeInTheDocument();
  });
});

describe('home page', () => {
  it('shows how to use PointCompass from an AI assistant', () => {
    visit('/');
    const section = within(screen.getByRole('heading', { name: /ask claude/i }).closest('section')!);
    expect(section.getByRole('link', { name: 'Set it up' })).toHaveAttribute('href', '/agents');
  });
});
