import type { Issuer } from '../types';

// Plain data, kept out of styles/ so non-UI code (the verdict engine, and the
// agent tool that shares it) can name issuers without pulling in
// Tailwind class strings. styles/constants re-exports both.
export const ISSUER_ORDER: Issuer[] = [
  'chase',
  'capitalOne',
  'amex',
  'citi',
  'bankOfAmerica',
  'bilt',
];

export const ISSUER_LABELS: Record<Issuer, string> = {
  chase: 'Chase',
  capitalOne: 'Capital One',
  amex: 'Amex',
  citi: 'Citi',
  bankOfAmerica: 'Bank of America',
  bilt: 'Bilt',
};
