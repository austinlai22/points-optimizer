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
  console.table(
    rows.map((r) => ({
      'Week of': r.week_starting,
      'Trip checks': r.trip_checks,
      'Active users': r.active_users,
      Returning: r.returning_users,
      'Price checks': r.price_checks,
      'Price reports': r.price_reports,
      Rejected: r.price_reports_rejected,
      'Agent calls': r.agent_calls,
    })),
  );
  console.log('Visitors: see Analytics on the Vercel dashboard. Add --csv for every column.');
}
