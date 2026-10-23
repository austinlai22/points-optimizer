import { describe, expect, it } from 'vitest';
import transferPartnersData from '../../data/transferPartners.json';
import type { TransferPartner } from '../../types';
import { AIRLINES_BY_PROGRAM, HOTEL_CHAINS, TRACKED_AIRLINES, toAirlineCode, toHotelChainId } from './brands';

const partners = transferPartnersData as TransferPartner[];

describe('airlines and hotel chains a price report can name', () => {
  it('covers every tracked airline program, and nothing else', () => {
    const airlinePrograms = partners.filter((p) => p.type === 'airline').map((p) => p.id).sort();
    expect(Object.keys(AIRLINES_BY_PROGRAM).sort()).toEqual(airlinePrograms);
    const codes = TRACKED_AIRLINES.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]{2}$/);
  });

  it('covers every tracked hotel program, plus independent and other', () => {
    const hotelPrograms = partners.filter((p) => p.type === 'hotel').map((p) => p.id).sort();
    const ids = HOTEL_CHAINS.map((h) => h.id);
    expect(ids.filter((id) => id !== 'independent' && id !== 'other').sort()).toEqual(hotelPrograms);
    expect(ids.slice(-2)).toEqual(['independent', 'other']);
  });

  it('reads airline and hotel names the way people write them', () => {
    expect(['Southwest', 'southwest airlines', 'wn', 'WN'].map(toAirlineCode)).toEqual(['WN', 'WN', 'WN', 'WN']);
    expect(['Delta', 'Delta Air Lines', 'dl'].map(toAirlineCode)).toEqual(['DL', 'DL', 'DL']);
    expect(['Air France', 'KLM', 'Hawaiian'].map(toAirlineCode)).toEqual(['AF', 'KL', 'HA']);
    expect(toAirlineCode('Spirit')).toBe('SPIRIT');
    expect(['Hyatt', 'World of Hyatt', 'Marriott Bonvoy', 'IHG', 'Independent hotel', 'independent'].map(toHotelChainId)).toEqual([
      'hyatt', 'hyatt', 'marriott', 'ihg', 'independent', 'independent',
    ]);
  });
});
