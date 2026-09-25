// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValueRangeBar } from './ValueRangeBar';
import { CardBalancesProvider } from '../context/CardBalancesContext';
import type { CardValuation, ValuationBasis } from '../types';

// This component's bugs were all geometric, and every one was caught by eye
// rather than by a test: a marker hanging half off the track at 0% and 100%,
// an axis that rescaled when the basis changed so published figures slid
// sideways, and labels pinned to the bar's ends that claimed a position the
// fill contradicted. So these assertions are about the geometry, not just the
// text — that is where this component actually goes wrong.

const valuation: CardValuation = {
  floor: 600,
  marker: 1200,
  ceiling: 2100,
  isFixedValue: false,
  isPooled: false,
  pooledViaCard: null,
};

function renderBar(basis: ValuationBasis, axisMax = 2100, v: CardValuation = valuation) {
  // The provider reads the basis from storage on mount, which is how a real
  // session restores it — so seeding storage sets the basis without the test
  // reaching into component internals.
  localStorage.setItem('cco:basis', basis);
  return render(
    <CardBalancesProvider>
      <ValueRangeBar valuation={v} axisMax={axisMax} />
    </CardBalancesProvider>,
  );
}

// The three fills, in order: floor, the portal's guaranteed extra, the estimate.
function segmentWidths(container: HTMLElement): number[] {
  return [...container.querySelectorAll<HTMLElement>('[style*="width"]')].map((el) =>
    Math.round(parseFloat(el.style.width)),
  );
}

// Matching on [style*="left"] would hit a segment's margin-left first, so
// select on the marker's own offset syntax instead.
function markerLeft(container: HTMLElement): string {
  const marker = [...container.querySelectorAll<HTMLElement>('[style]')].find(
    (el) => el.style.left !== '',
  );
  return marker?.style.left ?? '';
}

// The marker's offset is `calc(<pct>% + <inset>rem)`; this is the percentage.
function markerPercent(container: HTMLElement): number {
  return Math.round(parseFloat(markerLeft(container).replace('calc(', '')));
}

// The figure inside the highlighted box, scoped by its label — the same
// amount can also appear in the legend, so a bare text query is ambiguous.
function highlightedValue(label: string): string {
  return screen.getByText(label).parentElement?.querySelector('p:last-child')?.textContent ?? '';
}

describe('ValueRangeBar', () => {
  it('fills each segment in proportion to the shared axis', () => {
    const { container } = renderBar('guaranteed');
    // $600 and $1,200 against a $2,100 axis: 29% then another 29%, with the
    // estimate absent at this basis.
    expect(segmentWidths(container)).toEqual([29, 29, 0]);
  });

  it('shows both published figures as a legend', () => {
    renderBar('guaranteed');
    expect(screen.getByText('$600')).toBeInTheDocument();
    expect(screen.getByText('floor')).toBeInTheDocument();
    expect(screen.getByText('guaranteed')).toBeInTheDocument();
  });

  describe('the axis never moves when the basis does', () => {
    // The regression that prompted these tests: the axis used to include the
    // selected figure, so choosing potential transfer value grew it and slid
    // the $600 floor from half-way along the bar to under a third of the way.
    // A published number appearing to move is how a chart loses trust.
    it('holds the published segments identical across all three bases', () => {
      const widths = (['cashBack', 'guaranteed', 'transfer'] as const).map((basis) => {
        const { container, unmount } = renderBar(basis);
        const w = segmentWidths(container);
        unmount();
        return w;
      });
      // First two segments — floor and guaranteed — identical every time.
      expect(widths.map((w) => w.slice(0, 2))).toEqual([
        [29, 29],
        [29, 29],
        [29, 29],
      ]);
    });

    it('grows only the estimate segment at the potential-transfer basis', () => {
      const { container } = renderBar('transfer');
      const [, , estimate] = segmentWidths(container);
      expect(estimate).toBe(43); // $1,200 -> $2,100 across a $2,100 axis
    });
  });

  describe('the marker', () => {
    it('sits at the selected figure for each basis', () => {
      // $600, $1,200 and $2,100 against a $2,100 axis.
      for (const [basis, expected] of [
        ['cashBack', 29],
        ['guaranteed', 57],
        ['transfer', 100],
      ] as const) {
        const { container, unmount } = renderBar(basis);
        expect(markerPercent(container), basis).toBe(expected);
        unmount();
      }
    });

    it('is pulled inward at the far end so it never hangs off the track', () => {
      // The largest card in the portfolio defines the axis, so its marker
      // lands exactly on the right cap — routinely, at the potential-transfer
      // basis. A raw 100% would leave half the marker outside the track, so
      // the offset goes negative by its own radius.
      const { container } = renderBar('transfer');
      expect(markerLeft(container)).toBe('calc(100% + -0.5rem)');
    });

    it('pushes the marker inward at the near end too', () => {
      // A small card beside a large one sits near the left cap. The offset is
      // positive there, approaching a full radius as the value approaches
      // zero — the mirror of the case above.
      const { container } = renderBar('cashBack', 2100, {
        ...valuation,
        floor: 20,
        marker: 40,
        ceiling: 70,
      });
      expect(markerPercent(container)).toBe(1);
      const inset = parseFloat(markerLeft(container).split('+')[1]);
      expect(inset).toBeGreaterThan(0.48);
      expect(inset).toBeLessThanOrEqual(0.5);
    });
  });

  describe('the highlighted figure', () => {
    it('names and shows the selected basis', () => {
      for (const [basis, label, value] of [
        ['cashBack', 'Cash-back floor', '$600'],
        ['guaranteed', 'Realistic value', '$1,200'],
        ['transfer', 'Potential transfer value', '$2,100'],
      ] as const) {
        const { unmount } = renderBar(basis);
        expect(highlightedValue(label), basis).toBe(value);
        unmount();
      }
    });
  });

  it('falls back to a plain figure when nothing has been entered anywhere', () => {
    // A shared axis has no meaning at zero, so there is no bar to draw.
    const { container } = renderBar('guaranteed', 0, {
      ...valuation,
      floor: 0,
      marker: 0,
      ceiling: 0,
    });
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(segmentWidths(container)).toEqual([]);
  });

  it('says which card a pooled valuation is riding on', () => {
    renderBar('guaranteed', 2100, {
      ...valuation,
      isPooled: true,
      pooledViaCard: {
        id: 'csr',
        name: 'Chase Sapphire Reserve',
        issuer: 'chase',
        annualFee: 795,
        portalMultiplier: 1,
        transferEligible: true,
      },
    });
    expect(screen.getByText(/Valued via pooling into Chase Sapphire Reserve/)).toBeInTheDocument();
  });
});
