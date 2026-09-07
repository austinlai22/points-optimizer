import { useCardBalances } from '../context/CardBalancesContext';
import { FOCUS_RING, LABEL } from '../styles/constants';
import type { ValuationBasis } from '../types';

// Rendered on both views, since the basis drives Portfolio's headline total
// AND Trip Optimizer's cost — a user only ever sees one view at a time, so
// this reads as contextual rather than duplicated.
interface ValuationBasisSelectProps {
  // Portfolio renders this on the dark hero surface; Trip Optimizer renders
  // it on a light card.
  onDark?: boolean;
}

// Short labels so all three fit one row on a phone; the sublabel carries the
// precision. Kept in the same floor -> ceiling order as Portfolio's range,
// so the control reads as "pick a point on that spectrum."
const OPTIONS: { value: ValuationBasis; label: string; sublabel: string }[] = [
  { value: 'cashBack', label: 'Cash-back floor', sublabel: 'If you cashed out' },
  { value: 'guaranteed', label: 'Guaranteed travel', sublabel: 'Book any trip today' },
  // The only one of the three that isn't a published rate, hence "potential"
  // and the "our estimate" sublabel — the wording is the disclosure.
  { value: 'transfer', label: 'Potential transfer value', sublabel: 'Our estimate' },
];

// Every basis carries a note, including the default. Leaving the default's
// blank made the surrounding box change height on every switch; keeping all
// three present (and similar in length) holds the layout still, and the
// default deserves an explanation as much as the others do. The transfer
// note matters most: at that basis every portal path is ALWAYS a poor deal
// (portal cost is exactly tripPrice x the premium), so the badge stops
// being informative and needs explaining rather than suppressing.
const BASIS_NOTES: Record<ValuationBasis, string> = {
  cashBack:
    'What you could cash out for, with no travel restriction — the most conservative benchmark.',
  guaranteed:
    "Bookable today through your issuer's travel portal, for any trip, with no award availability needed.",
  transfer:
    "This app's own estimate of award upside, not a published rate. Portal bookings always look like losses here — because they are, if you can transfer instead.",
};

export function ValuationBasisSelect({ onDark = false }: ValuationBasisSelectProps) {
  const { basis, setBasis } = useCardBalances();
  const note = BASIS_NOTES[basis];

  const labelClass = onDark
    ? 'text-[11px] font-medium uppercase tracking-wider text-slate-50/50'
    : LABEL;
  const noteClass = onDark ? 'text-slate-50/55' : 'text-navy-950/45';
  const trackClass = onDark
    ? 'border-slate-50/15 bg-navy-950/40'
    : 'border-navy/10 bg-slate-50';
  const idleText = onDark ? 'text-slate-50/60' : 'text-navy-950/55';
  const idleSub = onDark ? 'text-slate-50/35' : 'text-navy-950/35';

  return (
    <div>
      <p className={`mb-1.5 ${labelClass}`} id="valuation-basis-label">
        Value points at
      </p>
      {/* A radiogroup rather than a <select>: three fixed choices the user is
          meant to compare and flip between, so they belong on screen at once
          instead of behind a dropdown. */}
      <div
        role="radiogroup"
        aria-labelledby="valuation-basis-label"
        className={`grid grid-cols-3 gap-1 rounded-2xl border p-1 ${trackClass}`}
      >
        {OPTIONS.map(({ value, label, sublabel }) => {
          const isActive = basis === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              // Stable id so the value is addressable for testing regardless
              // of which of the two views is rendering the control.
              id={`valuation-basis-${value}`}
              onClick={() => setBasis(value)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1.5 py-2 text-center transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING} ${
                isActive
                  ? 'bg-navy text-slate-50 shadow-sm'
                  : `${idleText} hover:bg-navy/5`
              }`}
            >
              <span className="text-[13px] font-medium leading-tight">{label}</span>
              <span
                className={`mt-0.5 text-[10px] leading-tight ${
                  isActive ? 'text-slate-50/60' : idleSub
                }`}
              >
                {sublabel}
              </span>
            </button>
          );
        })}
      </div>
      {/* min-height absorbs the remaining line-count difference between the
          three notes, so switching basis never nudges what's below. */}
      <p className={`mt-2 min-h-[2.25rem] text-xs ${noteClass}`}>{note}</p>
    </div>
  );
}
