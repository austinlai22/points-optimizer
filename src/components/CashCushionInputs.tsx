import { useState } from 'react';
import { FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import { formatUSD } from '../utils/format';
import type { CashInputValues } from '../utils/verdictInputs';

interface CashFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  allowNegative?: boolean;
  onChange: (value: string) => void;
}

function CashField({ id, label, hint, value, allowNegative = false, onChange }: CashFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={`mb-1.5 block ${LABEL}`}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-navy-950/35">
          $
        </span>
        <input
          id={id}
          type="number"
          min={allowNegative ? undefined : 0}
          inputMode={allowNegative ? 'text' : 'numeric'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className={`${FIELD} pl-7 ${TAP_TARGET} ${FOCUS_RING}`}
        />
      </div>
      <p className="mt-1.5 text-xs text-navy-950/45">{hint}</p>
    </div>
  );
}

interface CashCushionInputsProps {
  values: CashInputValues;
  onChange: (values: CashInputValues) => void;
}

export function CashCushionInputs({ values, onChange }: CashCushionInputsProps) {
  const [demo, setDemo] = useState<'idle' | 'loading' | 'error' | { institution: string }>('idle');

  const fillFromDemoBank = async () => {
    setDemo('loading');
    try {
      const response = await fetch('/api/plaid-sandbox', { method: 'POST' });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { cashAvailable: number; institution: string };
      onChange({ ...values, available: String(Math.round(data.cashAvailable)) });
      setDemo({ institution: data.institution });
    } catch {
      setDemo('error');
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <CashField
          id="cash-available"
          label="Cash for travel now"
          hint="What you could spend on travel without stress."
          value={values.available}
          onChange={(available) => onChange({ ...values, available })}
        />
        <CashField
          id="monthly-leftover"
          label="Left over each month"
          hint="After bills, in a typical month. Can be negative."
          value={values.leftover}
          allowNegative
          onChange={(leftover) => onChange({ ...values, leftover })}
        />
        <CashField
          id="monthly-spend"
          label="Monthly spending"
          hint="Everything you spend in a typical month."
          value={values.spend}
          onChange={(spend) => onChange({ ...values, spend })}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs text-navy-950/45">
          Stays in your browser. No bank login needed.
        </p>
        {__PLAID_SANDBOX__ && (
          <button
            type="button"
            onClick={fillFromDemoBank}
            disabled={demo === 'loading'}
            className={`rounded-lg border border-dashed border-navy/25 px-3 text-xs font-medium text-navy-950/60 hover:border-navy/45 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}
          >
            {demo === 'loading' ? 'Connecting…' : 'Use a demo bank (sandbox data)'}
          </button>
        )}
      </div>
      {typeof demo === 'object' && (
        <p className="mt-2 text-xs text-amber">
          Demo data from {demo.institution}: {formatUSD(Number(values.available) || 0)} filled in.
          This is Plaid's test bank, not your real account.
        </p>
      )}
      {demo === 'error' && (
        <p className="mt-2 text-xs text-amber">The demo bank isn't available right now.</p>
      )}
    </div>
  );
}
