// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RedemptionPathCard } from './RedemptionPathCard';
import type { CardConfig, RedemptionPath, TransferPartner } from '../types';

// Every assertion here is about something a reader of the card actually sees.
// The logic suites already prove the numbers are right; what they cannot catch
// is the card showing the wrong one, colouring it wrongly, or hiding a caveat.

const reserve: CardConfig = {
  id: 'reserve',
  name: 'Chase Sapphire Reserve',
  issuer: 'chase',
  annualFee: 795,
  portalMultiplier: 1,
  transferEligible: true,
};

const freedom: CardConfig = {
  id: 'freedom',
  name: 'Chase Freedom',
  issuer: 'chase',
  annualFee: 0,
  portalMultiplier: 1,
  transferEligible: false,
};

const hyatt: TransferPartner = {
  id: 'hyatt',
  name: 'World of Hyatt',
  type: 'hotel',
  ratiosByIssuer: { chase: 1 },
};

function makePath(overrides: Partial<RedemptionPath> = {}): RedemptionPath {
  return {
    card: reserve,
    issuer: 'chase',
    kind: 'transfer',
    partner: hyatt,
    pointsUsed: 30_000,
    cashFees: 0,
    cost: 300,
    sufficient: true,
    isPoorDeal: false,
    usesPooling: false,
    pooledFromCards: [],
    ...overrides,
  };
}

// Reads the figure under a given label. Scoped deliberately: the same dollar
// amount can legitimately appear as both the cost and the savings, so a bare
// text query would be ambiguous — and would pass even if the two were swapped.
function fieldValue(label: string): string {
  const labelEl = screen.getByText(label);
  return labelEl.parentElement?.querySelector('p:last-child')?.textContent ?? '';
}

describe('RedemptionPathCard', () => {
  it('shows the redemption route, points and cost', () => {
    render(<RedemptionPathCard path={makePath()} rank={1} isTied={false} tripCashPrice={900} />);
    expect(screen.getByText('Chase Sapphire Reserve')).toBeInTheDocument();
    expect(screen.getByText('Transfer to World of Hyatt')).toBeInTheDocument();
    expect(fieldValue('Points used')).toBe('30,000');
    expect(fieldValue('Cost')).toBe('$300');
    expect(fieldValue('Savings vs. cash price')).toBe('$600');
  });

  it('describes a portal path as a portal booking, with no partner named', () => {
    render(
      <RedemptionPathCard
        path={makePath({ kind: 'portal', partner: null, pointsUsed: 60_000, cost: 600 })}
        rank={1}
        isTied={false}
        tripCashPrice={600}
      />,
    );
    expect(screen.getByText('Redeem via card portal')).toBeInTheDocument();
    expect(screen.queryByText(/Transfer to/)).not.toBeInTheDocument();
  });

  describe('savings colour', () => {
    // Three states, three colours — the distinction a user reads fastest, and
    // the one most likely to be silently broken by a refactor.
    const colourOf = (tripCashPrice: number, cost: number) => {
      const { container } = render(
        <RedemptionPathCard
          path={makePath({ cost })}
          rank={1}
          isTied={false}
          tripCashPrice={tripCashPrice}
        />,
      );
      const savingsRow = screen.getByText('Savings vs. cash price').parentElement;
      return savingsRow?.querySelector('p:last-child')?.className ?? container.className;
    };

    it('is teal when the redemption beats cash', () => {
      expect(colourOf(600, 300)).toContain('text-teal');
    });

    it('is orange at exactly break-even', () => {
      expect(colourOf(600, 600)).toContain('text-orange');
    });

    it('is red when the redemption costs more than cash', () => {
      expect(colourOf(600, 700)).toContain('text-red');
    });
  });

  it('flags a poor deal', () => {
    render(
      <RedemptionPathCard
        path={makePath({ cost: 700, isPoorDeal: true })}
        rank={1}
        isTied={false}
        tripCashPrice={600}
      />,
    );
    expect(screen.getByText('Poor deal')).toBeInTheDocument();
  });

  it('does not flag a good deal', () => {
    render(<RedemptionPathCard path={makePath()} rank={1} isTied={false} tripCashPrice={600} />);
    expect(screen.queryByText('Poor deal')).not.toBeInTheDocument();
  });

  it('marks tied options so equal ranks do not look like an ordering', () => {
    render(<RedemptionPathCard path={makePath()} rank={1} isTied tripCashPrice={600} />);
    expect(screen.getByText('Tied')).toBeInTheDocument();
  });

  it('breaks out cash fees only when there are any', () => {
    const { unmount } = render(
      <RedemptionPathCard
        path={makePath({ cashFees: 50, cost: 350 })}
        rank={1}
        isTied={false}
        tripCashPrice={600}
      />,
    );
    expect(screen.getByText(/Includes \$50 paid in cash/)).toBeInTheDocument();
    unmount();

    render(<RedemptionPathCard path={makePath()} rank={1} isTied={false} tripCashPrice={600} />);
    // A "+ $0 in fees" line on every portal path would be pure noise.
    expect(screen.queryByText(/paid in cash/)).not.toBeInTheDocument();
  });

  it('warns when the redemption needs points moved in from another card', () => {
    render(
      <RedemptionPathCard
        path={makePath({ usesPooling: true, pooledFromCards: [freedom] })}
        rank={1}
        isTied={false}
        tripCashPrice={600}
      />,
    );
    expect(screen.getByText(/Requires transfer-in from Chase Freedom/)).toBeInTheDocument();
  });

  it('shows the annual fee as reference, not as part of the cost', () => {
    render(<RedemptionPathCard path={makePath()} rank={1} isTied={false} tripCashPrice={900} />);
    expect(screen.getByText('$795/yr annual fee')).toBeInTheDocument();
    // Cost stays the points' opportunity cost. If the $795 fee were ever
    // folded in, this would read $1,095 rather than $300.
    expect(fieldValue('Cost')).toBe('$300');
  });
});
