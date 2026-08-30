import { useCardBalances } from '../context/CardBalancesContext';
import { FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import type { ValuationBasis } from '../types';

// Rendered on both views, since the basis drives Portfolio's headline total
// AND Trip Optimizer's cost — a user only ever sees one view at a time, so
// this reads as contextual rather than duplicated.
interface ValuationBasisSelectProps {
  // Portfolio renders this on the dark hero surface, where the light-text
  // treatment applies; Trip Optimizer renders it on a light card.
  onDark?: boolean;
}

const BASIS_LABELS: Record<ValuationBasis, string> = {
  cashBack: 'Cash-back floor',
  guaranteed: 'Guaranteed travel rate',
  transfer: 'Transfer value (best case)',
};

// Shown under the selector whenever the basis isn't the default, so its
// consequences don't read as a bug. The transfer note matters most: at that
// basis every portal path is ALWAYS a poor deal (portal cost is exactly
// tripPrice x the premium), so the badge stops being informative and needs
// explaining rather than suppressing.
const BASIS_NOTES: Record<ValuationBasis, string | null> = {
  cashBack:
    'Valuing points at what you could cash out for, with no travel restriction — the most conservative benchmark.',
  guaranteed: null,
  transfer:
    'Valuing points at their best-case transfer worth. Portal redemptions will always look like losses here — because they are, if you can reliably transfer instead.',
};

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ValuationBasisSelect({ onDark = false }: ValuationBasisSelectProps) {
  const { basis, setBasis } = useCardBalances();
  const note = BASIS_NOTES[basis];

  const labelClass = onDark ? 'text-[11px] font-medium uppercase tracking-wider text-slate-50/50' : LABEL;
  const noteClass = onDark ? 'text-slate-50/55' : 'text-navy-950/45';
  const fieldClass = onDark
    ? 'w-full rounded-xl border border-slate-50/20 bg-navy-950/40 px-3.5 font-mono text-slate-50 transition-colors hover:border-slate-50/35 motion-reduce:transition-none'
    : FIELD;
  const chevronClass = onDark ? 'text-slate-50/40' : 'text-navy-950/35';

  return (
    <div>
      <label htmlFor="valuation-basis" className={`mb-1.5 block ${labelClass}`}>
        Value points at
      </label>
      <div className="relative max-w-xs">
        <select
          id="valuation-basis"
          value={basis}
          onChange={(event) => setBasis(event.target.value as ValuationBasis)}
          className={`${fieldClass} appearance-none pr-9 ${TAP_TARGET} ${FOCUS_RING}`}
        >
          {(Object.keys(BASIS_LABELS) as ValuationBasis[]).map((value) => (
            <option key={value} value={value}>
              {BASIS_LABELS[value]}
            </option>
          ))}
        </select>
        <span
          className={`pointer-events-none absolute inset-y-0 right-3.5 flex items-center ${chevronClass}`}
        >
          <ChevronDownIcon />
        </span>
      </div>
      {note && <p className={`mt-1.5 max-w-md text-xs ${noteClass}`}>{note}</p>}
    </div>
  );
}
