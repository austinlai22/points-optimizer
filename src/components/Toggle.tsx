import { FOCUS_RING, TAP_TARGET } from '../styles/constants';

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ id, checked, onChange, label }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={`flex w-fit items-center gap-2.5 ${TAP_TARGET} cursor-pointer select-none`}
    >
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING} ${
          checked ? 'bg-navy' : 'bg-navy/25'
        }`}
      >
        <span
          className={`absolute left-0.5 h-5 w-5 rounded-full bg-slate-50 shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-sm text-navy-950/80">{label}</span>
    </label>
  );
}
