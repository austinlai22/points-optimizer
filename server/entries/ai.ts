// /api/ai — PointCompass's own use of Google Gemini (see server/ai/handler.ts).
import { createAiHandler, modelsFrom } from '../ai/handler';
import { storeFromEnv } from '../store';

export default createAiHandler({
  store: storeFromEnv(process.env),
  apiKey: process.env.GEMINI_API_KEY || undefined,
  // GEMINI_MODEL may name one model or a comma-separated list to try in order.
  models: modelsFrom(process.env.GEMINI_MODEL),
  // Only salts the rate-limit key, as for price reports.
  secret: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  dailyLimit: Number(process.env.AI_DAILY_LIMIT) || 400,
});
