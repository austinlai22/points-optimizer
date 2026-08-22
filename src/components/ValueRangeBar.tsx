import { formatUSD } from '../utils/format';
import { LABEL } from '../styles/constants';
import { AnimatedNumber } from './AnimatedNumber';
import type { CardValuation } from '../types';

interface ValueRangeBarProps {
  valuation: CardValuation;
}

export function ValueRangeBar({ valuation }: ValueRangeBarProps) {
  const { floor, marker, ceiling, isFixedValue, isPooled, pooledViaCard } = valuation;

  // Defensive fallback: only reachable if cards.json ever contains zero
  // transfer-eligible cards (with today's roster, every card can reach a
  // real ceiling either directly or by pooling).
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

  const markerPercent = ((marker - floor) / (ceiling - floor)) * 100;

  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className={LABEL}>Cash-back floor</span>
        <span className={LABEL}>Transfer ceiling</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-navy/20 via-navy/55 to-navy">
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal shadow-md ring-4 ring-slate-50 transition-[left] duration-300 motion-reduce:transition-none"
          style={{ left: `${markerPercent}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-sm">
        <span className="text-navy-950/55">{formatUSD(floor)}</span>
        <span className="text-navy-950/55">{formatUSD(ceiling)}</span>
      </div>
      <div className="mt-3 rounded-2xl bg-teal/10 px-3 py-2.5 text-center">
        <p className={LABEL}>Realistic value</p>
        <p className="font-mono text-xl font-medium text-teal">
          <AnimatedNumber value={marker} format={formatUSD} />
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
