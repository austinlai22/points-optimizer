import { describeRunway, formatCents, verdictHeadline } from '../lib/verdict';
import type { PointsOption, VerdictResult } from '../lib/verdict/types';
import { HERO_SURFACE, LABEL_ON_DARK } from '../styles/constants';
import { formatPoints } from '../utils/format';

function describeValue(option: PointsOption | undefined): { value: string; note: string } {
  if (!option) return { value: 'None', note: 'No points balance covers this trip' };
  if (option.cppCents === null) {
    return { value: 'Covered', note: 'by partner points you already hold' };
  }
  return {
    value: `${formatCents(option.cppCents)} per point`,
    note: `Usual value ${formatCents(option.benchmarkCents)}${option.isEstimate ? ' · estimate' : ''}`,
  };
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50/[0.06] px-4 py-3">
      <p className={LABEL_ON_DARK}>{label}</p>
      <p className="mt-1 font-mono text-lg text-slate-50">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-50/50">{note}</p>}
    </div>
  );
}

function boostRange(result: VerdictResult): string {
  const chase = result.chaseTravel!;
  const floor = formatCents(chase.floorCents);
  if (!chase.boostEligible) return `${floor} per point. This card is not eligible for Points Boost.`;
  if (chase.maxCents === null) return `${floor} per point, or more with Points Boost. Chase does not publish a maximum for this card.`;
  return `${floor} to ${formatCents(chase.maxCents)} per point, depending on Points Boost.`;
}

export function VerdictCard({ result }: { result: VerdictResult }) {
  // The option the verdict used, or the best one it turned down.
  const considered = result.bestOption ?? result.options[0];
  const value = describeValue(considered);

  return (
    <section aria-labelledby="verdict-heading" className={`${HERO_SURFACE} mb-8 p-6 sm:p-7`}>
      <p className={LABEL_ON_DARK}>Recommendation</p>
      <h2 id="verdict-heading" className="mt-1 font-display text-3xl font-medium tracking-tight text-slate-50">
        {verdictHeadline(result)}
      </h2>
      <p className="mt-2 max-w-2xl text-slate-50/75">{result.reason}</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Points value" value={value.value} note={value.note} />
        <Stat label="If you pay cash" value={describeRunway(result.runway.payCash)} />
        <Stat
          label="If you use points"
          value={result.runway.usePoints ? describeRunway(result.runway.usePoints) : 'Not applicable'}
          note={
            result.runway.usePoints && result.runway.usePoints.outlay > 0
              ? 'After taxes and fees on the award'
              : undefined
          }
        />
      </div>

      {result.chaseTravel && (
        <div className="mt-5 border-t border-slate-50/10 pt-4">
          <p className={LABEL_ON_DARK}>Chase Travel · {result.chaseTravel.cardTypeName}</p>
          <p className="mt-1 text-sm text-slate-50/75">
            {boostRange(result)}
            {result.chaseTravel.legacyApplied &&
              ` Includes the 1.5¢ legacy rate on ${formatPoints(result.chaseTravel.legacyPoints)} of your points.`}
          </p>
          <p className="mt-2 font-medium text-slate-50">{result.chaseTravel.sentence}</p>
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
