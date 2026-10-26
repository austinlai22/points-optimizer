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

  it('reports every metric per week', async () => {
    const store = createMemoryStore();
    const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
    await recordEvent(store, { name: 'trip_check', verdict: 'PAY_CASH' }, id, at('2026-10-13'));
    await recordEvent(store, { name: 'trip_check', verdict: 'TRANSFER_POINTS' }, id, at('2026-10-20'));
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
