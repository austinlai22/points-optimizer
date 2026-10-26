import { describe, expect, it } from 'vitest';
import { readPeriod } from '../analytics';
import { createMemoryStore } from '../store';
import { createReportHandler } from './handler';

const NOW = new Date('2026-10-23T15:30:00Z');

const VALID = {
  card_type: 'reserve',
  booking_type: 'flight',
  origin: 'JFK',
  destination: 'LIS',
  trip_type: 'one_way',
  travel_month: '2027-05',
  cabin: 'economy',
  cash_price_usd: 900,
  chase_points_price: 60000,
  boost_shown: 'yes',
};

function setup() {
  const store = createMemoryStore();
  const handler = createReportHandler({ store, secret: 'test-secret', now: () => NOW });
  const send = (body: unknown, ip = '203.0.113.7') =>
    handler.fetch(
      new Request('https://x/api/report', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'x-forwarded-for': ip, 'user-agent': 'TestBrowser/1.0' },
      }),
    );
  return { store, send };
}

function storedReports(store: ReturnType<typeof createMemoryStore>) {
  return [...store.dump()].filter(([k]) => k.startsWith('report:')).map(([, v]) => JSON.parse(v as string));
}

describe('price reports', () => {
  it('stores exactly the agreed fields, with the date and implied value worked out on the server', async () => {
    const { store, send } = setup();
    expect((await send(VALID)).status).toBe(201);
    const [report] = storedReports(store);
    expect(report).toEqual({ ...VALID, travel_date: null, airline: null, fare: null, hotel_chain: null, submitted_on: '2026-10-23', implied_cpp: 1.5, source: 'visitor' });
  });

  it('stores nothing about the sender', async () => {
    const { store, send } = setup();
    await send(VALID);
    const everything = JSON.stringify([...store.dump()]);
    expect(everything).not.toContain('203.0.113.7');
    expect(everything).not.toContain('TestBrowser');
    expect(everything).not.toMatch(/15:30/);
  });

  it('keeps reports for the retention period, then lets them expire', async () => {
    const { store, send } = setup();
    await send(VALID);
    const key = [...store.dump().keys()].find((k) => k.startsWith('report:'))!;
    const days = store.ttl(key)! / 86400;
    expect(days).toBeGreaterThan(720);
    expect(days).toBeLessThan(740);
  });

  it('rejects an implausible price and counts it, without storing it', async () => {
    const { store, send } = setup();
    // 600 points for $900 is 150¢ a point: a missing zero, not a real price.
    const response = await send({ ...VALID, chase_points_price: 6000 });
    expect(response.status).toBe(422);
    expect(storedReports(store)).toHaveLength(0);
    const stats = await readPeriod(store, '2026-10-23', '2026-10-23');
    expect(stats.counts.price_report_rejected).toBe(1);
  });

  it('refuses extra fields and free text', async () => {
    const { store, send } = setup();
    expect((await send({ ...VALID, note: 'my name is Sam' })).status).toBe(400);
    expect((await send({ ...VALID, destination: 'Lisbon, Portugal' })).status).toBe(400);
    expect(storedReports(store)).toHaveLength(0);
  });

  it('limits how many reports one sender can make in an hour', async () => {
    const { send } = setup();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await send(VALID)).status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(10);
    expect(statuses.slice(-2)).toEqual([429, 429]);
    // A different sender is unaffected.
    expect((await send(VALID, '198.51.100.4')).status).toBe(201);
  });

  it('counts each stored report', async () => {
    const { store, send } = setup();
    await send(VALID);
    const stats = await readPeriod(store, '2026-10-23', '2026-10-23');
    expect(stats.counts.price_report).toBe(1);
  });

  it('says sharing is unavailable without a store', async () => {
    const handler = createReportHandler({ store: null, secret: 'x' });
    const response = await handler.fetch(new Request('https://x/api/report', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(503);
  });
});
