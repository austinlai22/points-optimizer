import { useSyncExternalStore } from 'react';
import transferPartnersData from '../data/transferPartners.json';
import { CASH_NOT_GIVEN, CASH_NOT_GIVEN_ASSUMPTION, evaluateVerdict, inferChaseCardType, verdictHeadline } from './verdict';
import type { PointsOption, VerdictResult } from './verdict/types';
import { ISSUER_LABELS } from '../utils/issuers';
import type { CashInputValues, ChaseInputValues } from '../utils/verdictInputs';
import { parseFiniteNumber } from '../utils/format';
import { TRIP_STORAGE_KEY } from '../utils/verdictInputs';
import { navigate } from './router';
import type { CardConfig, Issuer, TransferPartner, ValuationBasis } from '../types';

const transferPartners = transferPartnersData as TransferPartner[];

// A trip as entered in Check a trip. No balances, cash or anything about the
// person: those come from Portfolio and the cash inputs at the time of use.
export interface TripInputs {
  tripCashPrice: number;
  selectedPartnerId: string;
  pointsRequired: number;
  partnerPointsHeld: number;
  awardCashFees: number;
  // A points price the user saw in Chase Travel for this trip.
  chaseTravelPoints: number;
}

export const DEFAULT_TRIP_INPUTS: TripInputs = {
  tripCashPrice: 0,
  selectedPartnerId: '',
  pointsRequired: 0,
  partnerPointsHeld: 0,
  awardCashFees: 0,
  chaseTravelPoints: 0,
};

const storedNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

export function sanitizeTripInputs(stored: unknown): TripInputs {
  const s = (stored ?? {}) as Record<string, unknown>;
  return {
    tripCashPrice: storedNumber(s.tripCashPrice),
    selectedPartnerId: typeof s.selectedPartnerId === 'string' ? s.selectedPartnerId : '',
    pointsRequired: storedNumber(s.pointsRequired),
    partnerPointsHeld: storedNumber(s.partnerPointsHeld),
    awardCashFees: storedNumber(s.awardCashFees),
    chaseTravelPoints: storedNumber(s.chaseTravelPoints),
  };
}

export interface TripContext {
  ownedCards: CardConfig[];
  balances: Record<string, number>;
  basis: ValuationBasis;
  cash: CashInputValues;
  chase: ChaseInputValues;
}

export interface TripVerdict extends VerdictResult {
  // False when no complete cash position was given, so the recommendation is
  // on value alone and the cash figures mean nothing.
  cashConsidered: boolean;
}

// The recommendation for one trip. Check a trip and the comparison both use
// this, so the same trip can't get two different answers. Null until there is
// a price. The cash position is optional: without it, paying cash is assumed
// not to strain, exactly as the agent tool does.
export function evaluateTrip(trip: TripInputs, ctx: TripContext): TripVerdict | null {
  if (!(trip.tripCashPrice > 0)) return null;
  const available = parseFiniteNumber(ctx.cash.available);
  const monthlyLeftover = parseFiniteNumber(ctx.cash.leftover);
  const monthlySpend = parseFiniteNumber(ctx.cash.spend);
  const cashConsidered = available !== null && monthlyLeftover !== null && monthlySpend !== null;
  const legacyPoints = parseFiniteNumber(ctx.chase.legacyPoints);
  const ownsChase = ctx.ownedCards.some((card) => card.issuer === 'chase');
  try {
    const result = evaluateVerdict({
      tripCashPrice: trip.tripCashPrice,
      awardTaxes: trip.awardCashFees,
      ownedCards: ctx.ownedCards,
      balances: ctx.balances,
      transferPartners,
      award:
        trip.selectedPartnerId && trip.pointsRequired > 0
          ? { partnerId: trip.selectedPartnerId, pointsRequired: trip.pointsRequired, partnerPointsHeld: trip.partnerPointsHeld }
          : undefined,
      basis: ctx.basis,
      chase: {
        cardType: ctx.chase.cardType || inferChaseCardType(ctx.ownedCards),
        reserveAppliedBeforeCutoff: ctx.chase.appliedBeforeCutoff ?? undefined,
        legacyPoints: legacyPoints !== null && legacyPoints >= 0 ? legacyPoints : undefined,
        travelPricePoints: ownsChase && trip.chaseTravelPoints > 0 ? trip.chaseTravelPoints : undefined,
      },
      cash: cashConsidered ? { available: available!, monthlyLeftover: monthlyLeftover!, monthlySpend: Math.max(monthlySpend!, 0) } : CASH_NOT_GIVEN,
    });
    return {
      ...result,
      cashConsidered,
      assumptions: cashConsidered ? result.assumptions : [CASH_NOT_GIVEN_ASSUMPTION, ...result.assumptions],
    };
  } catch {
    return null;
  }
}

export function partnerName(id: string): string | null {
  return transferPartners.find((p) => p.id === id)?.name ?? null;
}

