import { describe, expect, it } from 'vitest';
import { allReports, recentWeeks, REPORT_COLUMNS, toCsv, toRows, weeklyStats } from './admin';
import { recordEvent } from './analytics';
import { createMemoryStore } from './store';

const at = (d: string) => new Date(`${d}T12:00:00Z`);

describe('admin scripts', () => {
  it('splits time into Monday-to-Sunday weeks ending with the current one', () => {
    // 2026-10-23 is a Friday.
    expect(recentWeeks(2, at('2026-10-23'))).toEqual([
      { from: '2026-10-12', to: '2026-10-18' },
      { from: '2026-10-19', to: '2026-10-25' },
    ]);
  });

  it("counts each week's newcomers and how many came back within 30 days", async () => {
    const store = createMemoryStore();
    const [a, b, c] = ['3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', '7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f', '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'];
    const check = (id: string, day: string) => recordEvent(store, { name: 'trip_check', verdict: 'PAY_CASH', cash: false }, id, at(day));
    // Week of Oct 12: a, b and c are new. a comes back the same week, b three
    // weeks later, c never; a also checks twice on its first day.
    await check(a, '2026-10-13');
    await check(a, '2026-10-13');
    await check(b, '2026-10-14');
    await check(c, '2026-10-15');
    await check(a, '2026-10-16');
    await check(b, '2026-11-05');
    // b again much later: past 30 days, so no second count.
    await check(b, '2026-12-20');
    const [first] = toRows(await weeklyStats(store, 11, at('2026-12-21')));
    expect(first).toMatchObject({ week_starting: '2026-10-12', new_users: 3, came_back_within_30_days: 2 });

    // An id seen before first days were kept is neither new nor a comeback.
    const old = createMemoryStore();
    await old.sadd(`stats:iddays:${a}`, '2026-09-01');
    await recordEvent(old, { name: 'trip_check', verdict: 'PAY_CASH', cash: false }, a, at('2026-10-13'));
    await recordEvent(old, { name: 'trip_check', verdict: 'PAY_CASH', cash: false }, a, at('2026-10-14'));
    const [week] = toRows(await weeklyStats(old, 1, at('2026-10-14')));
    expect(week).toMatchObject({ new_users: 0, came_back_within_30_days: 0, returning_users: 1 });
  });

  it('reports visits by source and each step people take', async () => {
    const store = createMemoryStore();
    for (const source of ['reddit', 'reddit', 'search', 'direct']) await recordEvent(store, { name: 'visit', source }, null, at('2026-10-20'));
    await recordEvent(store, { name: 'trip_started' }, null, at('2026-10-20'));
    await recordEvent(store, { name: 'assistant_question' }, null, at('2026-10-20'));
    const [row] = toRows(await weeklyStats(store, 1, at('2026-10-21')));
    expect(row).toMatchObject({ visits: 4, visits_from_reddit: 2, visits_from_search: 1, visits_from_direct: 1, trips_started: 1, assistant_questions: 1 });
  });

  it('reports every metric per week', async () => {
    const store = createMemoryStore();
    const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
    await recordEvent(store, { name: 'trip_check', verdict: 'PAY_CASH', cash: true }, id, at('2026-10-13'));
    await recordEvent(store, { name: 'trip_check', verdict: 'TRANSFER_POINTS', cash: true }, id, at('2026-10-20'));
    await recordEvent(store, { name: 'price_check' }, null, at('2026-10-20'));
    await recordEvent(store, { name: 'price_report' }, null, at('2026-10-21'));
    await recordEvent(store, { name: 'agent_call', tool: 'compute_cents_per_point' }, null, at('2026-10-22'));

    const [previous, current] = toRows(await weeklyStats(store, 2, at('2026-10-23')));
    expect(previous).toMatchObject({ week_starting: '2026-10-12', trip_checks: 1, active_users: 1, returning_users: 0 });
    expect(current).toMatchObject({
      week_starting: '2026-10-19',
      trip_checks: 1,
      trip_checks_TRANSFER_POINTS: 1,
      active_users: 1,
      returning_users: 1,
      price_checks: 1,
      price_reports: 1,
      agent_calls: 1,
      agent_calls_compute_cents_per_point: 1,
    });
  });

  it('exports reports as CSV in a fixed column order', async () => {
    const store = createMemoryStore();
    const report = {
      submitted_on: '2026-10-23', card_type: 'reserve', booking_type: 'hotel', origin: null,
      destination: 'PAR', travel_month: '2026-12', cabin: null, cash_price_usd: 1200,
      chase_points_price: 60000, boost_shown: 'yes', implied_cpp: 2,
    };
    await store.set('report:a', JSON.stringify(report));
    const csv = toCsv((await allReports(store)) as unknown as Record<string, unknown>[], REPORT_COLUMNS);
    expect(csv).toBe(
      'submitted_on,card_type,booking_type,origin,destination,trip_type,travel_month,travel_date,cabin,airline,fare,hotel_chain,cash_price_usd,chase_points_price,boost_shown,implied_cpp,source\n' +
        '2026-10-23,reserve,hotel,,PAR,,2026-12,,,,,,1200,60000,yes,2,visitor\n',
    );
  });
});
