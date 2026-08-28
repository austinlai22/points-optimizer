import type { Issuer } from '../types';

export const ISSUER_ORDER: Issuer[] = ['chase', 'capitalOne', 'amex', 'citi', 'bankOfAmerica'];

export const ISSUER_LABELS: Record<Issuer, string> = {
  chase: 'Chase',
  capitalOne: 'Capital One',
  amex: 'Amex',
  citi: 'Citi',
  bankOfAmerica: 'Bank of America',
};

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50';

export const TAP_TARGET = 'min-h-11 min-w-11';

export const CARD_SURFACE =
  'rounded-3xl bg-navy-100 border border-navy/10 shadow-card transition-shadow duration-200 hover:shadow-card-hover motion-reduce:transition-none';

// A dark "featured" surface — Revolut-style contrast against the rest of the
// light UI, reserved for the single most important item in a group (the
// portfolio total, the #1 ranked redemption).
export const HERO_SURFACE =
  'rounded-3xl bg-gradient-to-br from-navy-950 to-navy shadow-card transition-shadow duration-200 hover:shadow-card-hover motion-reduce:transition-none';

export const LABEL_BASE = 'text-[11px] font-medium uppercase tracking-wider';
export const LABEL = `${LABEL_BASE} text-navy-950/45`;
export const LABEL_ON_DARK = `${LABEL_BASE} text-slate-50/50`;

export const FIELD =
  'w-full rounded-xl border border-navy/15 bg-slate-50 px-3.5 font-mono text-navy-950 placeholder:text-navy-950/30 transition-colors hover:border-navy/30 motion-reduce:transition-none';
