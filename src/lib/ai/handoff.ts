import { tripLink } from '../tripLink';
import type { SavedTrip } from '../trips';
import { describeTrip } from './tools';

// Saved trips as text to paste into Claude (or any assistant), with a link
// back to each. Prices and programs only: no balances, no points held, no
// cash position.
export function tripsForClaude(trips: SavedTrip[]): string {
  const lines = trips.map((t, i) => `${i + 1}. ${t.name}: ${describeTrip(t.inputs)}. Open in PointCompass: ${tripLink(t.inputs, { held: false })}`);
  return [
    'My saved trips from PointCompass (prices only, no balances):',
    ...lines,
    '',
    "Check them with the PointCompass connector's recommend_payment tool, and ask me for my points balances if you need them.",
  ].join('\n');
}
