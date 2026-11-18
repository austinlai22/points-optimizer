// npm run stats [-- --weeks 12] [-- --csv]
//
// Weekly usage totals, read straight from Upstash with the keys in .env.local
// (copy KV_REST_API_URL and KV_REST_API_TOKEN from the Vercel or Upstash
// dashboard). Page visitors are on Vercel's Analytics dashboard instead.
import { toCsv, toRows, weeklyStats } from '../server/admin';
import { storeFromEnv } from '../server/store';

const args = process.argv.slice(2);
const weeksArg = args.indexOf('--weeks');
const weeks = weeksArg >= 0 ? Number(args[weeksArg + 1]) : 8;
const store = storeFromEnv(process.env);

if (!store) {
  console.error('No database keys found. Add KV_REST_API_URL and KV_REST_API_TOKEN to .env.local.');
  process.exit(1);
}

const rows = toRows(await weeklyStats(store, weeks));
if (args.includes('--csv')) {
  process.stdout.write(toCsv(rows));
} else {
  // Where people drop off, week by week: visits, then starting a trip, then
  // a recommendation, then saving one or asking the assistant.
  console.log('Funnel');
  console.table(
    rows.map((r) => ({
      'Week of': r.week_starting,
      Visits: r.visits,
      'Started a trip': r.trips_started,
      'Got a recommendation': r.trip_checks,
      'Saved a trip': r.trips_saved,
      'Asked the assistant': r.assistant_questions,
    })),
  );

  // Visits by where they came from (utm_source tag, or the kind of site).
  const sourceColumns = Object.keys(rows[0] ?? {}).filter((c) => c.startsWith('visits_from_'));
  if (sourceColumns.length) {
    console.log('Visits by source');
    console.table(rows.map((r) => ({ 'Week of': r.week_starting, ...Object.fromEntries(sourceColumns.map((c) => [c.replace('visits_from_', ''), r[c]])) })));
  }

  // Of the browsers that first got a recommendation in a week, how many came
  // back on another day within 30 days. Weeks less than 30 days old are still
  // filling in.
  const today = new Date();
  console.log('Coming back (first recommendation that week, then again within 30 days)');
  console.table(
    rows.map((r) => {
      const settled = Date.parse(`${r.week_starting}T00:00:00Z`) + 37 * 24 * 3600 * 1000 <= today.getTime();
      return {
        'Week of': r.week_starting,
        New: r.new_users,
        'Came back ≤30 days': r.came_back_within_30_days,
        Rate: r.new_users ? `${Math.round((r.came_back_within_30_days / r.new_users) * 100)}%` : '–',
        ' ': settled ? '' : 'still filling in',
      };
    }),
  );

  console.log('All counts');
  console.table(
    rows.map((r) => ({
      'Week of': r.week_starting,
      'Trip checks': r.trip_checks,
      'With cash': r.trip_checks_with_cash,
      'Active users': r.active_users,
      Returning: r.returning_users,
      'Price checks': r.price_checks,
      'Price reports': r.price_reports,
      Rejected: r.price_reports_rejected,
      'Agent calls': r.agent_calls,
      'Trips saved': r.trips_saved,
      'AI calls': r.ai_calls,
      Compared: r.trips_compared,
    })),
  );
  console.log('Visitors: see Analytics on the Vercel dashboard. Add --csv for every column.');
  console.log('"With cash" counts checks that included a cash position. Before it became optional, every check did.');
}
