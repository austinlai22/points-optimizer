// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { COMPARE_KEY, MAX_COMPARE, SAVED_TRIPS_KEY, saveTrip, type TripInputs } from '../lib/trips';

const trip = (price: number, extra: Partial<TripInputs> = {}): TripInputs => ({
  tripCashPrice: price,
  selectedPartnerId: '',
  pointsRequired: 0,
  partnerPointsHeld: 0,
  awardCashFees: 0,
  chaseTravelPoints: 0,
  ...extra,
});

function visit(url: string) {
  window.history.replaceState(null, '', url);
  return render(<App />);
}

const compareSection = () => within(screen.getByRole('heading', { name: /^compare/i }).closest('section')!);
const card = (name: string) => screen.getByRole('checkbox', { name: `Compare ${name}` }).closest('li')!;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cco:ownership', JSON.stringify({ csr: true }));
  localStorage.setItem('cco:balances', JSON.stringify({ csr: 200_000 }));
  localStorage.setItem('cco:cash', JSON.stringify({ available: '10000', leftover: '500', spend: '2000' }));
});

describe('saving a trip', () => {
  it('saves from Check a trip, in this browser only, and shows it in My trips', () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /save this trip/i }));
    fireEvent.change(screen.getByLabelText(/name this trip/i), { target: { value: 'Lisbon in May' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText(/saved as “Lisbon in May”/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY)!)[0]).toMatchObject({ name: 'Lisbon in May', inputs: { tripCashPrice: 900 } });

    fireEvent.click(screen.getByRole('link', { name: /view my trips/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'My trips' })).toBeInTheDocument();
    expect(card('Lisbon in May')).toHaveTextContent('$900');
  });

  it('suggests a name, so saving takes one click and Enter', () => {
    visit('/app');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '450' } });
    fireEvent.click(screen.getByRole('button', { name: /save this trip/i }));
    fireEvent.submit(screen.getByLabelText(/name this trip/i));
    expect(JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY)!)[0].name).toBe('Trip, $450');
  });
});

describe('comparing saved trips', () => {
  beforeEach(() => {
    saveTrip('Lisbon', trip(900));
    saveTrip('Tokyo', trip(1800));
  });

  it('adds a trip when you click anywhere on its card, and removes it on a second click', () => {
    visit('/trips');
    fireEvent.click(within(card('Lisbon')).getByText('$900'));
    expect(screen.getByRole('checkbox', { name: 'Compare Lisbon' })).toBeChecked();
    expect(compareSection().getByRole('button', { name: 'Remove Lisbon from comparison' })).toBeInTheDocument();

    fireEvent.click(card('Lisbon'));
    expect(screen.getByRole('checkbox', { name: 'Compare Lisbon' })).not.toBeChecked();
    expect(compareSection().getByText(/drop trips here/i)).toBeInTheDocument();
  });

  it("doesn't select a trip when its Delete button is used, and asks before deleting", () => {
    visit('/trips');
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('checkbox', { name: 'Compare Tokyo' })).not.toBeChecked();
    expect(screen.getByText('Delete this trip?')).toBeInTheDocument();
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('checkbox', { name: 'Compare Tokyo' })).toBeNull();
  });

  it('accepts a trip dragged into the comparison', () => {
    visit('/trips');
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? '',
      get types() {
        return [...data.keys()];
      },
      effectAllowed: '',
      dropEffect: '',
    };
    fireEvent.dragStart(card('Tokyo'), { dataTransfer });
    const zone = screen.getByRole('heading', { name: /^compare/i }).closest('section')!;
    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.drop(zone, { dataTransfer });
    expect(screen.getByRole('checkbox', { name: 'Compare Tokyo' })).toBeChecked();
  });

  it(`shows recommendations side by side, up to ${MAX_COMPARE} trips`, () => {
    for (let i = 0; i < MAX_COMPARE; i++) saveTrip(`Trip ${i}`, trip(500 + i * 100));
    visit('/trips');
    for (let i = 0; i < MAX_COMPARE; i++) fireEvent.click(card(`Trip ${i}`));
    expect(compareSection().getAllByRole('button', { name: /^Remove .* from comparison$/ })).toHaveLength(MAX_COMPARE);
    expect(compareSection().queryByText(/drag or click a trip to add it/i)).toBeNull();
    expect(compareSection().getAllByText('Pay cash').length).toBeGreaterThan(0);

    fireEvent.click(card('Lisbon'));
    expect(screen.getByRole('checkbox', { name: 'Compare Lisbon' })).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(`up to ${MAX_COMPARE} trips`);
  });

  it('marks where each trip beats the others', () => {
    visit('/trips');
    fireEvent.click(card('Lisbon'));
    fireEvent.click(card('Tokyo'));
    const lisbon = compareSection().getByText('Lowest cash price').closest('div')!;
    expect(lisbon).toHaveTextContent('$900');
    // Both book in Chase Travel at the same rate, so neither wins on value.
    expect(compareSection().queryByText('Highest value per point')).toBeNull();
    expect(compareSection().getByText('Fewest points')).toBeInTheDocument();
    expect(compareSection().getByText('Wins on 2 of 3')).toBeInTheDocument();
  });

  it('shows what points would get even when the recommendation is to pay cash', () => {
    visit('/trips');
    fireEvent.click(card('Lisbon'));
    expect(compareSection().getByText('Pay cash')).toBeInTheDocument();
    expect(compareSection().getByText('Book in Chase Travel')).toBeInTheDocument();
    expect(compareSection().getByText('1¢')).toBeInTheDocument();
  });

  it('opens a saved trip back in Check a trip', () => {
    visit('/trips');
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: 'Open' }));
    expect(window.location.pathname).toBe('/app');
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(1800);
  });

  it('keeps the comparison across visits', () => {
    visit('/trips').unmount();
    localStorage.setItem(COMPARE_KEY, JSON.stringify([JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY)!)[0].id]));
    act(() => window.dispatchEvent(new Event('cco:savedTripsChange')));
    visit('/trips');
    expect(screen.getByRole('checkbox', { name: 'Compare Tokyo' })).toBeChecked();
  });
});

describe('header', () => {
  it('sets Portfolio and My trips apart as the tools, with counts', () => {
    saveTrip('Lisbon', trip(900));
    visit('/');
    const tools = screen.getByRole('navigation', { name: 'Your tools' });
    expect(within(tools).getByRole('link', { name: /Portfolio\s*1/ })).toHaveAttribute('href', '/portfolio');
    expect(within(tools).getByRole('link', { name: /My trips\s*1/ })).toHaveAttribute('href', '/trips');
    expect(within(screen.getByRole('navigation', { name: 'About PointCompass' })).queryByRole('link', { name: /portfolio/i })).toBeNull();
  });
});
