import type { ReactNode } from 'react';
import { formatCents, verdictHeadline } from '../lib/verdict';
import type { PointsOption, VerdictResult } from '../lib/verdict/types';
import { MAX_COMPARE, openTrip, removeFromCompare, type SavedTrip } from '../lib/trips';
import { FOCUS_RING, ISSUER_LABELS, TAP_TARGET } from '../styles/constants';
import { formatPoints, formatUSD } from '../utils/format';

// Side by side, in the manner of a product comparison: one column per trip,
// the same few facts in each, and a mark wherever a trip beats the others.

interface Column {
  trip: SavedTrip;
  verdict: VerdictResult | null;
  // The best points option whatever the verdict. The verdict's own
  // bestOption is empty when it says to pay cash, but the comparison still
  // wants to show what points would get.
  option: PointsOption | null;
}

type WinKey = 'value' | 'price' | 'points';
const WIN_LABELS: Record<WinKey, string> = {
  value: 'Highest value per point',
  price: 'Lowest cash price',
  points: 'Fewest points',
};

// Indexes of the columns that win on `score` (higher is better). Nobody wins
// when every column ties, or when fewer than two columns have a score.
function winners(scores: (number | null)[]): Set<number> {
  const valid = scores.filter((s): s is number => s !== null && Number.isFinite(s));
  if (valid.length < 2) return new Set();
  const best = Math.max(...valid);
  const won = scores.flatMap((s, i) => (s !== null && Math.abs(s - best) < 1e-9 ? [i] : []));
  return won.length === valid.length ? new Set() : new Set(won);
}

function optionName(option: PointsOption): { title: string; detail: string } {
  if (option.kind === 'transfer') {
    return { title: `Transfer to ${option.partner?.name ?? 'partner'}`, detail: `from ${ISSUER_LABELS[option.issuer]}` };
  }
  if (option.kind === 'chaseTravel') return { title: 'Book in Chase Travel', detail: option.isEstimate ? 'estimated price' : 'price you entered' };
  return { title: `${ISSUER_LABELS[option.issuer]} travel portal`, detail: 'book with points' };
}

function WinMark({ children }: { children: ReactNode }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      {children}
    </span>
  );
}

const muted = <span className="text-navy-950/30">—</span>;

