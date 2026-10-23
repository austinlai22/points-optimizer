import { formatUSD } from '../../utils/format';
import { ISSUER_LABELS } from '../../utils/issuers';
import type { RunwayResult, VerdictResult } from './types';

// Wording shared by every channel, so the web result and the agent tool
// can't describe the same verdict two different ways.

export function formatCents(cents: number): string {
  return `${Number(cents.toFixed(2))}¢`;
}

export function formatMonths(months: number): string {
  const rounded = Math.max(0, Number(months.toFixed(1)));
  return `${rounded} ${rounded === 1 ? 'month' : 'months'}`;
}

// How long a cushion lasts, in words. Under a week, a decimal of a month reads
// as "about 0 months", which says nothing useful.
export function describeMonths(months: number): string {
  if (months < 0.25) return 'less than a week';
  return `about ${formatMonths(months)}`;
}

// The verdict as a short imperative, said as plainly for cash as for points.
export function verdictHeadline(result: Pick<VerdictResult, 'verdict' | 'bestOption'>): string {
  switch (result.verdict) {
    case 'PAY_CASH':
      return 'Pay cash';
    case 'TRANSFER_POINTS':
      return result.bestOption?.pointsUsed === 0 ? 'Use your partner points' : 'Transfer points';
    case 'BOOK_CHASE_TRAVEL':
      return 'Book in Chase Travel';
    case 'BOOK_TRAVEL_PORTAL':
      return result.bestOption
        ? `Book through ${ISSUER_LABELS[result.bestOption.issuer]}'s travel portal`
        : 'Book through your travel portal';
    case 'WAIT_OR_RECONSIDER':
      return 'Wait to book';
  }
}

// What a purchase leaves in the cushion, e.g. "about 2.4 months of spending
// left" or "$200 short".
export function describeRunway(runway: RunwayResult): string {
  if (runway.bufferAfter < 0) return `${formatUSD(-runway.bufferAfter)} short`;
  return `${describeMonths(runway.monthsOfBuffer)} of spending left`;
}
