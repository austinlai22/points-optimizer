// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardArt } from './CardArt';
import { BreakevenScale, RunwayMeter, ValueBars } from './Charts';
import { computeRunway } from '../../lib/verdict';

describe('visuals', () => {
  it('draws a card with its short name, hidden from screen readers', () => {
    const { container } = render(<CardArt cardId="csr" issuer="chase" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).toContain('Sapphire Reserve');
  });

  it("marks each option's own usual value when banks differ", () => {
    const { container } = render(
      <ValueBars
        benchmarkCents={1}
        rows={[
          { label: 'Chase Travel', cents: 1.5, benchmarkCents: 1.5, highlight: true },
          { label: 'Capital One travel portal', cents: 1, benchmarkCents: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Usual value of each bank's points")).toBeInTheDocument();
    const lines = [...container.querySelectorAll<HTMLElement>('.border-dashed[style]')].map((el) => el.style.left);
    expect(new Set(lines).size).toBe(2);
  });

  it('shows a shortfall instead of months when cash would run out', () => {
    render(<RunwayMeter payCash={computeRunway({ available: 800, monthlyLeftover: 0, monthlySpend: 1500 }, 1000)} />);
    expect(screen.getByText('$200 short')).toBeInTheDocument();
  });

  it('labels the breakeven and the standard price', () => {
    render(<BreakevenScale breakevenPoints={83_333} standardPoints={100_000} />);
    expect(screen.getByText('83,333')).toBeInTheDocument();
    expect(screen.getByText('100,000')).toBeInTheDocument();
  });
});
