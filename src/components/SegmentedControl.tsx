import { FOCUS_RING, TAP_TARGET } from '../styles/constants';
import type { ViewName } from '../types';

interface SegmentedControlProps {
  value: ViewName;
  onChange: (value: ViewName) => void;
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M16 12h3" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9Z" />
    </svg>
  );
}

const OPTIONS = [
  { value: 'portfolio' as const, label: 'Portfolio', Icon: WalletIcon },
  { value: 'tripOptimizer' as const, label: 'Trip Optimizer', Icon: CompassIcon },
];

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  const isPortfolio = value === 'portfolio';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center border-t border-navy/10 bg-navy-100 p-2 sm:static sm:mb-10 sm:mt-8 sm:border-t-0 sm:bg-transparent sm:p-0"
      aria-label="View selector"
    >
      <div className="shadow-control relative grid w-full max-w-sm grid-cols-2 rounded-full border border-navy/10 bg-navy-100 p-1 sm:mx-auto sm:w-fit">
        <div
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-navy shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            isPortfolio ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-hidden="true"
        />
        {OPTIONS.map(({ value: optionValue, label, Icon }) => {
          const isActive = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              aria-pressed={isActive}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-4 font-sans text-sm font-medium transition-colors motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING} ${
                isActive ? 'text-slate-50' : 'text-navy-950/70'
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
