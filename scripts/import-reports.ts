// npm run import-reports -- price-reports/my-prices.csv [--dry-run] [--skip-invalid]
//
// Adds your own Chase Travel price entries to the reports database, marked as
// entered by an admin. Every row is checked with the website's rules first; if
// any row has a problem, nothing is stored unless you pass --skip-invalid.
// See price-reports/README.md for the columns.
import { existsSync, readFileSync } from 'node:fs';
import { parseCsv } from '../experiment/csv';
import { importReports } from '../server/reports/importer';
import { storeFromEnv } from '../server/store';

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith('--')) ?? 'price-reports/my-prices.csv';
const dryRun = args.includes('--dry-run');
const skipInvalid = args.includes('--skip-invalid');

if (!existsSync(path)) {
  console.error(`No file at ${path}. Copy price-reports/template.csv to ${path} and fill it in.`);
  process.exit(1);
}
const store = storeFromEnv(process.env);
if (!store && !dryRun) {
  console.error('No database keys found. Add KV_REST_API_URL and KV_REST_API_TOKEN to .env.local, or use --dry-run.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const outcome = await importReports(store, parseCsv(readFileSync(path, 'utf8')), { today, dryRun, skipInvalid });

for (const problem of outcome.problems) {
  console.log(`Line ${problem.line}: ${problem.errors.join(' ')}`);
}
const valid = outcome.checked - outcome.problems.length;
if (dryRun) {
  console.log(`Dry run: ${valid} of ${outcome.checked} rows are ready to import. Nothing was stored.`);
} else if (outcome.problems.length > 0 && !skipInvalid) {
  console.log(`Nothing stored: fix the ${outcome.problems.length} row(s) above, or rerun with --skip-invalid to store the other ${valid}.`);
  process.exit(1);
} else {
  console.log(`Stored ${outcome.stored} of ${outcome.checked} rows, marked as entered by you.`);
}
