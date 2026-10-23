import { useId, useState } from 'react';
import { FOCUS_RING, LABEL } from '../styles/constants';

// Pick a month in one tap: a year switcher over a grid of months. Works the
// same in every browser, unlike <input type="month">, which Safari and
// Firefox show as a plain text box.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toIndex = (yyyyMm: string) => Number(yyyyMm.slice(0, 4)) * 12 + Number(yyyyMm.slice(5, 7)) - 1;
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

interface MonthPickerProps {
  label: string;
  // YYYY-MM, or '' for none chosen.
  value: string;
  onChange: (yyyyMm: string) => void;
  // The first month offered (YYYY-MM) and how many months after it.
  from: string;
  monthsAhead: number;
}

export function MonthPicker({ label, value, onChange, from, monthsAhead }: MonthPickerProps) {
  const labelId = useId();
  const first = toIndex(from);
  const last = first + monthsAhead;
  const years = Array.from({ length: Math.floor(last / 12) - Math.floor(first / 12) + 1 }, (_, i) => Math.floor(first / 12) + i);
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : years[0]);

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className={`mb-1.5 ${LABEL}`}>
        {label}
        {value && <span className="ml-2 normal-case text-navy-950/55">{FULL_MONTHS[Number(value.slice(5, 7)) - 1]} {value.slice(0, 4)}</span>}
      </p>
      <div className="rounded-2xl border border-navy/15 bg-white p-2">
        <div className="mb-2 flex gap-1" role="group" aria-label="Year">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={year === y}
              onClick={() => setYear(y)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${FOCUS_RING} ${year === y ? 'bg-navy/10 text-navy-950' : 'text-navy-950/55 hover:bg-navy/5'}`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {MONTHS.map((m, i) => {
            const index = year * 12 + i;
            const month = fromIndex(index);
            const outside = index < first || index > last;
            const chosen = value === month;
            return (
              <button
                key={m}
                type="button"
                disabled={outside}
                aria-pressed={chosen}
                aria-label={`${FULL_MONTHS[i]} ${year}`}
                onClick={() => onChange(chosen ? '' : month)}
                className={`min-h-11 rounded-lg text-sm font-medium transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                  chosen ? 'bg-navy text-slate-50' : outside ? 'cursor-not-allowed text-navy-950/20' : 'text-navy-950/75 hover:bg-navy/5'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
