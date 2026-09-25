// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioSummary } from './PortfolioSummary';
import { CardBalancesProvider } from '../context/CardBalancesContext';
import cardsData from '../data/cards.json';
import transferPartnersData from '../data/transferPartners.json';
import type { CardConfig, TransferPartner, ValuationBasis } from '../types';

// Deliberately runs against the REAL card and partner data. The headline here
// and Trip Optimizer's cost are supposed to be the same per-point figure, and
// the one time they silently disagreed it was because each computed its own
// rate. Synthetic fixtures would not have caught that; the shipped numbers do.
const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

const reserve = cards.find((c) => c.id === 'csr')!;
const ventureX = cards.find((c) => c.id === 'venturex')!;

function renderSummary(basis: ValuationBasis, ownedCards: CardConfig[], balances: Record<string, number>) {
  localStorage.setItem('cco:basis', basis);
  return render(
    <CardBalancesProvider>
      <PortfolioSummary
        ownedCards={ownedCards}
        balances={balances}
        transferPartners={transferPartners}
      />
    </CardBalancesProvider>,
  );
}

// The big figure, read via its label so it is never confused with the
// floor/guaranteed pair shown beside it.
function headline(label: string): string {
  return screen.getByText(label).parentElement?.querySelector('p:nth-of-type(2)')?.textContent ?? '';
}

describe('PortfolioSummary', () => {
  describe('the headline follows the selected basis', () => {
    // 100,000 Capital One miles: 0.5c cash-out floor, 1c guaranteed,
    // 1.75c potential — the widest real spread of any issuer, so a basis that
    // failed to take effect would be obvious.
    const balances = { venturex: 100_000 };

    it('shows the cash-out total at the cash-back basis', () => {
      renderSummary('cashBack', [ventureX], balances);
      expect(headline('Total if cashed out')).toBe('$500');
    });

    it('shows the portal total at the guaranteed basis', () => {
      renderSummary('guaranteed', [ventureX], balances);
      expect(headline('Total portfolio value')).toBe('$1,000');
    });

    it('shows the estimate at the potential-transfer basis', () => {
      renderSummary('transfer', [ventureX], balances);
      expect(headline('Total at potential transfer value')).toBe('$1,750');
    });
  });

  it('always shows both published figures beside the headline, whatever the basis', () => {
    // The transfer ceiling used to sit here too. It is a flat multiple of the
    // guaranteed figure, so it said nothing a summary needed while giving an
    // estimate equal billing with two sourced numbers.
    renderSummary('transfer', [ventureX], { venturex: 100_000 });
    // Two matches each: the range label, and the basis button of the same
    // name — both legitimate, since the control names the same three figures.
    expect(screen.getAllByText('Cash-back floor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Guaranteed travel').length).toBeGreaterThan(0);
    expect(screen.queryByText('Transfer ceiling')).not.toBeInTheDocument();
  });

  it('breaks the total down by issuer', () => {
    renderSummary('guaranteed', [reserve, ventureX], { csr: 200_000, venturex: 100_000 });
    // Chase and Capital One both at 1c guaranteed; the other issuers are held
    // at zero and must still be listed rather than silently dropped.
    expect(screen.getByText('Chase').textContent).toContain('Chase');
    expect(screen.getByText('$2,000')).toBeInTheDocument();
    expect(screen.getByText('Bank of America')).toBeInTheDocument();
  });

  it('sums across issuers rather than showing only the largest', () => {
    renderSummary('guaranteed', [reserve, ventureX], { csr: 200_000, venturex: 100_000 });
    // $2,000 Chase + $1,000 Capital One.
    expect(headline('Total portfolio value')).toBe('$3,000');
  });

  it('reports zero for an empty portfolio rather than breaking', () => {
    renderSummary('guaranteed', [], {});
    expect(headline('Total portfolio value')).toBe('$0');
  });
});
