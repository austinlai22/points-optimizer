// POST /api/report — opt-in, anonymous Chase Travel price reports.
import { createReportHandler } from '../reports/handler';
import { storeFromEnv } from '../store';

export default createReportHandler({
  store: storeFromEnv(process.env),
  // The database token is already a long secret in the environment, and is
  // only used here to salt the rate-limit key.
  secret: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
});
