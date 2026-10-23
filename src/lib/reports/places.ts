// Searching the airport and city code list (src/data/airports.json).

export type Place = [code: string, name: string, city: string, country: string];

// Loaded on first use, so the list isn't part of the main page download.
let placesPromise: Promise<Place[]> | null = null;
export function loadPlaces(): Promise<Place[]> {
  placesPromise ??= import('../../data/airports.json').then((m) => m.default.places as Place[]);
  return placesPromise;
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function searchPlaces(places: Place[], query: string, limit = 6): Place[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const code = q.toUpperCase();
  const scored: [number, Place][] = [];
  for (const place of places) {
    const [placeCode, name, city] = place;
    const c = fold(city);
    let score = -1;
    if (placeCode === code) score = 0;
    else if (c.startsWith(q)) score = 1;
    else if (q.length <= 3 && placeCode.startsWith(code)) score = 2;
    else if (fold(name).includes(q) || c.includes(q)) score = 3;
    if (score >= 0) scored.push([score, place]);
  }
  // Stable sort keeps the list's own order (city codes, then large airports)
  // within each score.
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, p]) => p);
}
