import { useState, type FormEvent } from 'react';
import { linkHandler } from '../lib/router';
import { MAX_SAVED_TRIPS, saveTrip, useSavedTrips, type TripInputs } from '../lib/trips';
import type { VerdictResult } from '../lib/verdict/types';
import { FIELD, FOCUS_RING, TAP_TARGET } from '../styles/constants';

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.5 1.1 4.8 2.8C13.3 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" />
    </svg>
  );
}

const sameInputs = (a: TripInputs, b: TripInputs) =>
  (Object.keys(a) as (keyof TripInputs)[]).every((key) => a[key] === b[key]);

// Keep this trip for later, in this browser only. Separate from sharing a
// price report: nothing here leaves the device.
export function SaveTripControl({ inputs, verdict, defaultName }: { inputs: TripInputs; verdict: VerdictResult | null; defaultName: string }) {
  const trips = useSavedTrips();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const existing = trips.find((t) => sameInputs(t.inputs, inputs));
  const full = trips.length >= MAX_SAVED_TRIPS;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The recommendation is kept with the trip, to fall back on later.
    if (saveTrip(name || defaultName, inputs, verdict)) setNaming(false);
  };

  const viewLink = (
    <a href="/trips" onClick={linkHandler('/trips')} className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}>
      View My trips
    </a>
  );

  return (
    <div className="mb-4 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {existing && !naming ? (
        <>
          <span className="inline-flex items-center gap-1.5 font-medium text-navy-950/75">
            <HeartIcon filled /> Saved as “{existing.name}”
          </span>
          {viewLink}
        </>
      ) : naming ? (
        <form onSubmit={submit} className="flex w-full flex-wrap items-center gap-2">
          <label htmlFor="save-trip-name" className="sr-only">
            Name this trip
          </label>
          <input
            id="save-trip-name"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName}
            className={`${FIELD} min-w-0 flex-1 bg-white font-sans ${TAP_TARGET} ${FOCUS_RING}`}
          />
          <button type="submit" className={`rounded-full bg-navy px-5 font-semibold text-slate-50 hover:bg-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
            Save
          </button>
          <button type="button" onClick={() => setNaming(false)} className={`rounded-full px-3 font-medium text-navy-950/60 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
            Cancel
          </button>
        </form>
      ) : full ? (
        <span className="text-navy-950/60">
          You have {MAX_SAVED_TRIPS} saved trips, the most this browser keeps. Delete one in {viewLink} to save this.
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setName('');
              setNaming(true);
            }}
            className={`inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white px-4 font-medium text-navy-950/80 transition-colors hover:border-navy/40 hover:text-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
          >
            <HeartIcon /> Save this trip
          </button>
          <span className="text-xs text-navy-950/50">Kept in this browser only, to look back at or compare.</span>
        </>
      )}
    </div>
  );
}
