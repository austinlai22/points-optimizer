import { useMemo, useState, type DragEvent, type MouseEvent } from 'react';
import cardsData from '../data/cards.json';
import { useCardBalances } from '../context/CardBalancesContext';
import { describeRunway, formatCents, verdictHeadline } from '../lib/verdict';
import type { PointsOption, VerdictResult } from '../lib/verdict/types';
import { linkHandler, navigate } from '../lib/router';
import {
  MAX_COMPARE,
  addToCompare,
  clearCompare,
  deleteTrip,
  evaluateTrip,
  partnerName,
  removeFromCompare,
  useCompareIds,
  useSavedTrips,
  type SavedTrip,
} from '../lib/trips';
import { CARD_SURFACE, FOCUS_RING, ISSUER_LABELS, LABEL, TAP_TARGET } from '../styles/constants';
import { formatPoints, formatUSD } from '../utils/format';
import { usePersistentState } from '../utils/usePersistentState';
import {
  CASH_STORAGE_KEY,
  CHASE_STORAGE_KEY,
  EMPTY_CASH_INPUTS,
  EMPTY_CHASE_INPUTS,
  TRIP_STORAGE_KEY,
  sanitizeCashInputs,
  sanitizeChaseInputs,
} from '../utils/verdictInputs';
import { PageIntro } from './PageShell';
import { BookmarkIcon } from './SaveTripControl';
import type { CardConfig } from '../types';

const cards = cardsData as CardConfig[];
const DRAG_TYPE = 'application/x-pointcompass-trip';

function describeOption(option: PointsOption | null): string {
  if (!option) return 'None your points cover';
  if (option.kind === 'transfer') return `Transfer to ${option.partner?.name ?? 'partner'} from ${ISSUER_LABELS[option.issuer]}`;
  if (option.kind === 'chaseTravel') return 'Chase Travel';
  return `${ISSUER_LABELS[option.issuer]} travel portal`;
}

function formatSavedOn(iso: string): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Loads a saved trip back into Check a trip.
function openTrip(trip: SavedTrip) {
  try {
    localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trip.inputs));
  } catch {
    // Without storage the trip can't be carried over; Check a trip opens empty.
  }
  navigate('/app');
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

interface TripCardProps {
  trip: SavedTrip;
  verdict: VerdictResult | null;
  selected: boolean;
  onToggle: () => void;
}

