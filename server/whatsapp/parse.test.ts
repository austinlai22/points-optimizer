import { describe, expect, it } from 'vitest';
import {
  parseAmount,
  parseBalances,
  parseChaseCardType,
  parseCommand,
  parsePointsPrice,
  parseTripPrice,
  parseYesNo,
} from './parse';

describe('parsing WhatsApp replies', () => {
  it('reads commands in any case', () => {
    expect(parseCommand('reset')).toBe('RESET');
    expect(parseCommand(' Update! ')).toBe('UPDATE');
    expect(parseCommand('help me')).toBeNull();
  });

  it('reads a trip price only when it is clearly money', () => {
    expect(parseTripPrice('NYC to Lisbon in May, $900, worth using points?')).toBe(900);
    expect(parseTripPrice('Tokyo $1,400')).toBe(1400);
    expect(parseTripPrice('Paris 1.2k USD')).toBe(1200);
    expect(parseTripPrice('London in May 2027 for 2 people')).toBeNull();
  });

  it('reads amounts, including negative ones', () => {
    expect(parseAmount('$4,000')).toBe(4000);
    expect(parseAmount('2.5k')).toBe(2500);
    expect(parseAmount('-150')).toBe(-150);
    expect(parseAmount('minus 200')).toBe(-200);
    expect(parseAmount('(300)')).toBe(-300);
    expect(parseAmount('lots')).toBeNull();
  });

  it('reads balances by bank', () => {
    expect(parseBalances('Chase 80k, Amex 45,000')).toEqual({ chase: 80000, amex: 45000 });
    expect(parseBalances('capital one 30k and bilt 12000')).toEqual({ capitalOne: 30000, bilt: 12000 });
    expect(parseBalances('none')).toEqual({});
    expect(parseBalances('some points')).toBeNull();
  });

  it('reads a pasted points price', () => {
    expect(parsePointsPrice('Chase Travel shows 55k points')).toBe(55000);
    expect(parsePointsPrice('chase travel 61,250')).toBe(61250);
    expect(parsePointsPrice('$900 flight')).toBeNull();
  });

  it('reads Chase card types from words', () => {
    expect(parseChaseCardType('sapphire reserve for business')).toBe('reserveForBusiness');
    expect(parseChaseCardType('Ink Plus')).toBe('inkPlus');
    expect(parseChaseCardType('csr')).toBe('reserve');
    expect(parseChaseCardType('freedom unlimited')).toBe('other');
  });

  it('reads yes and no, treating unsure as no', () => {
    expect(parseYesNo('Yes')).toBe(true);
    expect(parseYesNo('not sure')).toBe(false);
    expect(parseYesNo('maybe')).toBeNull();
  });
});
