import transferPartnersData from '../../data/transferPartners.json';
import type { TransferPartner } from '../../types';
import type { ParsedTrip } from './protocol';

// Reads a trip from plain words without any AI: the fallback when neither the
// browser's own model nor the server's is available. It handles the common
// ways people write prices ("$900", "60k United miles + $85 taxes", "Chase
// Travel 45,000 points"), and leaves anything unclear blank rather than guess.

const transferPartners = transferPartnersData as TransferPartner[];

// Words people use for a program, beyond its own name.
const ALIASES: Record<string, string[]> = {
  aa: ['american', 'aadvantage', 'american airlines'],
  atmos: ['alaska', 'hawaiian', 'atmos'],
  flyingblue: ['flying blue', 'air france', 'klm'],
  britishairways: ['british airways', 'british', 'ba avios'],
  aeroplan: ['aeroplan', 'air canada'],
  virginatlantic: ['virgin atlantic', 'virgin'],
  singapore: ['singapore', 'krisflyer'],
  avianca: ['avianca', 'lifemiles'],
  jal: ['jal', 'japan airlines'],
  ana: ['ana', 'all nippon'],
  aerlingus: ['aer lingus', 'aerclub'],
  iprefer: ['i prefer', 'preferred hotels'],
  leadinghotels: ['leading hotels', 'leaders club'],
  hyatt: ['hyatt'],
  marriott: ['marriott', 'bonvoy'],
  hilton: ['hilton'],
  ihg: ['ihg'],
  delta: ['delta', 'skymiles'],
  united: ['united', 'mileageplus'],
  southwest: ['southwest', 'rapid rewards'],
  jetblue: ['jetblue', 'trueblue'],
  tap: ['tap air portugal', 'tap portugal', 'tap miles'],
  thai: ['thai'],
  copa: ['copa'],
};

function programAliases(): [string, string][] {
  const pairs: [string, string][] = [];
  for (const p of transferPartners) {
    const words = ALIASES[p.id] ?? [p.name.toLowerCase().split(/\s+/)[0]];
    for (const w of words) pairs.push([w, p.id]);
  }
  // Longest first, so "air france" wins over a shorter overlapping alias.
  return pairs.sort((a, b) => b[0].length - a[0].length);
}
const PROGRAM_ALIASES = programAliases();

const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand)?`;

function toNumber(digits: string, suffix?: string): number {
  const n = Number(digits.replace(/,/g, ''));
  return suffix ? n * 1000 : n;
}

function findProgram(text: string): string | null {
  for (const [alias, id] of PROGRAM_ALIASES) {
    if (new RegExp(`(^|[^a-z])${alias.replace(/ /g, '\\s+')}([^a-z]|$)`).test(text)) return id;
  }
  return null;
}

export function readTrip(input: string): ParsedTrip {
  const text = input.toLowerCase();
  const trip: ParsedTrip = {
    trip_cash_price_usd: null,
    program: findProgram(text),
    award_points: null,
    award_taxes_usd: null,
    partner_points_held: null,
    chase_travel_points: null,
  };

  // Points: a number followed by points/miles/pts/avios, or "k" before them.
  const pointsRe = new RegExp(`${NUMBER}\\s*(?:[a-z ]{0,25}?)\\b(points|pts|miles|avios)\\b`, 'g');
  for (const m of text.matchAll(pointsRe)) {
    const value = toNumber(m[1], m[2]);
    const before = text.slice(Math.max(0, m.index! - 30), m.index!);
    const span = text.slice(Math.max(0, m.index! - 30), m.index! + m[0].length);
    if (/chase travel|portal/.test(span)) trip.chase_travel_points ??= value;
    else if (/(already )?(have|hold|holding|got)\b/.test(before)) trip.partner_points_held ??= value;
    else trip.award_points ??= value;
  }

  // Dollar amounts: taxes if they come with "+", "plus" or tax/fee words,
  // otherwise the cash price.
  const dollarRe = new RegExp(String.raw`(\+\s*|plus\s+)?\$\s?${NUMBER}|${NUMBER}\s*(?:dollars|usd)\b`, 'g');
  for (const m of text.matchAll(dollarRe)) {
    const digits = m[2] ?? m[4];
    const suffix = m[3] ?? m[5];
    const value = toNumber(digits, suffix);
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 25);
    const isTax = Boolean(m[1]) || /^\s*(in\s+)?(taxes|tax|fees|fee|surcharges?)/.test(after);
    if (isTax) trip.award_taxes_usd ??= value;
    else trip.trip_cash_price_usd ??= value;
  }

  // An award needs its program; without one, a points figure is ambiguous.
  if (trip.award_points !== null && trip.program === null && trip.chase_travel_points === null && /chase/.test(text)) {
    trip.chase_travel_points = trip.award_points;
    trip.award_points = null;
  }
  return trip;
}
