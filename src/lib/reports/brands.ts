import transferPartnersData from '../../data/transferPartners.json';
import type { TransferPartner } from '../../types';

// The airlines and hotel chains a price report can name: exactly the ones
// behind the programs PointCompass tracks (transferPartners.json), so a report
// can always be tied back to a program in the data. Fixed choices, so nothing
// typed freely is stored.

const transferPartners = transferPartnersData as TransferPartner[];

// The airlines each tracked airline program covers, by 2-letter IATA code.
// brands.test.ts fails if an airline program in the data is missing here.
export const AIRLINES_BY_PROGRAM: Record<string, { code: string; name: string }[]> = {
  ana: [{ code: 'NH', name: 'ANA' }],
  aerlingus: [{ code: 'EI', name: 'Aer Lingus' }],
  aeromexico: [{ code: 'AM', name: 'Aeromexico' }],
  aeroplan: [{ code: 'AC', name: 'Air Canada' }],
  flyingblue: [
    { code: 'AF', name: 'Air France' },
    { code: 'KL', name: 'KLM' },
  ],
  aa: [{ code: 'AA', name: 'American Airlines' }],
  atmos: [
    { code: 'AS', name: 'Alaska Airlines' },
    { code: 'HA', name: 'Hawaiian Airlines' },
  ],
  avianca: [{ code: 'AV', name: 'Avianca' }],
  britishairways: [{ code: 'BA', name: 'British Airways' }],
  cathay: [{ code: 'CX', name: 'Cathay Pacific' }],
  delta: [{ code: 'DL', name: 'Delta Air Lines' }],
  eva: [{ code: 'BR', name: 'EVA Air' }],
  emirates: [{ code: 'EK', name: 'Emirates' }],
  etihad: [{ code: 'EY', name: 'Etihad Airways' }],
  finnair: [{ code: 'AY', name: 'Finnair' }],
  iberia: [{ code: 'IB', name: 'Iberia' }],
  jal: [{ code: 'JL', name: 'Japan Airlines' }],
  jetblue: [{ code: 'B6', name: 'JetBlue' }],
  qantas: [{ code: 'QF', name: 'Qantas' }],
  qatar: [{ code: 'QR', name: 'Qatar Airways' }],
  singapore: [{ code: 'SQ', name: 'Singapore Airlines' }],
  southwest: [{ code: 'WN', name: 'Southwest Airlines' }],
  tap: [{ code: 'TP', name: 'TAP Air Portugal' }],
  thai: [{ code: 'TG', name: 'Thai Airways' }],
  turkish: [{ code: 'TK', name: 'Turkish Airlines' }],
  united: [{ code: 'UA', name: 'United Airlines' }],
  virginatlantic: [{ code: 'VS', name: 'Virgin Atlantic' }],
};

// Every tracked airline, alphabetical by name.
export const TRACKED_AIRLINES = transferPartners
  .filter((p) => p.type === 'airline')
  .flatMap((p) => AIRLINES_BY_PROGRAM[p.id] ?? [])
  .sort((a, b) => a.name.localeCompare(b.name));

const AIRLINE_CODES = new Set(TRACKED_AIRLINES.map((a) => a.code));

export function isTrackedAirline(code: unknown): boolean {
  return typeof code === 'string' && AIRLINE_CODES.has(code);
}

// Hotel chains: each tracked hotel program by its id, plus two catch-alls.
// Many Chase Travel hotels, including much of The Edit, belong to no chain.
const SHORT_HOTEL_NAMES: Record<string, string> = {
  accor: 'Accor',
  choice: 'Choice Hotels',
  hilton: 'Hilton',
  ihg: 'IHG',
  leadinghotels: 'Leading Hotels of the World',
  marriott: 'Marriott',
  iprefer: 'Preferred Hotels & Resorts',
  hyatt: 'Hyatt',
  wyndham: 'Wyndham',
};

export const HOTEL_CHAINS: { id: string; name: string }[] = [
  ...transferPartners
    .filter((p) => p.type === 'hotel')
    .map((p) => ({ id: p.id, name: SHORT_HOTEL_NAMES[p.id] ?? p.name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  { id: 'independent', name: 'Independent hotel' },
  { id: 'other', name: 'Another chain' },
];

const HOTEL_IDS = new Set(HOTEL_CHAINS.map((h) => h.id));

export function isTrackedHotelChain(id: unknown): boolean {
  return typeof id === 'string' && HOTEL_IDS.has(id);
}

const simplify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

// For the bulk import: "Southwest", "southwest airlines" and "wn" all give
// "WN". Anything unrecognised comes back upper-cased for validation to refuse.
export function toAirlineCode(value: string): string {
  const v = simplify(value);
  const match = TRACKED_AIRLINES.find(
    (a) => simplify(a.code) === v || simplify(a.name) === v || simplify(a.name).replace(/ (airlines?|airways|air lines)$/, '') === v,
  );
  return match ? match.code : value.trim().toUpperCase();
}

// "Hyatt", "World of Hyatt", "hyatt" all give "hyatt"; "independent" too.
export function toHotelChainId(value: string): string {
  const v = simplify(value);
  const fromData = transferPartners.find((p) => p.type === 'hotel' && simplify(p.name) === v);
  const match = HOTEL_CHAINS.find((h) => simplify(h.id) === v || simplify(h.name) === v);
  return match?.id ?? fromData?.id ?? value.trim().toLowerCase();
}
