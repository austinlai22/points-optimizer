// /api/mcp — PointCompass as a remote MCP server for AI assistants.
import { createMcpEndpoint } from '../mcp/server';
import { storeFromEnv } from '../store';

export default createMcpEndpoint({
  store: storeFromEnv(process.env),
  secret: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
});
