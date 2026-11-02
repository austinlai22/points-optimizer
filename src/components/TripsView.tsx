import { useMemo, useState, type DragEvent, type MouseEvent } from 'react';
import cardsData from '../data/cards.json';
import { useCardBalances } from '../context/CardBalancesContext';
import { verdictHeadline } from '../lib/verdict';
import type { VerdictResult } from '../lib/verdict/types';
import { linkHandler } from '../lib/router';
import {
  MAX_COMPARE,
  addToCompare,
  clearCompare,
  deleteTrip,
  evaluateTrip,
  openTrip,
  saveTrip,
  unsavedCurrentTrip,
  updateTrip,
  partnerName,
  removeFromCompare,
  useCompareIds,
  useSavedTrips,
  type SavedTrip,
  type TripInputs,
} from '../lib/trips';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';
import { formatPoints, formatUSD } from '../utils/format';
import { usePersistentState } from '../utils/usePersistentState';
import { track } from '../utils/analytics';
import {
  CASH_STORAGE_KEY,
  CHASE_STORAGE_KEY,
  EMPTY_CASH_INPUTS,
  EMPTY_CHASE_INPUTS,
  sanitizeCashInputs,
  sanitizeChaseInputs,
} from '../utils/verdictInputs';
import { PageIntro } from './PageShell';
import { HeartIcon } from './SaveTripControl';
import { TripComparison } from './TripComparison';
import type { CardConfig } from '../types';

const cards = cardsData as CardConfig[];
const DRAG_TYPE = 'application/x-pointcompass-trip';

function formatSavedOn(iso: string): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Opens the trip in Check a trip: an arrow out of a box.
function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7M10 11v6M14 11v6" />
    </svg>
  );
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
  onOpen: () => void;
}

