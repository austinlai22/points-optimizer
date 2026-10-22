// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
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
  return within(screen.getByText('Recommendation').closest('section')!);
}

describe('TripOptimizerView verdict', () => {
  it('asks for the cash cushion before giving a verdict', () => {
    renderView();
    type(/trip cash price/i, '1000');
    expect(screen.queryByText('Recommendation')).toBeNull();
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
    type(/chase travel price you found/i, '50000');
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
