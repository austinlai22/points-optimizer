import { useSyncExternalStore } from 'react';
import transferPartnersData from '../data/transferPartners.json';
import { evaluateVerdict, inferChaseCardType } from './verdict';
import type { VerdictResult } from './verdict/types';
import type { CashInputValues, ChaseInputValues } from '../utils/verdictInputs';
import { parseFiniteNumber } from '../utils/format';
import type { CardConfig, TransferPartner, ValuationBasis } from '../types';

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

// The recommendation for one trip. Check a trip and the comparison both use
// this, so the same trip can't get two different answers. Null until there is
// a price and a complete cash position.
export function evaluateTrip(trip: TripInputs, ctx: TripContext): VerdictResult | null {
  const available = parseFiniteNumber(ctx.cash.available);
  const monthlyLeftover = parseFiniteNumber(ctx.cash.leftover);
  const monthlySpend = parseFiniteNumber(ctx.cash.spend);
  if (!(trip.tripCashPrice > 0) || available === null || monthlyLeftover === null || monthlySpend === null) return null;
  const legacyPoints = parseFiniteNumber(ctx.chase.legacyPoints);
  const ownsChase = ctx.ownedCards.some((card) => card.issuer === 'chase');
  try {
    return evaluateVerdict({
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
      cash: { available, monthlyLeftover, monthlySpend: Math.max(monthlySpend, 0) },
    });
  } catch {
    return null;
  }
}

export function partnerName(id: string): string | null {
  return transferPartners.find((p) => p.id === id)?.name ?? null;
}

// ---------------------------------------------------------------------------
// Saved trips: trips someone keeps for their own reference, in this browser
// only. Never sent anywhere, and separate from sharing a price report.

export interface SavedTrip {
  id: string;
  name: string;
  savedOn: string; // YYYY-MM-DD
  inputs: TripInputs;
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

export function saveTrip(name: string, inputs: TripInputs): SavedTrip | null {
  const trips = read(SAVED_TRIPS_KEY, sanitizeSavedTrips, []);
  if (trips.length >= MAX_SAVED_TRIPS) return null;
  const trip: SavedTrip = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim().slice(0, 60) || 'Untitled trip',
    savedOn: new Date().toISOString().slice(0, 10),
    inputs: sanitizeTripInputs(inputs),
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
