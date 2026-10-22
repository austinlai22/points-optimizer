import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../store';
import { createEventHandler } from './handler';

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const TOKEN = 'a-long-enough-stats-token';

function post(handler: ReturnType<typeof createEventHandler>, body: unknown) {
  return handler.fetch(new Request('https://x/api/event', { method: 'POST', body: JSON.stringify(body) }));
}

describe('event counting', () => {
  it('counts verdicts by type and users by anonymous id', async () => {
    const store = createMemoryStore();
    const handler = createEventHandler({ store, statsToken: TOKEN });
    expect((await post(handler, { event: 'verdict_shown', verdict: 'TRANSFER_POINTS', id: ID })).status).toBe(204);
    await post(handler, { event: 'pasted_price_used', id: ID });

    const stats = await (
      await handler.fetch(new Request('https://x/api/event', { headers: { authorization: `Bearer ${TOKEN}` } }))
    ).json();
    expect(stats.allTime).toEqual({
      'verdict_shown:web:TRANSFER_POINTS': 1,
      'pasted_price_used:web': 1,
    });
    expect(stats.uniqueUsers).toEqual({ web: 1, whatsapp: 0 });
  });

  it('refuses anything outside the measured events', async () => {
    const store = createMemoryStore();
    const handler = createEventHandler({ store, statsToken: TOKEN });
    for (const body of [
      { event: 'verdict_shown', verdict: 'SOMETHING', id: ID },
      { event: 'page_view', id: ID },
      { event: 'pasted_price_used', id: 'not-a-uuid' },
      900,
    ]) {
      expect((await post(handler, body)).status).toBe(400);
    }
    expect(store.dump().size).toBe(0);
  });

  it('hides the counts without the token', async () => {
    const handler = createEventHandler({ store: createMemoryStore(), statsToken: TOKEN });
    const response = await handler.fetch(
      new Request('https://x/api/event', { headers: { authorization: 'Bearer wrong' } }),
    );
    expect(response.status).toBe(404);
  });
});
