import { formatUSD } from '../utils/format';
import { LABEL } from '../styles/constants';
import { useCardBalances } from '../context/CardBalancesContext';
import { AnimatedNumber } from './AnimatedNumber';
import { VALUATION_KEY_BY_BASIS, VALUATION_LABEL_BY_BASIS, type CardValuation } from '../types';

interface ValueRangeBarProps {
  valuation: CardValuation;
  // The largest figure drawn anywhere in the portfolio right now. Every bar
  // shares it, so bar length means dollars and cards can be compared against
  // each other at a glance. Previously each bar was scaled to its own range
  // and stretched to full width, which made two cards holding identical value
  // look completely different — a Chase card and a Capital One card both worth
  // $1,000 put their markers at 0% and 40% respectively.
  axisMax: number;
}

// The dot is w-4 (1rem) and centred on its `left`, so at a raw 0% or 100% it
// would hang half outside the track. Nudge it inward by its own radius.
const DOT_RADIUS_REM = 0.5;
function dotLeft(percent: number): string {
  const inset = DOT_RADIUS_REM - (percent / 100) * (DOT_RADIUS_REM * 2);
  return `calc(${percent}% + ${inset}rem)`;
}

export function ValueRangeBar({ valuation, axisMax }: ValueRangeBarProps) {
  const { basis } = useCardBalances();
  const { floor, marker, isPooled, pooledViaCard } = valuation;
  const selected = valuation[VALUATION_KEY_BY_BASIS[basis]];

  // Nothing entered anywhere yet — a shared axis has no meaning at zero.
  if (axisMax <= 0) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-slate-50 p-4 text-center">
        <p className={LABEL}>{VALUATION_LABEL_BY_BASIS[basis]}</p>
        <p className="mt-1 font-mono text-2xl text-teal">{formatUSD(0)}</p>
      </div>
    );
  }

  const pct = (value: number) => Math.min((value / axisMax) * 100, 100);
  const floorPct = pct(floor);
  const markerPct = pct(marker);
  const selectedPct = pct(selected);
  // Only when the potential-transfer basis pushes the figure past what the
  // issuer guarantees. The bar grows to cover it in a third, fainter tone
  // rather than leaving the marker stranded on empty track.
  const estimatePct = Math.max(selectedPct - markerPct, 0);

  return (
    <div>
      {/* Filled from zero rather than drawn as a floating band: bar LENGTH is
          what reads as "how much is this worth" at a glance, which is the
          comparison a grid of cards invites. The tones step down in solidity
          as the figure gets less certain — what you'd get cashing out, the
          extra the travel portal guarantees, then (only at the potential-
          transfer basis) this app's estimate on top. That makes the
          issuer-level gap legible without reading a number: Chase is one
          solid bar because its two rates are identical, Capital One's is
          visibly half and half. */}
      <div className="relative">
        <div className="h-2.5 overflow-hidden rounded-full bg-navy/10">
          <div
            className="h-full bg-navy transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${floorPct}%` }}
            aria-hidden="true"
          />
          <div
            className="-mt-2.5 h-full bg-navy/35 transition-all duration-300 motion-reduce:transition-none"
            style={{ marginLeft: `${floorPct}%`, width: `${Math.max(markerPct - floorPct, 0)}%` }}
            aria-hidden="true"
          />
          <div
            className="-mt-2.5 h-full bg-navy/15 transition-all duration-300 motion-reduce:transition-none"
            style={{ marginLeft: `${markerPct}%`, width: `${estimatePct}%` }}
            aria-hidden="true"
          />
        </div>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal shadow-md ring-4 ring-slate-50 transition-[left] duration-300 motion-reduce:transition-none"
          style={{ left: dotLeft(selectedPct) }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between gap-2 font-mono text-xs text-navy-950/55">
        <span>
          {formatUSD(floor)} <span className="font-sans text-navy-950/40">floor</span>
        </span>
        <span>
          {formatUSD(marker)} <span className="font-sans text-navy-950/40">guaranteed</span>
        </span>
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
