import verdictConfig from '../../data/verdict-config.json';
import type { CashInputs, RunwayResult } from './types';

// The cash side of the verdict: what paying for something leaves you with.
//
// The idea comes from Centsible's runway (money available ÷ burn rate = how
// long it lasts), but not its code. Centsible measures burn from bank
// transactions and runs to a term or disbursement date; here there are no
// transactions and no deadline, just three numbers the user types in. So burn
// is their stated monthly spending, and "how long it lasts" is months of
// buffer left after the purchase.
//
// The thresholds are heuristics, kept in verdict-config.json.
export function computeRunway(cash: CashInputs, outlay: number): RunwayResult {
  const { strain } = verdictConfig;

  const bufferAfter = cash.available - outlay;
  // At least $1 so zero spending can't divide by zero.
  const monthsOfBuffer = bufferAfter / Math.max(cash.monthlySpend, 1);

  const strainReasons: RunwayResult['strainReasons'] = [];
  if (bufferAfter < 0) strainReasons.push('negativeBuffer');
  else if (monthsOfBuffer < strain.min_months_of_buffer) strainReasons.push('thinBuffer');
  // Already losing money every month, so a big one-off hurts more than the
  // buffer alone suggests.
  if (
    cash.monthlyLeftover < 0 &&
    outlay > strain.negative_leftover_max_share_of_cash * cash.available
  ) {
    strainReasons.push('negativeLeftover');
  }

  return {
    outlay,
    bufferAfter,
    monthsOfBuffer,
    strained: strainReasons.length > 0,
    strainReasons,
  };
}