// How a points option reads in a short space: "Transfer to World of Hyatt",
// "from Chase".
export function describePointsOption(option: PointsOption): { title: string; detail: string } {
  if (option.kind === 'transfer') {
    return { title: `Transfer to ${option.partner?.name ?? 'partner'}`, detail: `from ${ISSUER_LABELS[option.issuer]}` };
  }
  if (option.kind === 'chaseTravel') return { title: 'Book in Chase Travel', detail: option.isEstimate ? 'estimated price' : 'price you entered' };
  return { title: `${ISSUER_LABELS[option.issuer]} travel portal`, detail: 'book with points' };
}

// What a saved trip remembers of the recommendation it got when saved, so it
// can still be shown if today's cards can't produce one (a different device,
// or a card since removed).
export interface TripSnapshot {
  headline: string;
  option: { title: string; detail: string; cppCents: number | null; benchmarkRatio: number | null; pointsUsed: number } | null;
}

export function snapshotOf(verdict: VerdictResult | null): TripSnapshot | null {
  if (!verdict) return null;
  const best = verdict.options[0] ?? null;
  return {
    headline: verdictHeadline(verdict),
    option: best
      ? {
          ...describePointsOption(best),
          cppCents: best.cppCents,
          benchmarkRatio: Number.isFinite(best.benchmarkRatio) ? best.benchmarkRatio : null,
          pointsUsed: best.pointsUsed,
        }
      : null,
  };
}

function sanitizeSnapshot(stored: unknown): TripSnapshot | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const s = stored as Record<string, unknown>;
  if (typeof s.headline !== 'string') return null;
  const o = (typeof s.option === 'object' && s.option !== null ? s.option : null) as Record<string, unknown> | null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    headline: s.headline.slice(0, 80),
    option:
      o && typeof o.title === 'string'
        ? {
            title: o.title.slice(0, 80),
            detail: typeof o.detail === 'string' ? o.detail.slice(0, 80) : '',
            cppCents: num(o.cppCents),
            benchmarkRatio: num(o.benchmarkRatio),
            pointsUsed: num(o.pointsUsed) ?? 0,
          }
        : null,
  };
}

export interface EnteredValue {
  cppCents: number;
  title: string;
  detail: string;
  // Bank points needed, or the partner's own points when perPartnerPoint.
  pointsUsed: number;
  // True when the bank behind the transfer isn't known and banks transfer to
  // this partner at different ratios, so the value is per partner point (a
  // Hilton point, say) rather than per bank point, and can't be ranked
  // against other trips.
  perPartnerPoint: boolean;
  // The partner's name, for "per Hilton Honors point".
  unit: string | null;
}

