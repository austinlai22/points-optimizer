import type { ReactNode } from 'react';

// A phone outline for showing the app as it appears on a screen. Decorative
// framing only; the content inside is real app output.
export function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-[2.75rem] bg-navy-950 p-2.5 shadow-[0_30px_60px_-20px_rgba(11,18,32,0.55)] ring-1 ring-white/10 ${className}`}
    >
      <div className="relative overflow-hidden rounded-[2.2rem] bg-slate-50">
        {/* Status bar and camera cut-out. */}
        <div className="flex h-9 items-center justify-between px-6 pt-1 text-[10px] font-semibold text-navy-950/70" aria-hidden="true">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-navy-950" />
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 10" className="h-2.5 w-4" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5" /><rect x="4.3" y="4" width="3" height="6" rx="0.5" /><rect x="8.6" y="2" width="3" height="8" rx="0.5" /><rect x="12.9" y="0" width="3" height="10" rx="0.5" /></svg>
            <svg viewBox="0 0 22 11" className="h-2.5 w-5" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" /><rect x="2" y="2" width="13" height="7" rx="1.2" fill="currentColor" /><path d="M20.5 3.5v4" strokeLinecap="round" /></svg>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
