import { useMemo } from 'react';
import { balancesByIssuer, planPoints } from '../lib/planPoints';
import { describePointsOption, type SavedTrip } from '../lib/trips';
import type { VerdictResult } from '../lib/verdict/types';
import { CARD_SURFACE } from '../styles/constants';
import type { CardConfig, Issuer } from '../types';
import { formatPoints, formatUSDExact } from '../utils/format';
import { ISSUER_LABELS } from '../utils/issuers';

// "You have 120,000 Chase points and three saved trips: use them on Tokyo,
// pay cash for the rest." Chooses among the engine's own options to save the
// most overall within your balances. A calculation, not AI.
export function PointsPlan({
  trips,
  verdicts,
  ownedCards,
  balances,
}: {
  trips: SavedTrip[];
  verdicts: Map<string, VerdictResult | null>;
  ownedCards: CardConfig[];
  balances: Record<string, number>;
}) {
  const held = useMemo(() => balancesByIssuer(ownedCards, balances), [ownedCards, balances]);
  const plan = useMemo(() => planPoints(trips, verdicts, held), [trips, verdicts, held]);
  if (trips.length < 2) return null;

  const usedBanks = Object.keys(plan.pointsUsed) as Issuer[];

  return (
    <section aria-labelledby="plan-heading" className="mt-10">
      <h2 id="plan-heading" className="font-display text-xl font-medium text-navy-950">
        Plan your points
      </h2>
      <p className="mt-1 text-sm text-navy-950/55">
        If you take all {trips.length} saved trips, here's where your points save the most without spending more than you
        have.
      </p>

      <div className={`${CARD_SURFACE} mt-4 overflow-hidden p-0 hover:shadow-card`}>
        <ul className="divide-y divide-navy/10 bg-white">
          {plan.trips.map(({ trip, option, savings }) => {
            const way = option ? describePointsOption(option) : null;
            return (
              <li key={trip.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-navy-950">{trip.name}</p>
                  <p className="text-sm text-navy-950/60">
                    {way ? (
                      <>
                        {way.title}, {formatPoints(option!.pointsUsed)} {ISSUER_LABELS[option!.issuer]} points
                        {option!.cashFees > 0 && <> + {formatUSDExact(option!.cashFees)}</>}
                      </>
                    ) : (
                      'Pay cash'
                    )}
                  </p>
                </div>
                <p className={`font-mono text-sm ${savings > 0 ? 'text-teal' : 'text-navy-950/40'}`}>
                  {savings > 0 ? `saves ${formatUSDExact(savings)}` : '—'}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-navy/10 bg-navy-100 px-5 py-4">
          <p className="text-sm text-navy-950/70">
            {usedBanks.length > 0
              ? usedBanks
                  .map((i) => `${formatPoints(plan.pointsUsed[i]!)} of ${formatPoints(held[i] ?? 0)} ${ISSUER_LABELS[i]} points`)
                  .join(' · ')
              : 'No trip saves money with points right now.'}
          </p>
          <p className="font-display text-lg font-semibold text-navy-950">
            {plan.totalSavings > 0 ? `Saves ${formatUSDExact(plan.totalSavings)} in all` : ''}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-navy-950/50">
        Savings are against paying cash, with points at their usual value, using your current cards and balances.
        {plan.exact ? '' : ' With this many trips it takes the best value per point first, which may not be the very best plan.'}{' '}
        Points you hold with a partner are counted per trip as entered.
      </p>
    </section>
  );
}
