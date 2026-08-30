import { formatUSD } from '../utils/format';
import { LABEL } from '../styles/constants';
import { useCardBalances } from '../context/CardBalancesContext';
import { AnimatedNumber } from './AnimatedNumber';
import { VALUATION_KEY_BY_BASIS, VALUATION_LABEL_BY_BASIS, type CardValuation } from '../types';

interface ValueRangeBarProps {
  valuation: CardValuation;
}

// The dot is w-5 (1.25rem), centred on its `left` via -translate-x-1/2. At a
// raw 0% or 100% that would hang half outside the track — which now happens
// routinely, since the cash-back and transfer bases park it on the ends. Nudge
// it inward by its own radius so it sits flush against either cap instead.
const DOT_RADIUS_REM = 0.625;
function dotLeft(percent: number): string {
  const inset = DOT_RADIUS_REM - (percent / 100) * (DOT_RADIUS_REM * 2);
  return `calc(${percent}% + ${inset}rem)`;
}

export function ValueRangeBar({ valuation }: ValueRangeBarProps) {
  const { basis } = useCardBalances();
  const { floor, ceiling, isFixedValue, isPooled, pooledViaCard } = valuation;
  const selected = valuation[VALUATION_KEY_BY_BASIS[basis]];

  // Reached whenever a card's floor and ceiling coincide — at a zero balance,
  // and genuinely for Bank of America Premium Rewards, whose cash-out rate,
  // portal rate, and (absent any transfer partners) ceiling are all 1c. There
  // is no range to plot, and every basis selects the same figure.
  if (isFixedValue) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-slate-50 p-4 text-center">
        <p className={LABEL}>Fixed value</p>
        <p className="mt-1 font-mono text-2xl text-teal">
          <AnimatedNumber value={floor} format={formatUSD} />
        </p>
      </div>
    );
  }

  // Follows the chosen basis, so the dot slides to whichever end of the range
  // you're valuing at — 0% at the cash-back floor, 100% at the transfer
  // ceiling — and the figure below it matches the portfolio total above.
  const markerPercent = ((selected - floor) / (ceiling - floor)) * 100;

  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className={LABEL}>Cash-back floor</span>
        <span className={LABEL}>Transfer ceiling</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-navy/20 via-navy/55 to-navy">
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal shadow-md ring-4 ring-slate-50 transition-[left] duration-300 motion-reduce:transition-none"
          style={{ left: dotLeft(markerPercent) }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-sm">
        <span className="text-navy-950/55">{formatUSD(floor)}</span>
        <span className="text-navy-950/55">{formatUSD(ceiling)}</span>
      </div>
      <div className="mt-3 rounded-2xl bg-teal/10 px-3 py-2.5 text-center">
        <p className={LABEL}>{VALUATION_LABEL_BY_BASIS[basis]}</p>
        <p className="font-mono text-xl font-medium text-teal">
          <AnimatedNumber value={selected} format={formatUSD} />
        </p>
      </div>
      {isPooled && pooledViaCard && (
        <p className="mt-1.5 text-center font-sans text-[11px] text-navy-950/45">
          Valued via pooling into {pooledViaCard.name}
        </p>
      )}
    </div>
  );
}