// Value per point from the trip's own prices, for when no card can produce an
// option: the award (less its taxes) over the bank points it takes, or the
// cash price over the Chase Travel price. The higher of the two.
//
// An award is priced in the partner's points, so it's converted with the
// transfer ratio: the best one among the banks you hold, or the one every
// bank shares. Hilton at 2 points per Amex point means a 60,000-point award
// takes 30,000 Amex points.
export function valueFromInputs(trip: TripInputs, heldIssuers: Issuer[]): EnteredValue | null {
  const candidates: EnteredValue[] = [];
  const partner = transferPartners.find((p) => p.id === trip.selectedPartnerId);
  if (partner && trip.pointsRequired > 0) {
    const ratios = Object.entries(partner.ratiosByIssuer) as [Issuer, number][];
    const held = ratios.filter(([issuer]) => heldIssuers.includes(issuer)).map(([, r]) => r);
    const all = [...new Set(ratios.map(([, r]) => r))];
    const ratio = held.length > 0 ? Math.max(...held) : all.length === 1 ? all[0] : null;
    const valueBought = trip.tripCashPrice - trip.awardCashFees;
    const points = ratio ? Math.ceil(trip.pointsRequired / ratio) : trip.pointsRequired;
    candidates.push({
      cppCents: (valueBought * 100) / points,
      title: `Transfer to ${partner.name}`,
      detail: 'award price you entered',
      pointsUsed: points,
      perPartnerPoint: ratio === null,
      unit: ratio === null ? partner.name : null,
    });
  }
  if (trip.chaseTravelPoints > 0) {
    candidates.push({
      cppCents: (trip.tripCashPrice * 100) / trip.chaseTravelPoints,
      title: 'Book in Chase Travel',
      detail: 'price you entered',
      pointsUsed: trip.chaseTravelPoints,
      perPartnerPoint: false,
      unit: null,
    });
  }
  // A per-partner-point figure can't be compared with a per-bank-point one,
  // so it's only the answer when it's the only one.
  const comparable = candidates.filter((c) => !c.perPartnerPoint);
  return (comparable.length > 0 ? comparable : candidates).sort((a, b) => b.cppCents - a.cppCents)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Saved trips: trips someone keeps for their own reference, in this browser
// only. Never sent anywhere, and separate from sharing a price report.

export interface SavedTrip {
  id: string;
  name: string;
  savedOn: string; // YYYY-MM-DD
  inputs: TripInputs;
  snapshot: TripSnapshot | null;
}

export const SAVED_TRIPS_KEY = 'cco:savedTrips';
export const COMPARE_KEY = 'cco:compare';
export const MAX_SAVED_TRIPS = 30;
export const MAX_COMPARE = 5;
const CHANGE_EVENT = 'cco:savedTripsChange';

function read<T>(key: string, sanitize: (v: unknown) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : sanitize(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private mode / quota): nothing to keep.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function sanitizeSavedTrips(stored: unknown): SavedTrip[] {
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .filter((t) => typeof t.id === 'string' && typeof t.name === 'string')
    .map((t) => ({
      id: t.id as string,
      name: (t.name as string).slice(0, 60),
      savedOn: typeof t.savedOn === 'string' ? t.savedOn : '',
      inputs: sanitizeTripInputs(t.inputs),
      snapshot: sanitizeSnapshot(t.snapshot),
    }))
    .slice(0, MAX_SAVED_TRIPS);
}

const sanitizeIds = (stored: unknown): string[] =>
  Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(0, MAX_COMPARE) : [];

// useSyncExternalStore needs the same object back until something changes,
// so each key's parsed value is kept alongside the text it was parsed from.
const cache = new Map<string, { raw: string | null; value: unknown }>();
function snapshot<T>(key: string, sanitize: (v: unknown) => T, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Storage unavailable: treated as empty.
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  const value = read(key, sanitize, fallback);
  cache.set(key, { raw, value });
  return value;
}

// Changes from this tab (the custom event) and from other tabs ('storage').
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const EMPTY: never[] = [];

export function useSavedTrips(): SavedTrip[] {
  return useSyncExternalStore(subscribe, () => snapshot(SAVED_TRIPS_KEY, sanitizeSavedTrips, EMPTY));
}

export function useCompareIds(): string[] {
  const ids = useSyncExternalStore(subscribe, () => snapshot(COMPARE_KEY, sanitizeIds, EMPTY));
  const trips = useSavedTrips();
  // A deleted trip drops out of the comparison.
  return ids.every((id) => trips.some((t) => t.id === id)) ? ids : ids.filter((id) => trips.some((t) => t.id === id));
}

export function saveTrip(name: string, inputs: TripInputs, verdict: VerdictResult | null = null): SavedTrip | null {
  const trips = read(SAVED_TRIPS_KEY, sanitizeSavedTrips, []);
  if (trips.length >= MAX_SAVED_TRIPS) return null;
  const trip: SavedTrip = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim().slice(0, 60) || 'Untitled trip',
    savedOn: new Date().toISOString().slice(0, 10),
    inputs: sanitizeTripInputs(inputs),
    snapshot: snapshotOf(verdict),
  };
  write(SAVED_TRIPS_KEY, [trip, ...trips]);
  return trip;
}

export function deleteTrip(id: string) {
  write(SAVED_TRIPS_KEY, read(SAVED_TRIPS_KEY, sanitizeSavedTrips, []).filter((t) => t.id !== id));
  write(COMPARE_KEY, read(COMPARE_KEY, sanitizeIds, []).filter((x) => x !== id));
}

// Adds a trip to the comparison. False when it's already full.
export function addToCompare(id: string): boolean {
  const ids = read(COMPARE_KEY, sanitizeIds, []);
  if (ids.includes(id)) return true;
  if (ids.length >= MAX_COMPARE) return false;
  write(COMPARE_KEY, [...ids, id]);
  return true;
}

export function removeFromCompare(id: string) {
  write(COMPARE_KEY, read(COMPARE_KEY, sanitizeIds, []).filter((x) => x !== id));
}

export function clearCompare() {
  write(COMPARE_KEY, []);
}

export const sameTripInputs = (a: TripInputs, b: TripInputs) =>
  (Object.keys(a) as (keyof TripInputs)[]).every((key) => a[key] === b[key]);

// What's in Check a trip now, if opening `trip` would lose it: a trip with a
// price that isn't saved and isn't the one being opened.
export function unsavedCurrentTrip(trip: SavedTrip): TripInputs | null {
  const current = read(TRIP_STORAGE_KEY, sanitizeTripInputs, DEFAULT_TRIP_INPUTS);
  if (!(current.tripCashPrice > 0) || sameTripInputs(current, trip.inputs)) return null;
  const saved = read(SAVED_TRIPS_KEY, sanitizeSavedTrips, []);
  return saved.some((t) => sameTripInputs(t.inputs, current)) ? null : current;
}

// Loads a saved trip into Check a trip, replacing what's there. Check
// unsavedCurrentTrip first.
export function openTrip(trip: SavedTrip) {
  try {
    localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trip.inputs));
  } catch {
    // Without storage the trip can't be carried over; Check a trip opens empty.
  }
  navigate('/app');
}
