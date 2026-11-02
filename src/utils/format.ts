const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const pointsFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const usdPerPointFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatUSD(value: number): string {
  return usdFormatter.format(value);
}

const usdCentsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Dollars, with cents only when there are any: $121.50, but $702.
export function formatUSDExact(value: number): string {
  const cents = Math.round(value * 100);
  return cents % 100 === 0 ? usdFormatter.format(cents / 100) : usdCentsFormatter.format(cents / 100);
}

export function formatPoints(value: number): string {
  return pointsFormatter.format(value);
}

export function formatUSDPerPoint(value: number): string {
  return usdPerPointFormatter.format(value);
}

// Balances, trip prices, and points-required are all meant to be >= 0 — a
// pasted negative number would otherwise silently pass every "sufficient
// balance" check (balance >= negativeNumber is always true) and produce
// nonsensical negative floors/ceilings.
export function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// For inputs that may legitimately be negative, like monthly leftover after
// bills. Empty or unreadable input is null ("not entered"), not zero.
export function parseFiniteNumber(value: string): number | null {
  if (value.trim() === '' || value.trim() === '-') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
