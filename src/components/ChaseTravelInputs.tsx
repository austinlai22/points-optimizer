import { listChaseCardTypes } from '../lib/verdict';
import type { ChaseCardType } from '../lib/verdict/types';
import { FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import type { ChaseInputValues } from '../utils/verdictInputs';

const CARD_TYPES = listChaseCardTypes();

interface ChaseTravelInputsProps {
  values: ChaseInputValues;
  inferredCardType: ChaseCardType;
  onChange: (values: ChaseInputValues) => void;
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChaseTravelInputs({
  values,
  inferredCardType,
  onChange,
}: ChaseTravelInputsProps) {
  const cardType = values.cardType || inferredCardType;
  const choice = (yes: boolean) =>
    `rounded-lg border px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING} ${
      values.appliedBeforeCutoff === yes
        ? 'border-navy bg-navy text-slate-50'
        : 'border-navy/15 bg-slate-50 text-navy-950/60 hover:border-navy/35'
    }`;

  return (
    <div className="space-y-5">
      <div className="space-y-5">
        <div>
          <label htmlFor="chase-card-type" className={`mb-1.5 block ${LABEL}`}>
            Chase card your points are on
          </label>
          <div className="relative">
            <select
              id="chase-card-type"
              value={cardType}
              onChange={(event) => onChange({ ...values, cardType: event.target.value as ChaseCardType })}
              className={`${FIELD} appearance-none pr-9 ${TAP_TARGET} ${FOCUS_RING}`}
            >
              {CARD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-navy-950/35">
              <ChevronDownIcon />
            </span>
          </div>
          <p className="mt-1.5 text-xs text-navy-950/50">Determines your Points Boost range.</p>
        </div>

        {cardType === 'reserve' && (
          <div>
            <p className={`mb-1.5 ${LABEL}`} id="cutoff-label">
              Applied before June 23, 2025?
            </p>
            <div className="flex gap-2" role="group" aria-labelledby="cutoff-label">
              <button type="button" aria-pressed={values.appliedBeforeCutoff === true} onClick={() => onChange({ ...values, appliedBeforeCutoff: true })} className={choice(true)}>
                Yes
              </button>
              <button type="button" aria-pressed={values.appliedBeforeCutoff === false} onClick={() => onChange({ ...values, appliedBeforeCutoff: false })} className={choice(false)}>
                No
              </button>
            </div>
            <p className="mt-1.5 text-xs text-navy-950/50">
              If so, Chase redeems points earned before October 26, 2025 at 1.5¢ each in Chase Travel
              until October 26, 2027.
            </p>
            {values.appliedBeforeCutoff && (
              <div className="mt-4">
                <label htmlFor="legacy-points" className={`mb-1.5 block ${LABEL}`}>
                  Points earned before October 26, 2025
                </label>
                <input
                  id="legacy-points"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values.legacyPoints}
                  onChange={(event) => onChange({ ...values, legacyPoints: event.target.value })}
                  placeholder="All of them"
                  className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}
                />
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