// A saved trip. Clicking anywhere on it (other than its buttons) adds it to or
// removes it from the comparison; it can also be dragged there.
function TripCard({ trip, verdict, selected, onToggle }: TripCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { inputs } = trip;
  const program = inputs.selectedPartnerId ? partnerName(inputs.selectedPartnerId) : null;

  const onClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button, a, input')) return;
    onToggle();
  };
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, trip.id);
    event.dataTransfer.setData('text/plain', trip.name);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`group relative flex w-64 shrink-0 cursor-pointer select-none flex-col rounded-3xl border bg-white p-5 shadow-card transition-[box-shadow,border-color] hover:shadow-card-hover motion-reduce:transition-none ${
        selected ? 'border-navy ring-2 ring-navy' : 'border-navy/10'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-medium text-navy-950" title={trip.name}>
            {trip.name}
          </p>
          <p className="text-xs text-navy-950/45">Saved {formatSavedOn(trip.savedOn)}</p>
        </div>
        <label className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Compare ${trip.name}`}
            className={`peer absolute inset-0 cursor-pointer appearance-none rounded-full border-2 ${
              selected ? 'border-navy bg-navy' : 'border-navy/25 bg-white group-hover:border-navy/50'
            } ${FOCUS_RING}`}
          />
          <span className={`pointer-events-none relative text-slate-50 ${selected ? '' : 'hidden'}`}>
            <CheckIcon />
          </span>
        </label>
      </div>

      <p className="mt-4 font-mono text-2xl text-navy-950">{formatUSD(inputs.tripCashPrice)}</p>
      <dl className="mt-2 space-y-1 text-xs text-navy-950/60">
        {program && (
          <div className="flex justify-between gap-2">
            <dt className="truncate">{program}</dt>
            <dd className="shrink-0 font-mono">{inputs.pointsRequired ? `${formatPoints(inputs.pointsRequired)} pts` : '—'}</dd>
          </div>
        )}
        {inputs.chaseTravelPoints > 0 && (
          <div className="flex justify-between gap-2">
            <dt>Chase Travel</dt>
            <dd className="font-mono">{formatPoints(inputs.chaseTravelPoints)} pts</dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-sm font-medium text-navy-950">
        {verdict ? verdictHeadline(verdict) : <span className="font-normal text-navy-950/45">No recommendation yet</span>}
      </p>

      <div className="mt-4 flex items-center gap-1 border-t border-navy/10 pt-3 text-sm">
        {confirmingDelete ? (
          <>
            <span className="mr-auto text-navy-950/60">Delete this trip?</span>
            <button type="button" onClick={() => deleteTrip(trip.id)} className={`rounded-full px-3 font-medium text-red hover:bg-red/5 ${TAP_TARGET} ${FOCUS_RING}`}>
              Delete
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className={`rounded-full px-3 font-medium text-navy-950/60 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => openTrip(trip)} className={`mr-auto rounded-full px-3 font-medium text-navy hover:bg-navy/5 ${TAP_TARGET} ${FOCUS_RING}`}>
              Open
            </button>
            <button type="button" onClick={() => setConfirmingDelete(true)} className={`rounded-full px-3 font-medium text-navy-950/50 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

interface Row {
  label: string;
  value: (trip: SavedTrip, verdict: VerdictResult | null) => React.ReactNode;
}

const dash = <span className="text-navy-950/30">—</span>;

const ROWS: Row[] = [
  { label: 'Trip cash price', value: (t) => <span className="font-mono">{formatUSD(t.inputs.tripCashPrice)}</span> },
  {
    label: 'Award price entered',
    value: (t) =>
      t.inputs.selectedPartnerId && t.inputs.pointsRequired > 0 ? (
        <>
          <span className="font-mono">{formatPoints(t.inputs.pointsRequired)}</span>{' '}
          <span className="text-navy-950/55">{partnerName(t.inputs.selectedPartnerId)}</span>
        </>
      ) : (
        dash
      ),
  },
  { label: 'Best way with points', value: (_, v) => (v ? describeOption(v.bestOption) : dash) },
  {
    label: 'Points needed',
    value: (_, v) => (v?.bestOption ? <span className="font-mono">{formatPoints(v.bestOption.pointsUsed)}</span> : dash),
  },
  {
    label: 'Cash still due',
    value: (_, v) => (v?.bestOption ? <span className="font-mono">{formatUSD(v.bestOption.cashFees)}</span> : dash),
  },
  {
    label: 'If you pay cash',
    value: (_, v) => (v ? describeRunway(v.runway.payCash) : dash),
  },
  {
    label: 'Chase Travel worth it at',
    value: (_, v) =>
      v?.chaseTravel ? (
        <>
          <span className="font-mono">{formatPoints(v.chaseTravel.breakevenPoints)}</span> <span className="text-navy-950/55">pts or fewer</span>
        </>
      ) : (
        dash
      ),
  },
];

export function TripsView() {
  const trips = useSavedTrips();
  const compareIds = useCompareIds();
  const { balances, ownership, basis } = useCardBalances();
  const [cashInputs] = usePersistentState(CASH_STORAGE_KEY, EMPTY_CASH_INPUTS, sanitizeCashInputs);
  const [chaseInputs] = usePersistentState(CHASE_STORAGE_KEY, EMPTY_CHASE_INPUTS, sanitizeChaseInputs);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState('');

  const ownedCards = useMemo(() => cards.filter((card) => ownership[card.id]), [ownership]);
  const verdicts = useMemo(
    () =>
      new Map(
        trips.map((trip) => [trip.id, evaluateTrip(trip.inputs, { ownedCards, balances, basis, cash: cashInputs, chase: chaseInputs })]),
      ),
    [trips, ownedCards, balances, basis, cashInputs, chaseInputs],
  );
  const compared = compareIds.map((id) => trips.find((t) => t.id === id)!).filter(Boolean);
  const anyVerdict = trips.some((t) => verdicts.get(t.id));

  const add = (id: string) => {
    if (addToCompare(id)) setNotice('');
    else setNotice(`You can compare up to ${MAX_COMPARE} trips. Remove one to add another.`);
  };
  const toggle = (id: string) => {
    if (compareIds.includes(id)) {
      removeFromCompare(id);
      setNotice('');
    } else add(id);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (id) add(id);
  };
  const dropProps = {
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    },
    onDragLeave: (event: DragEvent) => {
      if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) setDragOver(false);
    },
    onDrop,
  };

  // The best value per point among the compared trips, measured against each
  // currency's usual value so different banks' points compare fairly.
  const ratios = compared.map((t) => verdicts.get(t.id)?.bestOption?.benchmarkRatio ?? null);
  const finiteRatios = ratios.filter((r): r is number => r !== null && Number.isFinite(r));
  const bestRatio = compared.length > 1 && finiteRatios.length > 0 ? Math.max(...finiteRatios) : null;

  // The empty column beside the compared trips, while there's room for more.
  const slot = compared.length < MAX_COMPARE ? <td className="border-l border-navy/10 bg-white" /> : null;

  return (
    <>
      <PageIntro title="My trips">
        <p>
          Trips you saved from Check a trip, kept in this browser only. Click or drag trips into the
          comparison to see them side by side.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {trips.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-navy/20 bg-white px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-navy">
              <BookmarkIcon />
            </div>
            <p className="font-display text-lg text-navy-950">No saved trips yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-navy-950/55">
              Check a trip, then choose “Save this trip” above the recommendation to keep it here.
            </p>
            <a
              href="/app"
              onClick={linkHandler('/app')}
              className={`mt-5 inline-flex items-center rounded-full bg-navy px-5 text-sm font-semibold text-slate-50 hover:bg-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}
            >
              Check a trip
            </a>
          </div>
        ) : (
          <>
            <section aria-labelledby="saved-heading">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="saved-heading" className="font-display text-xl font-medium text-navy-950">
                  Saved trips <span className="font-mono text-base text-navy-950/40">{trips.length}</span>
                </h2>
                <p className="hidden text-sm text-navy-950/50 sm:block">Click a trip or drag it into the comparison.</p>
              </div>
              {/* A strip, so the comparison below stays in view while dragging. */}
              <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 pt-1 sm:-mx-6 sm:px-6">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    verdict={verdicts.get(trip.id) ?? null}
                    selected={compareIds.includes(trip.id)}
                    onToggle={() => toggle(trip.id)}
                  />
                ))}
              </ul>
            </section>

            <section aria-labelledby="compare-heading" className="mt-8" {...dropProps}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="compare-heading" className="font-display text-xl font-medium text-navy-950">
                  Compare <span className="font-mono text-base text-navy-950/40">{compared.length}/{MAX_COMPARE}</span>
                </h2>
                {compared.length > 0 && (
                  <button type="button" onClick={clearCompare} className={`rounded-full px-3 text-sm font-medium text-navy-950/55 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
                    Clear comparison
                  </button>
                )}
              </div>
              <p role="status" className="mb-3 min-h-5 text-sm text-amber">
                {notice}
              </p>

              {!anyVerdict && compared.length > 0 && (
                <p className="mb-4 rounded-2xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm text-navy-950/75">
                  Add your cash position in{' '}
                  <a href="/app" onClick={linkHandler('/app')} className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}>
                    Check a trip
                  </a>{' '}
                  to see a recommendation for each trip.
                </p>
              )}

              {compared.length === 0 ? (
                <div
                  className={`rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors motion-reduce:transition-none ${
                    dragOver ? 'border-navy bg-navy/5' : 'border-navy/20 bg-white'
                  }`}
                >
                  <p className="font-display text-lg text-navy-950">Drop trips here to compare</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-navy-950/55">
                    Or click any saved trip. Up to {MAX_COMPARE} side by side.
                  </p>
                </div>
              ) : (
                <div className={`${CARD_SURFACE} overflow-hidden p-0 hover:shadow-card ${dragOver ? 'ring-2 ring-navy' : ''}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <caption className="sr-only">Saved trips side by side</caption>
                      <thead>
                        <tr className="align-top">
                          <th scope="col" className="sticky left-0 z-10 w-36 min-w-36 bg-navy-100 p-4">
                            <span className={LABEL}>Trip</span>
                          </th>
                          {compared.map((trip, i) => {
                            const best = bestRatio !== null && ratios[i] === bestRatio;
                            return (
                              <th key={trip.id} scope="col" className="min-w-44 border-l border-navy/10 bg-white p-4 font-normal">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-display text-base font-medium leading-snug text-navy-950">{trip.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeFromCompare(trip.id)}
                                    aria-label={`Remove ${trip.name} from comparison`}
                                    className={`-mr-2 -mt-2 flex shrink-0 items-center justify-center rounded-full text-navy-950/40 hover:bg-navy/5 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                                      <path d="M6 6l12 12M18 6 6 18" />
                                    </svg>
                                  </button>
                                </div>
                                {best && (
                                  <span className="mt-1 inline-block rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">Best value per point</span>
                                )}
                              </th>
                            );
                          })}
                          {compared.length < MAX_COMPARE && (
                            <th scope="col" className="min-w-44 border-l border-navy/10 bg-white p-4 font-normal">
                              <div className={`rounded-2xl border-2 border-dashed px-3 py-4 text-center text-sm ${dragOver ? 'border-navy bg-navy/5 text-navy-950' : 'border-navy/15 text-navy-950/45'}`}>
                                Drag or click another trip to add it
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-navy/10 align-top">
                          <th scope="row" className="sticky left-0 z-10 bg-navy-100 p-4 font-normal">
                            <span className={LABEL}>Recommendation</span>
                          </th>
                          {compared.map((trip) => {
                            const v = verdicts.get(trip.id) ?? null;
                            return (
                              <td key={trip.id} className="border-l border-navy/10 bg-white p-4">
                                {v ? (
                                  <span className="inline-block rounded-xl bg-gradient-to-br from-navy-950 to-navy px-3 py-1.5 font-display text-sm font-semibold text-slate-50">
                                    {verdictHeadline(v)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                            );
                          })}
                          {slot}
                        </tr>
                        <tr className="border-t border-navy/10 align-top">
                          <th scope="row" className="sticky left-0 z-10 bg-navy-100 p-4 font-normal">
                            <span className={LABEL}>Value per point</span>
                          </th>
                          {compared.map((trip, i) => {
                            const option = verdicts.get(trip.id)?.bestOption;
                            const best = bestRatio !== null && ratios[i] === bestRatio;
                            return (
                              <td key={trip.id} className="border-l border-navy/10 bg-white p-4">
                                {option?.cppCents != null ? (
                                  <>
                                    <span className={`font-mono text-base ${best ? 'font-semibold text-teal' : 'text-navy-950'}`}>{formatCents(option.cppCents)}</span>
                                    <span className="block text-xs text-navy-950/50">
                                      {Number.isFinite(option.benchmarkRatio) ? `${option.benchmarkRatio.toFixed(2)}× their usual value` : ''}
                                    </span>
                                  </>
                                ) : (
                                  dash
                                )}
                              </td>
                            );
                          })}
                          {slot}
                        </tr>
                        {ROWS.map((row) => (
                          <tr key={row.label} className="border-t border-navy/10 align-top">
                            <th scope="row" className="sticky left-0 z-10 bg-navy-100 p-4 font-normal">
                              <span className={LABEL}>{row.label}</span>
                            </th>
                            {compared.map((trip) => (
                              <td key={trip.id} className="border-l border-navy/10 bg-white p-4 text-navy-950">
                                {row.value(trip, verdicts.get(trip.id) ?? null)}
                              </td>
                            ))}
                            {slot}
                          </tr>
                        ))}
                        <tr className="border-t border-navy/10">
                          <th scope="row" className="sticky left-0 z-10 bg-navy-100 p-4 font-normal">
                            <span className="sr-only">Actions</span>
                          </th>
                          {compared.map((trip) => (
                            <td key={trip.id} className="border-l border-navy/10 bg-white p-4 pt-2">
                              <button type="button" onClick={() => openTrip(trip)} className={`rounded-full px-3 text-sm font-medium text-navy hover:bg-navy/5 ${TAP_TARGET} ${FOCUS_RING} -ml-3`}>
                                Open in Check a trip
                              </button>
                            </td>
                          ))}
                          {slot}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-navy/10 bg-white px-4 py-3 text-xs text-navy-950/50">
                    Worked out with your current cards, balances and cash position, so a trip saved
                    weeks ago reflects today’s numbers.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
