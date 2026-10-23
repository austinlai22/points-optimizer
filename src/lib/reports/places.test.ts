import { describe, expect, it } from 'vitest';
import airports from '../../data/airports.json';
import { searchPlaces, type Place } from './places';
const places = airports.places as Place[];
const codes = (query: string) => searchPlaces(places, query).map(([code]) => code);

describe('airport search', () => {
  it('puts an exact code first, then cities that start with what was typed', () => {
    expect(codes('lga')[0]).toBe('LGA');
    expect(codes('San Francisco')[0]).toBe('SFO');
    expect(codes('new york').slice(0, 1)).toEqual(['NYC']);
    expect(codes('paris')[0]).toBe('PAR');
  });

  it('ignores accents and case, and waits for two letters', () => {
    expect(codes('sao paulo')[0]).toBe('SAO');
    expect(codes('s')).toEqual([]);
  });
});