// A saved trip. Clicking anywhere on it (other than its buttons) adds it to or
// removes it from the comparison; it can also be dragged there.
function TripCard({ trip, verdict, selected, onToggle, onOpen }: TripCardProps) {
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
          <p className="text-xs text-navy-950/45">
            {trip.updatedOn ? `Updated ${formatSavedOn(trip.updatedOn)}` : `Saved ${formatSavedOn(trip.savedOn)}`}
          </p>
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
            <button type="button" onClick={() => deleteTrip(trip.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 font-medium text-red hover:bg-red/5 ${TAP_TARGET} ${FOCUS_RING}`}>
              <TrashIcon /> Delete
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className={`rounded-full px-3 font-medium text-navy-950/60 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onOpen} className={`mr-auto inline-flex items-center gap-1.5 rounded-full px-3 font-medium text-navy hover:bg-navy/5 ${TAP_TARGET} ${FOCUS_RING}`}>
              <OpenIcon /> Open
            </button>
            <button type="button" onClick={() => setConfirmingDelete(true)} className={`inline-flex items-center gap-1.5 rounded-full px-3 font-medium text-navy-950/50 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
              <TrashIcon /> Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export function TripsView() {
  const trips = useSavedTrips();
  const compareIds = useCompareIds();
  const { balances, ownership, basis } = useCardBalances();
  const [cashInputs] = usePersistentState(CASH_STORAGE_KEY, EMPTY_CASH_INPUTS, sanitizeCashInputs);
  const [chaseInputs] = usePersistentState(CHASE_STORAGE_KEY, EMPTY_CHASE_INPUTS, sanitizeChaseInputs);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState('');
  // A trip waiting to be opened while Check a trip holds an unsaved one.
  const [pendingOpen, setPendingOpen] = useState<{ trip: SavedTrip; current: { inputs: TripInputs; editing: SavedTrip | null } } | null>(null);

  const requestOpen = (trip: SavedTrip) => {
    const current = unsavedCurrentTrip(trip);
    if (current) setPendingOpen({ trip, current });
    else openTrip(trip);
  };
  const saveCurrentThenOpen = () => {
    if (!pendingOpen) return;
    const { trip, current } = pendingOpen;
    // Changes to a saved trip update it; anything else is saved as new.
    if (current.editing) updateTrip(current.editing.id, current.inputs);
    else {
      const { inputs } = current;
      const program = inputs.selectedPartnerId ? partnerName(inputs.selectedPartnerId) : null;
      saveTrip(program ? `${program}, ${formatUSD(inputs.tripCashPrice)}` : `Trip, ${formatUSD(inputs.tripCashPrice)}`, inputs);
      track({ event: 'trip_saved' });
    }
    openTrip(trip);
  };

  const ownedCards = useMemo(() => cards.filter((card) => ownership[card.id]), [ownership]);
  const heldIssuers = useMemo(() => [...new Set(ownedCards.filter((card) => card.transferEligible).map((card) => card.issuer))], [ownedCards]);
  const verdicts = useMemo(
    () =>
      new Map(
        trips.map((trip) => [trip.id, evaluateTrip(trip.inputs, { ownedCards, balances, basis, cash: cashInputs, chase: chaseInputs })]),
      ),
    [trips, ownedCards, balances, basis, cashInputs, chaseInputs],
  );
  const compared = compareIds.map((id) => trips.find((t) => t.id === id)!).filter(Boolean);
  const cashMissing = trips.some((t) => verdicts.get(t.id)?.cashConsidered === false);

  const add = (id: string) => {
    const before = compareIds.length;
    if (addToCompare(id)) {
      setNotice('');
      // Counted once per comparison: when it reaches two trips.
      if (before === 1 && !compareIds.includes(id)) track({ event: 'trips_compared' });
    }
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
              <HeartIcon />
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
                    onOpen={() => requestOpen(trip)}
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

              {cashMissing && compared.length > 0 && (
                <p className="mb-4 text-sm text-navy-950/55">
                  Recommendations are on value alone. Add your cash position in{' '}
                  <a href="/app" onClick={linkHandler('/app')} className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}>
                    Check a trip
                  </a>{' '}
                  to also check whether paying cash would leave you stretched.
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
                <TripComparison trips={compared} verdicts={verdicts} heldIssuers={heldIssuers} dragOver={dragOver} onOpen={requestOpen} />
              )}
            </section>
          </>
        )}
      </div>

      {pendingOpen && (
        <div
          role="alertdialog"
          aria-labelledby="replace-heading"
          onKeyDown={(event) => event.key === 'Escape' && setPendingOpen(null)}
          className="fixed inset-x-4 bottom-5 z-40 mx-auto max-w-xl rounded-3xl bg-navy p-5 text-slate-50 shadow-control sm:inset-x-6"
        >
          <p id="replace-heading" className="font-display text-base font-medium">
            Replace the trip in Check a trip?
          </p>
          <p className="mt-1 text-sm text-slate-50/70">
            {pendingOpen.current.editing?.id === pendingOpen.trip.id
              ? `It has unsaved changes to “${pendingOpen.trip.name}”. Opening it again will undo them.`
              : pendingOpen.current.editing
                ? `It has unsaved changes to “${pendingOpen.current.editing.name}”. Opening “${pendingOpen.trip.name}” will replace them.`
                : `It has an unsaved ${formatUSD(pendingOpen.current.inputs.tripCashPrice)} trip. Opening “${pendingOpen.trip.name}” will replace it.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" autoFocus onClick={saveCurrentThenOpen} className={`rounded-full bg-slate-50 px-4 text-sm font-semibold text-navy ${TAP_TARGET} ${FOCUS_RING}`}>
              {pendingOpen.current.editing ? 'Update it first' : 'Save it first'}
            </button>
            <button type="button" onClick={() => openTrip(pendingOpen.trip)} className={`rounded-full border border-slate-50/30 px-4 text-sm font-medium ${TAP_TARGET} ${FOCUS_RING}`}>
              Replace it
            </button>
            <button type="button" onClick={() => setPendingOpen(null)} className={`rounded-full px-4 text-sm font-medium text-slate-50/70 hover:text-slate-50 ${TAP_TARGET} ${FOCUS_RING}`}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
