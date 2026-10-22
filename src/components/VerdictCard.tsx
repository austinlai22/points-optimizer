import type { ReactNode } from 'react';
import { formatCents, verdictHeadline } from '../lib/verdict';
import type { PointsOption, VerdictResult } from '../lib/verdict/types';
import { HERO_SURFACE, LABEL_ON_DARK } from '../styles/constants';
import { formatPoints } from '../utils/format';
import { ISSUER_LABELS } from '../utils/issuers';
import { BreakevenScale, RunwayMeter, ValueBars } from './visuals/Charts';

function optionLabel(option: PointsOption): string {
  if (option.kind === 'transfer') return `Transfer to ${option.partner!.name}`;
  if (option.kind === 'chaseTravel') return option.isEstimate ? 'Chase Travel (estimate)' : 'Chase Travel';
  return `${ISSUER_LABELS[option.issuer]} travel portal`;
}

function boostRange(result: VerdictResult): string {
  const chase = result.chaseTravel!;
  const floor = formatCents(chase.floorCents);
  if (!chase.boostEligible) return `${floor} per point. This card is not eligible for Points Boost.`;
  if (chase.maxCents === null) return `${floor} per point, or more with Points Boost. Chase does not publish a maximum for this card.`;
  return `${floor} to ${formatCents(chase.maxCents)} per point, depending on Points Boost.`;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50/[0.06] p-4 sm:p-5">
      <p className={`mb-3 ${LABEL_ON_DARK}`}>{title}</p>
      {children}
    </div>
  );
}

export function VerdictCard({ result }: { result: VerdictResult }) {
  // Up to four options, best first, with the recommended one highlighted.
  const shown = result.options.slice(0, 4);

  return (
    <section aria-labelledby="verdict-heading" className={`${HERO_SURFACE} mb-10 p-6 sm:p-8`}>
      <p className={LABEL_ON_DARK}>Recommendation</p>
      <h2 id="verdict-heading" className="mt-1 font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
        {verdictHeadline(result)}
      </h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-slate-50/75">{result.reason}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Value per point">
          {shown.length > 0 ? (
            <ValueBars
              tone="dark"
              benchmarkCents={shown[0].benchmarkCents}
              rows={shown.map((option) => ({
                label: optionLabel(option),
                cents: option.cppCents,
                benchmarkCents: option.benchmarkCents,
                highlight: option === result.bestOption,
              }))}
            />
          ) : (
            <p className="text-sm text-slate-50/60">None of your points balances is large enough for this trip.</p>
          )}
        </Panel>
        <Panel title="Your cash afterwards">
          <RunwayMeter tone="dark" payCash={result.runway.payCash} usePoints={result.runway.usePoints} />
        </Panel>
      </div>

      {result.chaseTravel && (
        <div className="mt-4">
          <Panel title={`Chase Travel · ${result.chaseTravel.cardTypeName}`}>
            <p className="text-sm text-slate-50/70">
              {boostRange(result)}
              {result.chaseTravel.legacyApplied &&
                ` Includes the 1.5¢ legacy rate on ${formatPoints(result.chaseTravel.legacyPoints)} of your points.`}
            </p>
            {result.chaseTravel.breakevenPoints > 0 && (
              <BreakevenScale
                tone="dark"
                breakevenPoints={result.chaseTravel.breakevenPoints}
                standardPoints={result.chaseTravel.nonBoostPoints}
                pastedPoints={result.chaseTravel.pastedPricePoints}
              />
            )}
            <p className="font-medium text-slate-50">{result.chaseTravel.sentence}</p>
          </Panel>
        </div>
      )}

      {result.assumptions.length > 0 && (
        <details className="group mt-5 border-t border-slate-50/10 pt-4">
          <summary className="cursor-pointer select-none text-sm text-slate-50/60">
            Assumptions behind this recommendation ({result.assumptions.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-50/60">
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-5 text-xs text-slate-50/45">
        These are estimates, not financial advice. Please confirm prices before booking.
      </p>
    </section>
  );
}
