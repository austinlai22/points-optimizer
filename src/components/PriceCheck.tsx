import { useState, type FormEvent } from 'react';
import { formatCents } from '../lib/verdict';
import type { VerdictResult } from '../lib/verdict/types';
import {
  BOOKING_TYPES,
  CABINS,
  impliedCpp,
  validateReport,
  type BookingType,
  type BoostAnswer,
  type Cabin,
} from '../lib/reports/validate';
import { linkHandler } from '../lib/router';
import { CARD_SURFACE, FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import { formatPoints, parseNonNegativeNumber } from '../utils/format';

const BOOST_LABELS: Record<BoostAnswer, string> = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
const CABIN_LABELS: Record<Cabin, string> = {
  economy: 'Economy',
  premium_economy: 'Premium economy',
  business: 'Business',
  first: 'First',
};

interface PriceCheckProps {
  verdict: VerdictResult;
  tripCashPrice: number;
  points: number;
  onPointsChange: (points: number) => void;
  boost: BoostAnswer | null;
  onBoostChange: (answer: BoostAnswer) => void;
}

function pill(active: boolean) {
  return `rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING} ${
    active ? 'border-navy bg-navy text-slate-50' : 'border-navy/15 bg-white text-navy-950/65 hover:border-navy/35'
  }`;
}

const toCode = (value: string) => value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// After a recommendation: check the points price Chase Travel actually shows,
// and, only if the person ticks the box, share it anonymously.
export function PriceCheck({ verdict, tripCashPrice, points, onPointsChange, boost, onBoostChange }: PriceCheckProps) {
  const chase = verdict.chaseTravel!;
  const [sharing, setSharing] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType>('flight');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelMonth, setTravelMonth] = useState('');
  const [cabin, setCabin] = useState<Cabin | ''>('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ kind: 'idle' });

  const report = {
    card_type: chase.cardType,
    booking_type: bookingType,
    origin: bookingType === 'flight' ? origin : null,
    destination,
    travel_month: travelMonth,
    cabin: bookingType === 'flight' && cabin ? cabin : null,
    cash_price_usd: tripCashPrice,
    chase_points_price: points,
    boost_shown: boost ?? 'unsure',
  };
  // The same check the server runs, so most mistakes show before sending.
  const check = validateReport(report, new Date().toISOString().slice(0, 10));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!check.ok || boost === null) return;
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (response.ok) {
        setStatus({ kind: 'sent' });
        setSharing(false);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus({ kind: 'error', message: body.error ?? 'The price could not be shared. Please try again later.' });
    } catch {
      setStatus({ kind: 'error', message: 'The price could not be shared. Please try again later.' });
    }
  };

  return (
    <section aria-labelledby="price-check-heading" className={`${CARD_SURFACE} mb-10 p-6`}>
      <h2 id="price-check-heading" className="font-display text-lg font-medium text-navy-950">
        Seeing this trip in Chase Travel?
      </h2>
      <p className="mt-1 text-sm text-navy-950/60">Enter the points price to check it.</p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="chase-travel-points" className={`mb-1.5 block ${LABEL}`}>
            Chase Travel price in points
          </label>
          <input
            id="chase-travel-points"
            type="number"
            min={0}
            inputMode="numeric"
            value={points || ''}
            onChange={(event) => {
              onPointsChange(parseNonNegativeNumber(event.target.value));
              setStatus({ kind: 'idle' });
            }}
            placeholder={formatPoints(Math.round(chase.nonBoostPoints))}
            className={`${FIELD} bg-white ${TAP_TARGET} ${FOCUS_RING}`}
          />
        </div>
        <div>
          <p id="boost-shown-label" className={`mb-1.5 ${LABEL}`}>
            Did it show a Points Boost offer?
          </p>
          <div role="group" aria-labelledby="boost-shown-label" className="flex flex-wrap gap-2">
            {(Object.keys(BOOST_LABELS) as BoostAnswer[]).map((answer) => (
              <button key={answer} type="button" aria-pressed={boost === answer} onClick={() => onBoostChange(answer)} className={pill(boost === answer)}>
                {BOOST_LABELS[answer]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {points > 0 && (
        <p className="mt-4 text-sm text-navy-950/70">
          At {formatPoints(points)} points this trip returns{' '}
          <span className="font-mono text-navy-950">{formatCents(impliedCpp(tripCashPrice, points))}</span> per
          point. The highest price worth accepting is{' '}
          <span className="font-mono text-navy-950">{formatPoints(chase.breakevenPoints)}</span> points, and the
          recommendation above now uses your price.
        </p>
      )}

      {points > 0 && (
        <div className="mt-6 border-t border-navy/10 pt-5">
          {status.kind === 'sent' ? (
            <p className="text-sm font-medium text-teal" role="status">
              Thank you. Your price has been shared anonymously.
            </p>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-navy-950/75">
              <input
                type="checkbox"
                checked={sharing}
                onChange={(event) => setSharing(event.target.checked)}
                className={`mt-0.5 h-5 w-5 shrink-0 accent-navy ${FOCUS_RING}`}
              />
              <span>
                Share this price anonymously to help others see what Chase Travel charges. We don't
                store your balances, cash figures or anything that identifies you.{' '}
                <a href="/privacy" onClick={linkHandler('/privacy')} className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}>
                  Privacy
                </a>
              </span>
            </label>
          )}

          {sharing && (
            <form onSubmit={submit} className="mt-5 space-y-5 rounded-2xl border border-navy/10 bg-white p-5" noValidate>
              <p className="text-sm text-navy-950/60">
                A few details make the price useful to others. Only these fields, the card type and
                the two prices are shared.
              </p>
              <div>
                <p id="booking-type-label" className={`mb-1.5 ${LABEL}`}>
                  Flight or hotel
                </p>
                <div role="group" aria-labelledby="booking-type-label" className="flex gap-2">
                  {BOOKING_TYPES.map((type) => (
                    <button key={type} type="button" aria-pressed={bookingType === type} onClick={() => setBookingType(type)} className={pill(bookingType === type)}>
                      {type === 'flight' ? 'Flight' : 'Hotel'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {bookingType === 'flight' && (
                  <div>
                    <label htmlFor="report-origin" className={`mb-1.5 block ${LABEL}`}>
                      From (airport code)
                    </label>
                    <input id="report-origin" value={origin} onChange={(e) => setOrigin(toCode(e.target.value))} placeholder="JFK" autoComplete="off" className={`${FIELD} uppercase ${TAP_TARGET} ${FOCUS_RING}`} />
                  </div>
                )}
                <div>
                  <label htmlFor="report-destination" className={`mb-1.5 block ${LABEL}`}>
                    {bookingType === 'flight' ? 'To (airport code)' : 'City (airport or city code)'}
                  </label>
                  <input id="report-destination" value={destination} onChange={(e) => setDestination(toCode(e.target.value))} placeholder={bookingType === 'flight' ? 'LIS' : 'PAR'} autoComplete="off" className={`${FIELD} uppercase ${TAP_TARGET} ${FOCUS_RING}`} />
                </div>
                <div>
                  <label htmlFor="report-month" className={`mb-1.5 block ${LABEL}`}>
                    Travel month
                  </label>
                  <input id="report-month" type="month" value={travelMonth} min={thisMonth()} onChange={(e) => setTravelMonth(e.target.value)} className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`} />
                </div>
                {bookingType === 'flight' && (
                  <div>
                    <label htmlFor="report-cabin" className={`mb-1.5 block ${LABEL}`}>
                      Cabin <span className="normal-case text-navy-950/40">(optional)</span>
                    </label>
                    <select id="report-cabin" value={cabin} onChange={(e) => setCabin(e.target.value as Cabin | '')} className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}>
                      <option value="">Not specified</option>
                      {CABINS.map((c) => (
                        <option key={c} value={c}>
                          {CABIN_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {boost === null && (
                <p className="text-sm text-navy-950/60">Answer the Points Boost question above to share.</p>
              )}
              {!check.ok && check.reason === 'out_of_range' && (
                <p className="text-sm text-amber" role="alert">
                  {check.errors[0]}
                </p>
              )}
              {status.kind === 'error' && (
                <p className="text-sm text-amber" role="alert">
                  {status.message}
                </p>
              )}

              <button
                type="submit"
                disabled={!check.ok || boost === null || status.kind === 'sending'}
                className={`rounded-full bg-navy px-6 text-sm font-semibold text-slate-50 transition-colors hover:bg-navy-950 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
              >
                {status.kind === 'sending' ? 'Sharing…' : 'Share price'}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
