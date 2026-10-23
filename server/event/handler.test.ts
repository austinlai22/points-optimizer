import { describe, expect, it } from 'vitest';
import { readPeriod, recordEvent } from '../analytics';
import { createMemoryStore } from '../store';
import { createEventHandler } from './handler';

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const OTHER = '7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';

function post(handler: ReturnType<typeof createEventHandler>, body: unknown) {
  return handler.fetch(new Request('https://x/api/event', { method: 'POST', body: JSON.stringify(body) }));
}

describe('event endpoint', () => {
  it('counts trip checks by verdict, and price checks without any id', async () => {
    const store = createMemoryStore();
    const handler = createEventHandler({ store });
    expect((await post(handler, { event: 'trip_check', verdict: 'TRANSFER_POINTS', id: ID })).status).toBe(204);
    expect((await post(handler, { event: 'price_check' })).status).toBe(204);

    const today = new Date().toISOString().slice(0, 10);
    const stats = await readPeriod(store, today, today);
    expect(stats.counts).toEqual({ 'trip_check:TRANSFER_POINTS': 1, price_check: 1 });
    expect(stats.activeUsers).toBe(1);
  });

  it('refuses anything outside the two events the browser sends', async () => {
    const store = createMemoryStore();
    const handler = createEventHandler({ store });
    for (const body of [
      { event: 'trip_check', verdict: 'SOMETHING', id: ID },
      { event: 'trip_check', verdict: 'PAY_CASH', id: 'not-a-uuid' },
      { event: 'page_view', id: ID },
      { event: 'price_report' },
      900,
    ]) {
      expect((await post(handler, body)).status).toBe(400);
    }
    expect(store.dump().size).toBe(0);
  });

  it('has no way to read counts back over the web', async () => {
    const handler = createEventHandler({ store: createMemoryStore() });
    expect((await handler.fetch(new Request('https://x/api/event'))).status).toBe(405);
  });

  it('does nothing, quietly, without a store', async () => {
    const handler = createEventHandler({ store: null });
    expect((await post(handler, { event: 'price_check' })).status).toBe(204);
  });
});

describe('weekly active and returning users', () => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`);

  it('counts distinct ids across a week, and returning ones only from their second day', async () => {
    const store = createMemoryStore();
    const check = { name: 'trip_check', verdict: 'PAY_CASH' } as const;
    await recordEvent(store, check, ID, day('2026-10-19'));
    await recordEvent(store, check, ID, day('2026-10-19'));
    await recordEvent(store, check, OTHER, day('2026-10-20'));
    await recordEvent(store, check, ID, day('2026-10-22'));

    const week = await readPeriod(store, '2026-10-19', '2026-10-25');
    expect(week.counts['trip_check:PAY_CASH']).toBe(4);
    expect(week.activeUsers).toBe(2);
    // ID came back on a second day; OTHER only ever visited once.
    expect(week.returningUsers).toBe(1);
  });

  it('keeps per-id day lists only for a limited time', async () => {
    const store = createMemoryStore();
    await recordEvent(store, { name: 'trip_check', verdict: 'PAY_CASH' }, ID, day('2026-10-19'));
    expect(store.ttl(`stats:iddays:${ID}`)).toBe(120 * 24 * 60 * 60);
  });

  it('never attaches an id to agent calls or price reports', async () => {
    const store = createMemoryStore();
    await recordEvent(store, { name: 'agent_call', tool: 'list_transfer_partners' }, null, day('2026-10-19'));
    await recordEvent(store, { name: 'price_report' }, null, day('2026-10-19'));
    expect([...store.dump().keys()].some((k) => k.includes('iddays') || k.includes('active'))).toBe(false);
  });
});
