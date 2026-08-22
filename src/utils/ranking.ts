// Dense ranking: paths with the same cost share a rank, and the next
// distinct cost takes the very next integer (1, 1, 2, 3 — not 1, 1, 3, 4).
// Costs are rounded to the nearest whole dollar before comparing, matching
// what formatUSD actually displays — two paths that show the identical
// dollar figure must never be ranked #1 and #2, since that reads as one
// being better when they're genuinely tied.
export function computeDenseRanks(costs: number[]): number[] {
  const ranks: number[] = [];
  let currentRank = 0;
  let lastValue: number | null = null;

  for (const cost of costs) {
    const rounded = Math.round(cost);
    if (lastValue === null || rounded !== lastValue) {
      currentRank += 1;
      lastValue = rounded;
    }
    ranks.push(currentRank);
  }

  return ranks;
}
