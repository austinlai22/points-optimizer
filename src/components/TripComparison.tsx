import type { ReactNode } from 'react';
import { formatCents, verdictHeadline } from '../lib/verdict';
import type { VerdictResult } from '../lib/verdict/types';
import type { Issuer } from '../types';
import { MAX_COMPARE, describePointsOption, removeFromCompare, valueFromInputs, type SavedTrip } from '../lib/trips';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';
import { formatPoints, formatUSD } from '../utils/format';

// Side by side, in the manner of a product comparison: one column per trip,
// the same few facts in each, and a mark wherever a trip beats the others.

// The best way to use points for one trip, from wherever it can be had.
interface ColumnOption {
  title: string;
  detail: string;
  cppCents: number | null;
  // Against the points' usual value; null when only the trip's own prices
  // are known.
  benchmarkRatio: number | null;
  pointsUsed: number;
  // Per partner point rather than per bank point: shown, but not ranked.
  perPartnerPoint?: boolean;
  unit?: string | null;
}

interface Column {
  trip: SavedTrip;
  headline: string | null;
  option: ColumnOption | null;
  // Where the figures came from: today's cards, the recommendation saved with
  // the trip, or just the prices entered.
  source: 'today' | 'saved' | 'entered' | 'none';
}

// Today's recommendation when your cards can produce a points option; else
// the one saved with the trip; else value from the trip's own prices. The
// verdict's own bestOption is empty when it says to pay cash, so the best
// option is taken from the full list, to show what points would get.
function columnFor(trip: SavedTrip, verdict: VerdictResult | null, heldIssuers: Issuer[]): Column {
  const best = verdict?.options[0];
  if (verdict && best) {
    return {
      trip,
      headline: verdictHeadline(verdict),
      option: {
        ...describePointsOption(best),
        cppCents: best.cppCents,
        benchmarkRatio: Number.isFinite(best.benchmarkRatio) ? best.benchmarkRatio : null,
        pointsUsed: best.pointsUsed,
      },
      source: 'today',
    };
  }
  if (trip.snapshot?.option) return { trip, headline: trip.snapshot.headline, option: trip.snapshot.option, source: 'saved' };
  const entered = valueFromInputs(trip.inputs, heldIssuers);
  const headline = verdict ? verdictHeadline(verdict) : (trip.snapshot?.headline ?? null);
  if (entered) return { trip, headline, option: { ...entered, benchmarkRatio: null }, source: 'entered' };
  return { trip, headline, option: null, source: 'none' };
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
  heldIssuers,
  dragOver,
  onOpen,
}: {
  trips: SavedTrip[];
  verdicts: Map<string, VerdictResult | null>;
  heldIssuers: Issuer[];
  dragOver: boolean;
  onOpen: (trip: SavedTrip) => void;
}) {
  const columns = trips.map((trip) => columnFor(trip, verdicts.get(trip.id) ?? null, heldIssuers));

  // Value is judged against each currency's usual value when every column
  // knows it, so different banks' points compare fairly; otherwise on the
  // cents per point shown.
  const byRatio = columns.every((c) => c.option?.benchmarkRatio != null);
  const wins: Record<WinKey, Set<number>> = {
    value: winners(
      columns.map((c) =>
        c.option?.perPartnerPoint ? null : byRatio ? (c.option?.benchmarkRatio ?? null) : (c.option?.cppCents ?? null),
      ),
    ),
    price: winners(columns.map((c) => -c.trip.inputs.tripCashPrice)),
    points: winners(columns.map((c) => (c.option && c.option.pointsUsed > 0 && !c.option.perPartnerPoint ? -c.option.pointsUsed : null))),
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
              <button type="button" onClick={() => onOpen(c.trip)} className={`mt-1 rounded-full px-3 text-sm font-medium text-navy hover:underline ${FOCUS_RING}`}>
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
            c.headline ? (
              <>
                <span className="rounded-full bg-gradient-to-br from-navy-950 to-navy px-4 py-2 font-display text-sm font-semibold text-slate-50">
                  {c.headline}
                </span>
                {c.source === 'saved' && <span className="mt-2 text-xs text-navy-950/45">As recommended when saved</span>}
              </>
            ) : (
              muted
            ),
          )}

          {row('Value per point', (c, i) =>
            c.option?.cppCents != null ? (
              <>
                <span className={`font-display text-4xl font-semibold tracking-tight ${wins.value.has(i) ? 'text-teal' : 'text-navy-950'}`}>
                  {formatCents(c.option.cppCents)}
                </span>
                <span className="mt-1 text-xs text-navy-950/50">
                  {c.option.benchmarkRatio != null
                    ? `${c.option.benchmarkRatio.toFixed(2)}× the points’ usual value`
                    : c.option.perPartnerPoint
                      ? `per ${c.option.unit} point, from the prices you entered`
                      : 'from the prices you entered'}
                </span>
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
            if (!c.option) return <span className="text-sm text-navy-950/45">No points price entered</span>;
            const { title, detail } = c.option;
            return (
              <>
                <span className="text-base font-medium leading-snug text-navy-950">{title}</span>
                <span className="mt-1 text-xs text-navy-950/50">{detail}</span>
                {c.option.pointsUsed > 0 && (
                  <span className={`mt-2 font-mono text-sm ${wins.points.has(i) ? 'text-teal' : 'text-navy-950/70'}`}>
                    {formatPoints(c.option.pointsUsed)} {c.option.perPartnerPoint ? 'partner pts' : 'pts'}
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
