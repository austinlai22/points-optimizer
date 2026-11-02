// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { COMPARE_KEY, EDITING_KEY, MAX_COMPARE, SAVED_TRIPS_KEY, saveTrip, type TripInputs } from '../lib/trips';

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

function cleanupAndVisit(url: string) {
  cleanup();
  return visit(url);
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
    expect(JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY)!)[0]).toMatchObject({
      name: 'Lisbon in May',
      inputs: { tripCashPrice: 900 },
      snapshot: { headline: 'Pay cash', option: { title: 'Book in Chase Travel' } },
    });

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
    // Both save $0 at 1¢ a point in Chase Travel, so nobody wins on that either.
    expect(compareSection().queryByText('Most saved')).toBeNull();
    expect(compareSection().getByText('Wins on 2 of 4')).toBeInTheDocument();
  });

  it('weighs the cash still due: dollars saved, and the cash shown beside the points', () => {
    // Two ways to fly the same $702 trip.
    saveTrip('Option 1', trip(702, { selectedPartnerId: 'united', pointsRequired: 25000, awardCashFees: 121.5 }));
    saveTrip('Option 2', trip(702, { selectedPartnerId: 'united', pointsRequired: 35000, awardCashFees: 51.2 }));
    visit('/trips');
    fireEvent.click(card('Option 1'));
    fireEvent.click(card('Option 2'));
    const section = compareSection();

    // Value per point already nets out the cash: (702 - 121.50) / 25,000.
    expect(section.getByText('2.32¢')).toBeInTheDocument();
    expect(section.getByText('1.86¢')).toBeInTheDocument();
    expect(section.getByText('25,000 pts', { exact: false })).toHaveTextContent('25,000 pts + $121.50');
    expect(section.getByText('35,000 pts', { exact: false })).toHaveTextContent('35,000 pts + $51.20');
    // $702 - $121.50 - 25,000 points at 1¢.
    const saved = section.getByText('$330.50').closest('div')!;
    expect(within(saved).getByText('Most saved')).toBeInTheDocument();
    expect(section.getByText('$300.80')).toBeInTheDocument();
    expect(section.getAllByText(/points valued at 1¢ each/)).toHaveLength(2);
  });

  it('shows what points would get even when the recommendation is to pay cash', () => {
    visit('/trips');
    fireEvent.click(card('Lisbon'));
    expect(compareSection().getByText('Pay cash')).toBeInTheDocument();
    expect(compareSection().getByText('Book in Chase Travel')).toBeInTheDocument();
    expect(compareSection().getByText('1¢')).toBeInTheDocument();
  });

  it('works out value per point from the prices entered when no card can', () => {
    localStorage.setItem('cco:ownership', JSON.stringify({}));
    saveTrip('Hyatt stay', trip(600, { selectedPartnerId: 'hyatt', pointsRequired: 30000 }));
    visit('/trips');
    fireEvent.click(card('Hyatt stay'));
    expect(compareSection().getByText('2¢')).toBeInTheDocument();
    expect(compareSection().getByText(/from the prices you entered/i)).toBeInTheDocument();
    expect(compareSection().getByText('Transfer to World of Hyatt')).toBeInTheDocument();
  });

  it('converts an award to bank points with the transfer ratio of a bank you hold', () => {
    // Hilton is 2 points per Amex point: a 60,000-point award takes 30,000.
    // With no balance the card produces no option, so the fallback is used.
    localStorage.setItem('cco:ownership', JSON.stringify({ amexgold: true }));
    localStorage.setItem('cco:balances', JSON.stringify({}));
    saveTrip('Hilton stay', trip(600, { selectedPartnerId: 'hilton', pointsRequired: 60000 }));
    visit('/trips');
    fireEvent.click(card('Hilton stay'));
    expect(compareSection().getByText('2¢')).toBeInTheDocument();
    expect(compareSection().getByText('30,000 pts')).toBeInTheDocument();
  });

  it("shows value per partner point when banks' ratios differ and none is held, and doesn't rank it", () => {
    localStorage.setItem('cco:ownership', JSON.stringify({}));
    saveTrip('Hilton stay', trip(600, { selectedPartnerId: 'hilton', pointsRequired: 60000 }));
    saveTrip('Hyatt stay', trip(600, { selectedPartnerId: 'hyatt', pointsRequired: 50000 }));
    visit('/trips');
    fireEvent.click(card('Hilton stay'));
    fireEvent.click(card('Hyatt stay'));
    expect(compareSection().getByText('1¢')).toBeInTheDocument();
    expect(compareSection().getByText(/per Hilton Honors point/)).toBeInTheDocument();
    expect(compareSection().getByText('60,000 partner pts')).toBeInTheDocument();
    expect(compareSection().queryByText('Highest value per point')).toBeNull();
  });

  it('falls back to the recommendation saved with the trip', () => {
    localStorage.setItem('cco:ownership', JSON.stringify({}));
    localStorage.setItem(
      SAVED_TRIPS_KEY,
      JSON.stringify([
        {
          id: 'old',
          name: 'Saved elsewhere',
          savedOn: '2026-10-01',
          inputs: trip(900),
          snapshot: { headline: 'Transfer points', option: { title: 'Transfer to United MileagePlus', detail: 'from Chase', cppCents: 1.8, benchmarkRatio: 1.5, pointsUsed: 50000 } },
        },
      ]),
    );
    visit('/trips');
    fireEvent.click(card('Saved elsewhere'));
    expect(compareSection().getByText('Transfer points')).toBeInTheDocument();
    expect(compareSection().getByText(/as recommended when saved/i)).toBeInTheDocument();
    expect(compareSection().getByText('1.8¢')).toBeInTheDocument();
  });

  it('opens a saved trip back in Check a trip', () => {
    visit('/trips');
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: 'Open' }));
    expect(window.location.pathname).toBe('/app');
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(1800);
  });

  it('asks before replacing an unsaved trip in Check a trip, and can save it first', () => {
    localStorage.setItem('cco:tripOptimizer', JSON.stringify(trip(450)));
    localStorage.removeItem(EDITING_KEY);
    visit('/trips');
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: /open/i }));
    const dialog = screen.getByRole('alertdialog', { name: /replace the trip/i });
    expect(dialog).toHaveTextContent('unsaved $450 trip');
    expect(window.location.pathname).toBe('/trips');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save it first' }));
    expect(window.location.pathname).toBe('/app');
    expect(screen.getByLabelText(/trip cash price/i)).toHaveValue(1800);
    expect(JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY)!).map((t: { name: string }) => t.name)).toContain('Trip, $450');
  });

  it("doesn't ask when the trip in Check a trip is already saved", () => {
    localStorage.setItem('cco:tripOptimizer', JSON.stringify(trip(900)));
    visit('/trips');
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: /open/i }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(window.location.pathname).toBe('/app');
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

describe('editing a saved trip', () => {
  const stored = () => JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY)!) as { name: string; updatedOn: string | null; inputs: TripInputs }[];

  function openFromMyTrips(name: string) {
    visit('/trips');
    fireEvent.click(within(card(name)).getByRole('button', { name: /open/i }));
  }

  beforeEach(() => {
    saveTrip('Lisbon', trip(900));
    saveTrip('Tokyo', trip(1800));
  });

  it('updates the opened trip in place, keeping its name and adding no new trip', () => {
    openFromMyTrips('Lisbon');
    expect(screen.getByText(/saved as “Lisbon”/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '850' } });
    expect(screen.getByText('“Lisbon”')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /update trip/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Updated “Lisbon”');
    expect(stored()).toHaveLength(2);
    expect(stored().find((t) => t.name === 'Lisbon')).toMatchObject({ inputs: { tripCashPrice: 850 }, updatedOn: expect.any(String) });
  });

  it('can save the changed trip as a new one, leaving the original as it was', () => {
    openFromMyTrips('Lisbon');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '700' } });
    fireEvent.click(screen.getByRole('button', { name: /save as new trip/i }));
    fireEvent.change(screen.getByLabelText(/name the new trip/i), { target: { value: 'Lisbon, cheaper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(stored().map((t) => t.name)).toEqual(['Lisbon, cheaper', 'Tokyo', 'Lisbon']);
    expect(stored().find((t) => t.name === 'Lisbon')!.inputs.tripCashPrice).toBe(900);
    // Further changes now go to the new trip.
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '650' } });
    expect(screen.getByText('“Lisbon, cheaper”')).toBeInTheDocument();
  });

  it('shows when a card was last updated', () => {
    openFromMyTrips('Tokyo');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '1700' } });
    fireEvent.click(screen.getByRole('button', { name: /update trip/i }));
    fireEvent.click(screen.getByRole('link', { name: /view my trips/i }));
    expect(card('Tokyo')).toHaveTextContent(/Updated/);
    expect(card('Tokyo')).toHaveTextContent('$1,700');
  });

  it('offers to update, not save as new, when changes would be lost', () => {
    openFromMyTrips('Lisbon');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '800' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Your tools' })).getByRole('link', { name: /my trips/i }));
    fireEvent.click(within(card('Tokyo')).getByRole('button', { name: /open/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('unsaved changes to “Lisbon”');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update it first' }));
    expect(stored()).toHaveLength(2);
    expect(stored().find((t) => t.name === 'Lisbon')!.inputs.tripCashPrice).toBe(800);
  });

  it("stops editing when someone else's trip link is opened", () => {
    openFromMyTrips('Lisbon');
    cleanupAndVisit('/app?price=333');
    expect(screen.getByRole('button', { name: /save this trip/i })).toBeInTheDocument();
    expect(screen.queryByText('“Lisbon”')).toBeNull();
  });

  it('keeps editing across a reload of your own page', () => {
    openFromMyTrips('Lisbon');
    fireEvent.change(screen.getByLabelText(/trip cash price/i), { target: { value: '875' } });
    cleanupAndVisit(`/app${window.location.search}`);
    expect(screen.getByRole('button', { name: /update trip/i })).toBeInTheDocument();
  });
});