export function TripComparison({
  trips,
  verdicts,
  dragOver,
}: {
  trips: SavedTrip[];
  verdicts: Map<string, VerdictResult | null>;
  dragOver: boolean;
}) {
  const columns: Column[] = trips.map((trip) => {
    const verdict = verdicts.get(trip.id) ?? null;
    return { trip, verdict, option: verdict?.options[0] ?? null };
  });

  const wins: Record<WinKey, Set<number>> = {
    value: winners(columns.map((c) => c.option?.benchmarkRatio ?? null)),
    price: winners(columns.map((c) => -c.trip.inputs.tripCashPrice)),
    points: winners(columns.map((c) => (c.option && c.option.pointsUsed > 0 ? -c.option.pointsUsed : null))),
  };
  const winsFor = (i: number) => (Object.keys(wins) as WinKey[]).filter((k) => wins[k].has(i));

  const slots = MAX_COMPARE - columns.length;
  const gridStyle = { gridTemplateColumns: `repeat(${columns.length + (slots > 0 ? 1 : 0)}, minmax(11.5rem, 1fr))` };

  // One labelled row: a small heading across the top, then a centred value in
  // each column, Apple-style.
  const row = (label: string, cell: (c: Column, i: number) => ReactNode) => (
    <>
      <div className="col-span-full border-t border-navy/10 pt-6">
        <span className="sticky left-0 text-[11px] font-medium uppercase tracking-wider text-navy-950/45">{label}</span>
      </div>
      {columns.map((c, i) => (
        <div key={c.trip.id} className="flex flex-col items-center px-3 pb-6 pt-3 text-center">
          <span className="sr-only">
            {c.trip.name}, {label}:{' '}
          </span>
          {cell(c, i)}
        </div>
      ))}
      {slots > 0 && <div />}
    </>
  );

  return (
    <div className={`overflow-hidden rounded-3xl border bg-white shadow-card ${dragOver ? 'border-navy ring-2 ring-navy' : 'border-navy/10'}`}>
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="grid min-w-full px-4 pt-6 sm:px-8 sm:pt-8" style={gridStyle}>
          {/* Column headers: the trip, and where it wins. */}
          {columns.map((c, i) => (
            <div key={c.trip.id} className="relative flex flex-col items-center px-3 pb-6 text-center">
              <button
                type="button"
                onClick={() => removeFromCompare(c.trip.id)}
                aria-label={`Remove ${c.trip.name} from comparison`}
                className={`absolute -top-2 right-0 flex items-center justify-center rounded-full text-navy-950/35 hover:bg-navy/5 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
              <p className="mt-6 font-display text-xl font-semibold leading-tight tracking-tight text-navy-950">{c.trip.name}</p>
              <button type="button" onClick={() => openTrip(c.trip)} className={`mt-1 rounded-full px-3 text-sm font-medium text-navy hover:underline ${FOCUS_RING}`}>
                Open ›
              </button>
              <p className="mt-2 min-h-5 text-xs font-medium text-teal">
                {winsFor(i).length > 0 ? `Wins on ${winsFor(i).length} of ${Object.keys(wins).length}` : ''}
              </p>
            </div>
          ))}
          {slots > 0 && (
            <div className="px-3 pb-6">
              <div
                className={`flex h-full min-h-28 items-center justify-center rounded-2xl border-2 border-dashed px-3 text-center text-sm transition-colors motion-reduce:transition-none ${
                  dragOver ? 'border-navy bg-navy/5 text-navy-950' : 'border-navy/15 text-navy-950/45'
                }`}
              >
                Drag or click a trip to add it
                <br />({slots} more)
              </div>
            </div>
          )}

          {row('Recommendation', (c) =>
            c.verdict ? (
              <span className="rounded-full bg-gradient-to-br from-navy-950 to-navy px-4 py-2 font-display text-sm font-semibold text-slate-50">
                {verdictHeadline(c.verdict)}
              </span>
            ) : (
              <span className="text-sm text-navy-950/45">Add your cash position</span>
            ),
          )}

          {row('Value per point', (c, i) =>
            c.option?.cppCents != null ? (
              <>
                <span className={`font-display text-4xl font-semibold tracking-tight ${wins.value.has(i) ? 'text-teal' : 'text-navy-950'}`}>
                  {formatCents(c.option.cppCents)}
                </span>
                {Number.isFinite(c.option.benchmarkRatio) && (
                  <span className="mt-1 text-xs text-navy-950/50">{c.option.benchmarkRatio.toFixed(2)}× the points’ usual value</span>
                )}
                {wins.value.has(i) && <WinMark>{WIN_LABELS.value}</WinMark>}
              </>
            ) : (
              muted
            ),
          )}

          {row('Trip cash price', (c, i) => (
            <>
              <span className={`font-display text-3xl font-semibold tracking-tight ${wins.price.has(i) ? 'text-teal' : 'text-navy-950'}`}>
                {formatUSD(c.trip.inputs.tripCashPrice)}
              </span>
              {wins.price.has(i) && <WinMark>{WIN_LABELS.price}</WinMark>}
            </>
          ))}

          {row('Best way with points', (c, i) => {
            if (!c.option) return <span className="text-sm text-navy-950/45">{c.verdict ? 'None your points cover' : muted}</span>;
            const { title, detail } = optionName(c.option);
            return (
              <>
                <span className="text-base font-medium leading-snug text-navy-950">{title}</span>
                <span className="mt-1 text-xs text-navy-950/50">{detail}</span>
                {c.option.pointsUsed > 0 && (
                  <span className={`mt-2 font-mono text-sm ${wins.points.has(i) ? 'text-teal' : 'text-navy-950/70'}`}>
                    {formatPoints(c.option.pointsUsed)} pts
                  </span>
                )}
                {wins.points.has(i) && <WinMark>{WIN_LABELS.points}</WinMark>}
              </>
            );
          })}
        </div>
      </div>
      <p className="border-t border-navy/10 px-4 py-3 text-center text-xs text-navy-950/50 sm:px-8">
        Worked out with your current cards, balances and cash position, so a trip saved weeks ago reflects today’s numbers.
      </p>
    </div>
  );
}
