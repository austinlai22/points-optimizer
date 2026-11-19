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

  it("replaces the form's trip with a new one, even when its program isn't reachable", async () => {
    visit('/app?price=500&partner=united&points=40000&fees=50&ct=45000');
    fireEvent.change(screen.getByLabelText(/describe your trip/i), { target: { value: '$700 or 40k Delta miles' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' }));
    await waitFor(() => expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(700));
    // Nothing of the United trip stays.
    expect(screen.getByLabelText(/airline or hotel program/i)).toHaveValue('');
    expect(new URLSearchParams(window.location.search).toString()).toBe('price=700');
  });

  it('says what it read and flags figures that look off', async () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/describe your trip/i), { target: { value: '$900 cash or 6k United miles + $85' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' }));
    expect(await screen.findByText('6,000 United MileagePlus points + $85', { exact: false })).toBeInTheDocument();
    const warnings = within(screen.getByRole('list', { name: 'Worth checking' }));
    expect(warnings.getByText(/far above usual.*6,000 may be missing a zero/)).toBeInTheDocument();
  });
});

describe('asking PointCompass', () => {
  it('stays out of sight when the assistant is not set up', () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '900' } });
    expect(screen.queryByRole('button', { name: /ask pointcompass/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /explain this/i })).toBeNull();
  });

  it('runs the tools in the browser, changes the form only on Apply, and never sends balances', async () => {
    setServerAiEnabled(true);
    const replies = [
      { reply: { type: 'tool', tool: 'propose_trip', args: { trip_cash_price_usd: 700, program: 'united', award_points: 30000, based_on: '$700 or 30k United miles' } } },
      { reply: { type: 'tool', tool: 'propose_save_trip', args: { name: 'Lisbon in May', based_on: 'save it as Lisbon in May' } } },
      { reply: { type: 'answer', text: 'Transferring 30,000 Chase points to United beats paying cash. Tap Apply to fill it in.' } },
      { reply: { type: 'answer', text: 'Anything else?' } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));

    visit('/app');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '500' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Ask PointCompass' }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    fireEvent.change(panel.getByLabelText('Your question'), { target: { value: 'Set up $700 or 30k United miles and save it as Lisbon in May' } });
    fireEvent.click(panel.getByRole('button', { name: 'Ask' }));

    expect(await panel.findByText(/beats paying cash/)).toBeInTheDocument();
    expect(panel.getByText('Suggested a trip for the form')).toBeInTheDocument();
    // Suggested, not done.
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(500);
    const [tripCard, saveCard] = panel.getAllByRole('group', { name: 'Suggested change' });
    expect(within(tripCard).getByText('$700 cash, or 30,000 United MileagePlus points')).toBeInTheDocument();
    expect(within(tripCard).getByText(/based on what you told me: “\$700 or 30k united miles”/i)).toBeInTheDocument();

    fireEvent.click(within(tripCard).getByRole('button', { name: 'Apply' }));
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(700);
    expect(screen.getByLabelText(/airline or hotel program/i)).toHaveValue('united');
    expect(within(tripCard).getByText('Filled in the form')).toBeInTheDocument();

    fireEvent.click(within(saveCard).getByRole('button', { name: 'Dismiss' }));
    expect(within(saveCard).getByText('Dismissed')).toBeInTheDocument();
    expect(localStorage.getItem('cco:savedTrips') ?? '[]').not.toContain('Lisbon in May');

    // The next message tells the assistant what was applied.
    fireEvent.change(panel.getByLabelText('Your question'), { target: { value: 'Thanks' } });
    fireEvent.click(panel.getByRole('button', { name: 'Ask' }));
    expect(await panel.findByText('Anything else?')).toBeInTheDocument();

    const bodies = fetchSpy.mock.calls.map(([, init]) => String((init as RequestInit).body));
    expect(bodies).toHaveLength(4);
    expect(bodies[1]).toContain('TOOL_RESULT propose_trip');
    expect(bodies[3]).toMatch(/they applied “\$700 cash, or 30,000 United MileagePlus points”; dismissed “Save/);
    for (const body of bodies) {
      expect(body).not.toContain(String(BALANCE));
      expect(body).not.toContain('123,457');
    }
    fetchSpy.mockRestore();
  });

  it('keeps quick replies in view below a suggestion card', async () => {
    setServerAiEnabled(true);
    const replies = [
      { reply: { type: 'tool', tool: 'propose_trip', args: { trip_cash_price_usd: 700, program: 'united', award_points: 30000 } } },
      { reply: { type: 'answer', text: 'Tap Apply to fill it in. Save it too?', options: ['Yes, save it', 'No thanks'] } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));
    visit('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Ask PointCompass' }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    fireEvent.click(panel.getByRole('button', { name: /set up a \$900 trip/i }));
    expect(await panel.findByRole('group', { name: 'Suggested change' })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Yes, save it' })).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('tells the assistant what was applied even after a message fails', async () => {
    setServerAiEnabled(true);
    const replies: (object | null)[] = [
      { reply: { type: 'tool', tool: 'propose_trip', args: { trip_cash_price_usd: 700, program: 'united', award_points: 30000 } } },
      { reply: { type: 'answer', text: 'Tap Apply.' } },
      null,
      { reply: { type: 'answer', text: 'Noted.' } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const next = replies.shift();
      return next ? new Response(JSON.stringify(next), { status: 200 }) : new Response(JSON.stringify({ error: 'The assistant is busy right now.' }), { status: 429 });
    });
    visit('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Ask PointCompass' }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    const say = async (text: string) => {
      fireEvent.change(panel.getByLabelText('Your question'), { target: { value: text } });
      fireEvent.click(panel.getByRole('button', { name: 'Ask' }));
    };
    await say('Set up $700 or 30k United');
    fireEvent.click(await panel.findByRole('button', { name: 'Apply' }));
    await say('Thanks');
    expect(await panel.findByText('The assistant is busy right now.')).toBeInTheDocument();
    await say('Thanks again');
    expect(await panel.findByText('Noted.')).toBeInTheDocument();
    const last = JSON.parse(String((fetchSpy.mock.calls[3][1] as RequestInit).body)).messages as { role: string; text: string }[];
    expect(last.at(-1)!.text).toMatch(/^\(Since your last reply they applied “\$700 cash/);
    // The failed message isn't in the conversation.
    expect(last.map((m) => m.text)).not.toContain('Thanks');
    fetchSpy.mockRestore();
  });

  it("doesn't show a turned-down suggestion as made", async () => {
    setServerAiEnabled(true);
    const replies = [
      { reply: { type: 'tool', tool: 'propose_trip', args: { trip_cash_price_usd: 900, program: 'ana', award_points: 75000 } } },
      { reply: { type: 'answer', text: "None of your cards transfer to ANA." } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));
    visit('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Ask PointCompass' }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    fireEvent.change(panel.getByLabelText('Your question'), { target: { value: 'Tokyo with ANA, $900 or 75k' } });
    fireEvent.click(panel.getByRole('button', { name: 'Ask' }));
    expect(await panel.findByText(/transfer to ANA/)).toBeInTheDocument();
    expect(panel.getByText('Checked whether that change is possible')).toBeInTheDocument();
    expect(panel.queryByText('Suggested a trip for the form')).toBeNull();
    expect(panel.queryByRole('group', { name: 'Suggested change' })).toBeNull();
    fetchSpy.mockRestore();
  });

  it('offers quick replies that send themselves', async () => {
    setServerAiEnabled(true);
    const replies = [
      { reply: { type: 'answer', text: 'What does the trip cost in cash?', options: ['About $500', 'About $900'] } },
      { reply: { type: 'answer', text: 'Got it.' } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));
    visit('/app');
    fireEvent.click(await screen.findByRole('button', { name: 'Ask PointCompass' }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    fireEvent.click(panel.getByRole('button', { name: 'Should I use points for this trip?' }));
    fireEvent.click(await panel.findByRole('button', { name: 'About $900' }));
    expect(await panel.findByText('Got it.')).toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'About $900' })).toBeNull();
    expect(JSON.parse(String((fetchSpy.mock.calls[1][1] as RequestInit).body)).messages.at(-1).text).toBe('About $900');
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

describe('trips handed between PointCompass and Claude', () => {
  it('opens a trip from a link with it after "#"', () => {
    visit('/app#price=900&partner=united&points=60000&fees=85');
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(900);
    expect(screen.getByLabelText(/award price in points/i)).toHaveValue(60000);
  });

  it('copies saved trips as text for Claude, without balances', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    saveTrip('Lisbon', trip(600, { selectedPartnerId: 'united', pointsRequired: 30000, partnerPointsHeld: 7777 }));
    visit('/trips');
    fireEvent.click(screen.getByRole('button', { name: 'Copy my trips for Claude' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain('1. Lisbon: $600 cash, or 30,000 United MileagePlus points. Open in PointCompass: https://pointcompass.vercel.app/app#price=600&partner=united&points=30000');
    expect(text).not.toContain(String(BALANCE));
    expect(text).not.toContain('7777');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});

describe('what if', () => {
  it('is asked of the assistant, which runs it in the browser and leaves the Portfolio alone', async () => {
    setServerAiEnabled(true);
    localStorage.setItem('cco:balances', JSON.stringify({ csr: 10000 }));
    const replies = [
      { reply: { type: 'tool', tool: 'what_if', args: { extra_points: { chase: 20000 } } } },
      { reply: { type: 'answer', text: 'With 20,000 more Chase points, transferring to United would beat cash.' } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));
    visit('/app?price=900&partner=united&points=30000');
    // From the header, or the round button in the corner, hidden while the chat is open.
    expect(await screen.findByRole('button', { name: 'Ask PointCompass' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Ask PointCompass' }));
    const panel = within(screen.getByRole('dialog', { name: 'Ask PointCompass' }));
    expect(screen.queryByRole('button', { name: 'Open Ask PointCompass' })).toBeNull();
    fireEvent.click(panel.getByRole('button', { name: 'What if I had 20,000 more Chase points?' }));
    expect(await panel.findByText(/would beat cash/)).toBeInTheDocument();
    expect(panel.getByText('Tried a what-if with other cards or points')).toBeInTheDocument();
    const second = String((fetchSpy.mock.calls[1][1] as RequestInit).body);
    expect(second).toContain('TOOL_RESULT what_if');
    expect(second).not.toContain('10000');
    expect(JSON.parse(localStorage.getItem('cco:balances')!)).toMatchObject({ csr: 10000 });
    expect(screen.queryByText('What if…')).toBeNull();
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
    const section = within(screen.getByRole('heading', { name: /inside claude/i }).closest('section')!);
    expect(section.getByRole('link', { name: 'Set it up' })).toHaveAttribute('href', '/agents');
  });
});
