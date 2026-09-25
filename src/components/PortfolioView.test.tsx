// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioView } from './PortfolioView';
import { CardBalancesProvider } from '../context/CardBalancesContext';
import type { ValuationBasis } from '../types';

// ValueRangeBar receives its axis as a prop, so its own tests cannot prove the
// axis is stable — they supply a fixed one. The axis is computed here, in
// PortfolioView, and the bug worth guarding against lived here: it used to
// include the selected figure, so choosing potential transfer value grew the
// axis and slid every published figure leftward. These tests render the real
// view so that computation is actually exercised.

function renderPortfolio(basis: ValuationBasis, ownership: Record<string, boolean>, balances: Record<string, number>) {
  localStorage.setItem('cco:basis', basis);
  localStorage.setItem('cco:ownership', JSON.stringify(ownership));
  localStorage.setItem('cco:balances', JSON.stringify(balances));
  return render(
    <CardBalancesProvider>
      <PortfolioView />
    </CardBalancesProvider>,
  );
}

// The floor and guaranteed fills of one card, as percentages of the shared axis.
function publishedSegments(container: HTMLElement, cardId: string): number[] {
  const card = container.querySelector(`#balance-${cardId}`)?.closest('div.flex-col');
  if (!card) throw new Error(`no card found for ${cardId}`);
  return [...card.querySelectorAll<HTMLElement>('[style*="width"]')]
    .slice(0, 2)
    .map((el) => Math.round(parseFloat(el.style.width)));
}

describe('PortfolioView', () => {
  const owned = { venturex: true, csr: true };
  const balances = { venturex: 100_000, csr: 200_000 };

  it('keeps the axis fixed so published figures do not move when the basis changes', () => {
    const segmentsByBasis = (['cashBack', 'guaranteed', 'transfer'] as const).map((basis) => {
      const { container, unmount } = renderPortfolio(basis, owned, balances);
      const segments = publishedSegments(container, 'venturex');
      unmount();
      return segments;
    });

    // Identical at all three. If the axis were recomputed from the selected
    // figure, the potential-transfer case would shrink these noticeably.
    expect(segmentsByBasis[0]).toEqual(segmentsByBasis[1]);
    expect(segmentsByBasis[1]).toEqual(segmentsByBasis[2]);
  });

  it('scales every card against one shared axis, so bar length means dollars', () => {
    const { container } = renderPortfolio('guaranteed', owned, balances);
    // Total fill is floor plus the portal's extra on top of it.
    const filled = (cardId: string) =>
      publishedSegments(container, cardId).reduce((sum, pct) => sum + pct, 0);

    // Reserve is worth $2,000 guaranteed against Venture X's $1,000, so its
    // bar must be about twice as long. Before the shared axis each bar was
    // scaled to its own range and stretched to full width, so these two looked
    // identical despite one being worth double the other.
    expect(filled('csr') / filled('venturex')).toBeCloseTo(2, 1);
  });

  it('splits the fill at the cash-back floor, making the issuer gap visible', () => {
    const { container } = renderPortfolio('guaranteed', owned, balances);
    // Chase cashes out at the same 1c it books travel at, so there is nothing
    // between floor and guaranteed — one solid bar.
    const [, chaseExtra] = publishedSegments(container, 'csr');
    expect(chaseExtra).toBe(0);

    // Capital One cashes out at half its travel rate, so the two tones split
    // its bar evenly — the published difference, visible without reading a
    // number.
    const [capOneFloor, capOneExtra] = publishedSegments(container, 'venturex');
    expect(capOneFloor).toBeCloseTo(capOneExtra, 0);
  });

  it('starts with no cards claimed, so nobody inherits a portfolio they must dismantle', () => {
    localStorage.clear();
    render(
      <CardBalancesProvider>
        <PortfolioView />
      </CardBalancesProvider>,
    );
    const toggles = screen.getAllByRole('switch');
    expect(toggles.length).toBeGreaterThan(0);
    expect(toggles.every((t) => t.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('keeps a card the user has already claimed', () => {
    renderPortfolio('guaranteed', { csr: true }, { csr: 50_000 });
    expect(screen.getByText('Chase Sapphire Reserve')).toBeInTheDocument();
    const reserveToggle = document.getElementById('owned-csr');
    expect(reserveToggle?.getAttribute('aria-checked')).toBe('true');
  });
});
