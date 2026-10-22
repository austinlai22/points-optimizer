// POST /api/event — anonymous pilot event counts. GET reads them back with
// STATS_TOKEN.
import { createEventHandler } from '../event/handler';
import { storeFromEnv } from '../store';

export default createEventHandler({
  store: storeFromEnv(process.env),
  statsToken: process.env.STATS_TOKEN ?? '',
});
