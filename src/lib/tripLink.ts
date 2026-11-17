import { parseNonNegativeNumber } from '../utils/format';
import type { TripInputs } from './trips';

// A trip as link parameters: price, partner, points, held, fees, ct. Check a
// trip keeps them in its address (?price=…) so a copied link reproduces the
// trip. Links made elsewhere (by the Claude connector, or "Copy my trips for
// Claude") put them after "#" instead, which browsers don't send to the
// server. Balances and cash never go in either.

export const SITE_URL = 'https://pointcompass.vercel.app';

const KEYS = ['price', 'partner', 'points', 'held', 'fees', 'ct'] as const;

export function tripParams(t: TripInputs, { held = true } = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (t.tripCashPrice > 0) params.set('price', String(t.tripCashPrice));
  if (t.selectedPartnerId) params.set('partner', t.selectedPartnerId);
  if (t.pointsRequired > 0) params.set('points', String(t.pointsRequired));
  if (held && t.partnerPointsHeld > 0) params.set('held', String(t.partnerPointsHeld));
  if (t.awardCashFees > 0) params.set('fees', String(t.awardCashFees));
  if (t.chaseTravelPoints > 0) params.set('ct', String(t.chaseTravelPoints));
  return params;
}

// A link that opens Check a trip with this trip filled in.
export function tripLink(t: TripInputs, options: { origin?: string; held?: boolean } = {}): string {
  return `${options.origin ?? SITE_URL}/app#${tripParams(t, options).toString()}`;
}

// The trip in a link's parameters, or null when it carries none.
export function tripFromParams(params: URLSearchParams): TripInputs | null {
  if (!KEYS.some((k) => params.has(k))) return null;
  return {
    tripCashPrice: parseNonNegativeNumber(params.get('price') ?? ''),
    selectedPartnerId: params.get('partner') ?? '',
    pointsRequired: parseNonNegativeNumber(params.get('points') ?? ''),
    partnerPointsHeld: parseNonNegativeNumber(params.get('held') ?? ''),
    awardCashFees: parseNonNegativeNumber(params.get('fees') ?? ''),
    chaseTravelPoints: parseNonNegativeNumber(params.get('ct') ?? ''),
  };
}

// The trip in the page's address: after "#" first, then the query.
export function tripFromLocation(location: { hash: string; search: string }): TripInputs | null {
  return tripFromParams(new URLSearchParams(location.hash.replace(/^#/, ''))) ?? tripFromParams(new URLSearchParams(location.search));
}
