import { useState, type FormEvent } from 'react';
import { formatCents } from '../lib/verdict';
import type { VerdictResult } from '../lib/verdict/types';
import {
  BOOKING_TYPES,
  CABINS,
  TRIP_TYPES,
  impliedCpp,
  validateReport,
  type BookingType,
  type BoostAnswer,
  type Cabin,
  type TripType,
} from '../lib/reports/validate';
import { linkHandler } from '../lib/router';
import { AIRLINES_BY_PROGRAM, HOTEL_CHAINS, TRACKED_AIRLINES, isTrackedHotelChain } from '../lib/reports/brands';
import { faresFor, findFare } from '../lib/reports/fares';
import { CARD_SURFACE, FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import type { TransferPartner } from '../types';
import { formatPoints, parseNonNegativeNumber } from '../utils/format';
import { AirportField } from './AirportField';
import { MonthPicker } from './MonthPicker';
import reportConfig from '../data/report-config.json';

const BOOST_LABELS: Record<BoostAnswer, string> = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
const TRIP_LABELS: Record<TripType, string> = { one_way: 'One way', round_trip: 'Round trip' };
const CABIN_LABELS: Record<Cabin, string> = {
  basic_economy: 'Basic economy',
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
  // The program picked in step 1, used to fill in flight or hotel and the
  // airline or chain. Re-mount (key) when it changes.
  program?: TransferPartner | null;
}

function pill(active: boolean) {
  return `rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING} ${
    active ? 'border-navy bg-navy text-slate-50' : 'border-navy/15 bg-white text-navy-950/65 hover:border-navy/35'
  }`;
}

function daysIn(yyyyMm: string): number {
  return new Date(Number(yyyyMm.slice(0, 4)), Number(yyyyMm.slice(5, 7)), 0).getDate();
}

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function startingChoices(program: TransferPartner | null | undefined) {
  if (program?.type === 'hotel') {
    return { bookingType: 'hotel' as BookingType, airline: '', hotelChain: isTrackedHotelChain(program.id) ? program.id : '' };
  }
  // A program covering two airlines (Flying Blue, Atmos) leaves the choice open.
  const airlines = program ? (AIRLINES_BY_PROGRAM[program.id] ?? []) : [];
  return { bookingType: 'flight' as BookingType, airline: airlines.length === 1 ? airlines[0].code : '', hotelChain: '' };
}

// A second price for the same trip: its own fare, cash price, points price and
// Boost answer, without changing the recommendation above.
interface AnotherFare {
  cash: number;
  points: number;
  boost: BoostAnswer | null;
}

// After a recommendation: check the points price Chase Travel actually shows,
// and, only if the person ticks the box, share it anonymously.
export function PriceCheck({ verdict, tripCashPrice, points, onPointsChange, boost, onBoostChange, program }: PriceCheckProps) {
  const chase = verdict.chaseTravel!;
  const start = startingChoices(program);
  const [sharing, setSharing] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType>(start.bookingType);
  const [tripType, setTripType] = useState<TripType | ''>('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelMonth, setTravelMonth] = useState('');
  const [travelDay, setTravelDay] = useState('');
  const [airline, setAirline] = useState(start.airline);
  const [fare, setFare] = useState('');
  // A fare missing from the airline's list: pick the shared cabin instead.
  const [otherFare, setOtherFare] = useState(false);
  const [cabin, setCabin] = useState<Cabin | ''>('');
  const [hotelChain, setHotelChain] = useState(start.hotelChain);
  const [another, setAnother] = useState<AnotherFare | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ kind: 'idle' });

  const isFlight = bookingType === 'flight';
  const fares = isFlight ? faresFor(airline) : [];
  const reportBoost = another ? another.boost : boost;
  const report = {
    card_type: chase.cardType,
    booking_type: bookingType,
    origin: isFlight ? origin : null,
    destination,
    trip_type: isFlight && tripType ? tripType : null,
    travel_month: travelMonth,
    travel_date: travelMonth && travelDay ? `${travelMonth}-${travelDay}` : null,
    // With a fare chosen, the cabin follows from it.
    cabin: isFlight && !fare && cabin ? cabin : null,
    airline: isFlight && airline ? airline : null,
    fare: isFlight && fare ? fare : null,
    hotel_chain: !isFlight && hotelChain ? hotelChain : null,
    cash_price_usd: another ? another.cash : tripCashPrice,
    chase_points_price: another ? another.points : points,
    boost_shown: reportBoost ?? 'unsure',
  };
  // The same check the server runs, so most mistakes show before sending.
  const check = validateReport(report, new Date().toISOString().slice(0, 10));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!check.ok || reportBoost === null) return;
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

  // Keeps the trip (route, month, airline or chain) and asks only for the
  // next fare's details.
  const shareAnother = () => {
    setAnother({ cash: 0, points: 0, boost: null });
    setFare('');
    setOtherFare(false);
    setCabin('');
    setStatus({ kind: 'idle' });
    setSharing(true);
  };

  const numberField = (id: string, label: string, value: number, onChange: (n: number) => void, prefix?: string) => (
    <div>
      <label htmlFor={id} className={`mb-1.5 block ${LABEL}`}>
        {label}
      </label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-navy-950/45">{prefix}</span>}
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          value={value || ''}
          onChange={(e) => onChange(parseNonNegativeNumber(e.target.value))}
          className={`${FIELD} bg-white ${prefix ? 'pl-7' : ''} ${TAP_TARGET} ${FOCUS_RING}`}
        />
      </div>
    </div>
  );

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
              if (!another) setStatus({ kind: 'idle' });
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <p className="text-sm font-medium text-teal" role="status">
                Thank you. Your price has been shared anonymously.
              </p>
              <button type="button" onClick={shareAnother} className={`rounded-full border border-navy/20 bg-white px-4 text-sm font-medium text-navy hover:border-navy/40 ${TAP_TARGET} ${FOCUS_RING}`}>
                Share another fare for this trip
              </button>
            </div>
          ) : another ? null : (
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
              {another ? (
                <>
                  <p className="text-sm text-navy-950/60">
                    Another fare for the same trip. Enter what Chase Travel shows for it.
                  </p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {numberField('another-cash', 'Cash price', another.cash, (cash) => setAnother({ ...another, cash }), '$')}
                    {numberField('another-points', 'Price in points', another.points, (p) => setAnother({ ...another, points: p }))}
                  </div>
                  <div>
                    <p id="another-boost-label" className={`mb-1.5 ${LABEL}`}>
                      Points Boost offer shown?
                    </p>
                    <div role="group" aria-labelledby="another-boost-label" className="flex flex-wrap gap-2">
                      {(Object.keys(BOOST_LABELS) as BoostAnswer[]).map((answer) => (
                        <button key={answer} type="button" aria-pressed={another.boost === answer} onClick={() => setAnother({ ...another, boost: answer })} className={pill(another.boost === answer)}>
                          {BOOST_LABELS[answer]}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-navy-950/60">
                  A few details make the price useful to others. Only these fields, the card type and
                  the two prices are shared.
                </p>
              )}

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

              {isFlight && (
                <div>
                  <p id="trip-type-label" className={`mb-1.5 ${LABEL}`}>
                    Prices for
                  </p>
                  <div role="group" aria-labelledby="trip-type-label" className="flex gap-2">
                    {TRIP_TYPES.map((t) => (
                      <button key={t} type="button" aria-pressed={tripType === t} onClick={() => setTripType(t)} className={pill(tripType === t)}>
                        {TRIP_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  {tripType === 'round_trip' && (
                    <p className="mt-1.5 text-xs text-navy-950/55">Pick the fare for the first flight. One-way prices are the most useful, as points bookings usually go one way at a time.</p>
                  )}
                </div>
              )}

              {isFlight ? (
                <div>
                  <label htmlFor="report-airline" className={`mb-1.5 block ${LABEL}`}>
                    Airline <span className="normal-case text-navy-950/40">(optional)</span>
                  </label>
                  <select
                    id="report-airline"
                    value={airline}
                    onChange={(e) => {
                      setAirline(e.target.value);
                      setFare('');
                      setOtherFare(false);
                    }}
                    className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}
                  >
                    <option value="">Not specified or not listed</option>
                    {TRACKED_AIRLINES.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="report-hotel-chain" className={`mb-1.5 block ${LABEL}`}>
                    Hotel chain <span className="normal-case text-navy-950/40">(optional)</span>
                  </label>
                  <select id="report-hotel-chain" value={hotelChain} onChange={(e) => setHotelChain(e.target.value)} className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}>
                    <option value="">Not specified</option>
                    {HOTEL_CHAINS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isFlight && (
                <div>
                  <p id="report-fare-label" className={`mb-1.5 ${LABEL}`}>
                    {fares.length > 0 ? 'Fare' : 'Cabin'} <span className="normal-case text-navy-950/40">(optional)</span>
                  </p>
                  {/* Tap again to clear. An airline's own fares where we list
                      them, with "Other fare" for one missing from the list;
                      otherwise the shared cabins. */}
                  {fares.length > 0 && (
                    <div role="group" aria-labelledby="report-fare-label" className="flex flex-wrap gap-2">
                      {fares.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={fare === f.id}
                          onClick={() => {
                            setFare(fare === f.id ? '' : f.id);
                            setOtherFare(false);
                          }}
                          className={pill(fare === f.id)}
                        >
                          {f.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-pressed={otherFare}
                        onClick={() => {
                          setOtherFare(!otherFare);
                          setFare('');
                          setCabin('');
                        }}
                        className={pill(otherFare)}
                      >
                        Other fare
                      </button>
                    </div>
                  )}
                  {(fares.length === 0 || otherFare) && (
                    <div role="group" {...(fares.length > 0 ? { 'aria-label': 'Cabin' } : { 'aria-labelledby': 'report-fare-label' })} className={`flex flex-wrap gap-2 ${fares.length > 0 ? 'mt-3' : ''}`}>
                      {CABINS.map((c) => (
                        <button key={c} type="button" aria-pressed={cabin === c} onClick={() => setCabin(cabin === c ? '' : c)} className={pill(cabin === c)}>
                          {CABIN_LABELS[c]}
                        </button>
                      ))}
                    </div>
                  )}
                  {fare && <p className="mt-1.5 text-xs text-navy-950/55">Counted as {CABIN_LABELS[findFare(airline, fare)!.cabin].toLowerCase()} when comparing airlines.</p>}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {isFlight && <AirportField id="report-origin" label="From" value={origin} onChange={setOrigin} />}
                <AirportField id="report-destination" label={isFlight ? 'To' : 'City'} value={destination} onChange={setDestination} />
              </div>

              <div className="max-w-sm">
                <MonthPicker
                  label="Travel month"
                  value={travelMonth}
                  onChange={(m) => {
                    setTravelMonth(m);
                    setTravelDay('');
                  }}
                  from={thisMonth()}
                  monthsAhead={reportConfig.travel_month_window.months_ahead}
                />
              </div>

              {travelMonth && (
                <div className="max-w-sm">
                  <label htmlFor="report-day" className={`mb-1.5 block ${LABEL}`}>
                    Travel day <span className="normal-case text-navy-950/40">(optional)</span>
                  </label>
                  <select id="report-day" value={travelDay} onChange={(e) => setTravelDay(e.target.value)} className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}>
                    <option value="">Not specified</option>
                    {Array.from({ length: daysIn(travelMonth) }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                      <option key={d} value={d}>
                        {Number(d)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isFlight && !tripType && <p className="text-sm text-navy-950/60">Choose one way or round trip to share.</p>}
              {reportBoost === null && (
                <p className="text-sm text-navy-950/60">
                  {another ? 'Answer the Points Boost question to share.' : 'Answer the Points Boost question above to share.'}
                </p>
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
                disabled={!check.ok || reportBoost === null || status.kind === 'sending'}
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
