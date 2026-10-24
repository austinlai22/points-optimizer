import faresData from '../../data/fares.json';
import type { Cabin } from './validate';

// Airline fare names for price reports. Where an airline's fares are listed,
// a report names the exact fare and its shared cabin follows from it, so
// reports stay comparable across airlines.

export interface Fare {
  id: string;
  name: string;
  cabin: Cabin;
}

interface AirlineFares {
  // The airline's own fare page, or, where it couldn't be read, a note on
  // where the names came from.
  source_url?: string;
  source_note?: string;
  verified_on: string;
  fares: Fare[];
}

export const FARES_BY_AIRLINE = faresData.airlines as Record<string, AirlineFares>;

export function faresFor(airline: string | null | undefined): Fare[] {
  return (airline && FARES_BY_AIRLINE[airline]?.fares) || [];
}

export function findFare(airline: string | null | undefined, fareId: unknown): Fare | undefined {
  return faresFor(airline).find((f) => f.id === fareId);
}

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// For the bulk import: "Main Classic", "Delta Main Classic" and "main_classic"
// all give "main_classic". Anything unrecognised comes back as written for
// validation to refuse.
export function toFareId(airline: string | null, value: string): string {
  const v = simplify(value).replace(/^(delta|southwest|american|jetblue|united) /, '');
  const match = faresFor(airline).find((f) => simplify(f.id) === v || simplify(f.name) === v);
  return match ? match.id : value.trim();
}
