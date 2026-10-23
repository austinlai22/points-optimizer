// npm run export-reports > reports.csv
//
// Every stored Chase Travel price report as CSV, read straight from Upstash
// with the keys in .env.local. Local only: there is no export endpoint, and
// reports are not published anywhere.
import { allReports, REPORT_COLUMNS, toCsv } from '../server/admin';
import { storeFromEnv } from '../server/store';

const store = storeFromEnv(process.env);
if (!store) {
  console.error('No database keys found. Add KV_REST_API_URL and KV_REST_API_TOKEN to .env.local.');
  process.exit(1);
}

const reports = await allReports(store);
process.stdout.write(toCsv(reports as unknown as Record<string, unknown>[], REPORT_COLUMNS));
console.error(`${reports.length} report${reports.length === 1 ? '' : 's'} exported.`);
