// npm run delete-admin-reports            lists your own (admin) entries
// npm run delete-admin-reports -- --confirm   deletes them
//
// Stored reports can't be edited, so to correct your own entries, delete them
// and import the corrected file again. Only reports marked source = admin are
// touched; visitors' reports are never deleted by this.
import { storeFromEnv } from '../server/store';

const store = storeFromEnv(process.env);
if (!store) {
  console.error('No database keys found. Add KV_REST_API_URL and KV_REST_API_TOKEN to .env.local.');
  process.exit(1);
}

const keys = await store.keys('report:*');
const values = await store.mget(keys);
const admin = keys.filter((_, i) => values[i] !== null && JSON.parse(values[i]!).source === 'admin');
for (const [i, key] of keys.entries()) {
  if (!admin.includes(key)) continue;
  const r = JSON.parse(values[i]!);
  console.log(`${r.submitted_on}  ${r.origin ?? ''}-${r.destination}  ${r.airline ?? ''} ${r.fare ?? r.cabin ?? ''}  $${r.cash_price_usd}  ${r.chase_points_price} pts`);
}

if (!process.argv.includes('--confirm')) {
  console.log(`\n${admin.length} admin entr${admin.length === 1 ? 'y' : 'ies'} found. Nothing deleted. Add --confirm to delete them.`);
} else {
  for (const key of admin) await store.del(key);
  console.log(`\nDeleted ${admin.length} admin entr${admin.length === 1 ? 'y' : 'ies'}. Visitors' reports were not touched.`);
}
