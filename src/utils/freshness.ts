// Staleness tracking for the app's factual data.
//
// Everything here is a snapshot of terms the issuers control and change
// without warning. Two ratio changes landed within six months of each other
// while this app was being built — Amex cut Cathay Pacific from 1:1 to 5:4 on
// 1 March 2026, and ended Etihad transfers entirely on 30 June 2026 — and
// when those were checked, three well-known published guides were already out
// of date, one of them still listing a partner that folded in 2019.
//
// A tool whose whole value is accuracy cannot rely on someone remembering to
// re-check. So each transfer partner records when its ratios were last
// verified against a published source, a test fails once anything ages past
// MAX_VERIFICATION_AGE_MONTHS, and the app shows the dates rather than a
// hardcoded claim that can drift from reality.

// Card fees, portal rates and cash-back rates were last checked in August
// 2026. Kept deliberately conservative: parts of the card data were confirmed
// more recently, but not all of it, and under-claiming freshness is the safe
// direction to round.
export const CARD_TERMS_VERIFIED_ON = '2026-08-01';

// Six months, chosen from observed churn rather than taste: the two changes
// above were about four months apart, so a half-year window catches drift
// without crying wolf every quarter.
export const MAX_VERIFICATION_AGE_MONTHS = 6;

function parseIsoDate(isoDate: string): Date {
  // Parsed as UTC so the result never shifts by a day with the machine's
  // timezone — a date-only string has no time zone to speak of.
  return new Date(`${isoDate}T00:00:00Z`);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseIsoDate(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

// Whole months elapsed, not rounded — a date five months and 29 days old
// reports 5, so the threshold means what it says.
export function monthsSince(isoDate: string, asOf: Date = new Date()): number {
  const from = parseIsoDate(isoDate);
  const months =
    (asOf.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - from.getUTCMonth());
  return asOf.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}

export function isStale(isoDate: string, asOf: Date = new Date()): boolean {
  return monthsSince(isoDate, asOf) >= MAX_VERIFICATION_AGE_MONTHS;
}

// The weakest link, since the app is only as current as its oldest datum.
export function oldestVerifiedOn(isoDates: string[]): string | null {
  if (isoDates.length === 0) return null;
  return isoDates.reduce((oldest, date) => (date < oldest ? date : oldest));
}

// "August 2026" — month precision is the honest granularity to show a reader,
// since the underlying check isn't accurate to the day.
export function formatVerifiedOn(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
