import { describe, expect, it } from 'vitest';
import { tripFromLocation, tripLink } from './tripLink';
import type { TripInputs } from './trips';

const trip: TripInputs = { tripCashPrice: 900, selectedPartnerId: 'united', pointsRequired: 60000, partnerPointsHeld: 5000, awardCashFees: 85.5, chaseTravelPoints: 0 };

describe('trip links', () => {
  it('carry the trip after "#", and read back the same', () => {
    const link = tripLink(trip);
    expect(link).toBe('https://pointcompass.vercel.app/app#price=900&partner=united&points=60000&held=5000&fees=85.5');
    const url = new URL(link);
    expect(tripFromLocation(url)).toEqual(trip);
    expect(tripLink(trip, { held: false })).not.toContain('held');
  });

  it('read the query too, preferring "#", and nothing from a plain address', () => {
    expect(tripFromLocation({ hash: '#price=500', search: '?price=900' })?.tripCashPrice).toBe(500);
    expect(tripFromLocation({ hash: '', search: '?price=900' })?.tripCashPrice).toBe(900);
    expect(tripFromLocation({ hash: '', search: '' })).toBeNull();
  });
});
