import { describe, expect, it } from 'vitest';
import { computeDenseRanks } from './ranking';

describe('computeDenseRanks', () => {
  it('assigns sequential ranks when every cost is distinct', () => {
    expect(computeDenseRanks([100, 200, 300])).toEqual([1, 2, 3]);
  });

  it('gives tied costs the same rank, and the next distinct cost the next integer', () => {
    expect(computeDenseRanks([100, 100, 200])).toEqual([1, 1, 2]);
  });

  it('handles a tie for the top spot specifically', () => {
    expect(computeDenseRanks([500, 500, 750, 900])).toEqual([1, 1, 2, 3]);
  });

  it('handles every value tied', () => {
    expect(computeDenseRanks([50, 50, 50])).toEqual([1, 1, 1]);
  });

  it('ties based on the rounded whole-dollar value, matching what is displayed', () => {
    // 600.001 and 599.999 both display as "$600" — must be treated as tied.
    expect(computeDenseRanks([600.001, 599.999, 700])).toEqual([1, 1, 2]);
  });

  it('returns an empty array for no paths', () => {
    expect(computeDenseRanks([])).toEqual([]);
  });
});
