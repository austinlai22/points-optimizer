// POST /api/event — anonymous usage counts from the web app.
import { createEventHandler } from '../event/handler';
import { storeFromEnv } from '../store';

export default createEventHandler({ store: storeFromEnv(process.env) });
