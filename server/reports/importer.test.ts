import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../experiment/csv';
import { allReports, REPORT_COLUMNS, toCsv } from '../admin';
import { createMemoryStore } from '../store';
import { createReportHandler } from './handler';
import { checkRows, importReports } from './importer';

const TODAY = '2026-10-23';
const NOW = new Date(`${TODAY}T12:00:00Z`);
const HEADER = 'submitted_on,card_type,booking_type,origin,destination,travel_month,cabin,cash_price_usd,chase_points_price,boost_shown';

const csv = (...lines: string[]) => parseCsv([HEADER, ...lines].join('\n'));

describe('bulk import of your own price entries', () => {
  it('accepts friendly formatting and marks entries as admin', () => {
    const [row] = checkRows(csv('2026-10-20,reserve,Flight,jfk,lis,2027-05,Premium Economy,"$1,900",95000,Yes'), TODAY);
    expect(row.errors).toEqual([]);
    expect(row.report).toEqual({
      card_type: 'reserve',
      booking_type: 'flight',
      origin: 'JFK',
      destination: 'LIS',
      trip_type: 'one_way',
      travel_month: '2027-05',
      travel_date: null,
      cabin: 'premium_economy',
      airline: null,
      fare: null,
      hotel_chain: null,
      cash_price_usd: 1900,
      chase_points_price: 95000,
      boost_shown: 'yes',
      submitted_on: '2026-10-20',
      implied_cpp: 2,
      source: 'admin',
    });
  });

  it('turns airline names into codes, and accepts codes', () => {
    const header = `${HEADER},airline`;
    const rows = parseCsv([header, '2026-10-20,reserve,flight,SFO,LGA,2027-01,basic,452,45141,no,Southwest', '2026-10-20,reserve,flight,SFO,LGA,2027-01,economy,387,38640,no,dl', '2026-10-20,reserve,flight,SFO,LGA,2027-01,economy,387,38640,no,Delta Air Lines', '2026-10-20,reserve,flight,SFO,LGA,2027-01,economy,387,38640,no,Not An Airline'].join('\n'));
    const checks = checkRows(rows, TODAY);
    expect(checks.map((c) => c.report?.airline ?? null)).toEqual(['WN', 'DL', 'DL', null]);
    expect(checks[3].errors.join()).toMatch(/airline PointCompass tracks/);
  });

  it('reads fare names as written, and fills in the cabin from them', () => {
    const header = `${HEADER},airline,fare`;
    const rows = parseCsv([header, '2026-10-20,reserve,flight,SFO,LGA,2027-01,,452,45141,no,Southwest,Choice Preferred', '2026-10-20,reserve,flight,SFO,LGA,2027-01,,387,38640,no,DL,Delta Main Basic', '2026-10-20,reserve,flight,SFO,LGA,2027-01,first,1377,137639,no,DL,first_classic'].join('\n'));
    const checks = checkRows(rows, TODAY);
    expect(checks.map((c) => c.errors)).toEqual([[], [], []]);
    expect(checks.map((c) => [c.report?.fare, c.report?.cabin])).toEqual([
      ['choice_preferred', 'economy'], ['main_basic', 'basic_economy'], ['first_classic', 'first'],
    ]);
  });

  it('reads a flight as one way unless the file says round trip', () => {
    const header = `${HEADER},trip_type`;
    const rows = parseCsv([header, '2026-10-20,reserve,flight,SFO,LGA,2027-01,,452,45141,no,', '2026-10-20,reserve,flight,SFO,LGA,2027-01,,452,45141,no,Round trip', '2026-10-20,reserve,flight,SFO,LGA,2027-01,,452,45141,no,one-way', ',reserve,hotel,,PAR,2026-12,,1200,60000,no,'].join('\n'));
    expect(checkRows(rows, TODAY).map((c) => c.report?.trip_type)).toEqual(['one_way', 'round_trip', 'one_way', null]);
  });

  it('works out the month from a travel date', () => {
    const header = `${HEADER},travel_date`;
    const rows = parseCsv([header, '2026-10-20,reserve,flight,SFO,LGA,,,452,45141,no,2027-01-14'].join('\n'));
    const [row] = checkRows(rows, TODAY);
    expect(row.errors).toEqual([]);
    expect(row.report).toMatchObject({ travel_month: '2027-01', travel_date: '2027-01-14' });
  });

  it('turns hotel chain names into program ids', () => {
    const header = `${HEADER},hotel_chain`;
    const rows = parseCsv([header, ',reserve,hotel,,PAR,2026-12,,1200,60000,no,Hyatt', ',reserve,hotel,,PAR,2026-12,,1200,60000,no,World of Hyatt', ',reserve,hotel,,PAR,2026-12,,1200,60000,no,Independent', ',reserve,hotel,,PAR,2026-12,,1200,60000,no,Motel 6'].join('\n'));
    const checks = checkRows(rows, TODAY);
    expect(checks.map((c) => c.report?.hotel_chain ?? null)).toEqual(['hyatt', 'hyatt', 'independent', null]);
    expect(checks[3].errors.join()).toMatch(/hotel program PointCompass tracks/);
  });

  it('accepts a file written before the airline column existed', () => {
    const [row] = checkRows(csv('2026-10-20,reserve,flight,JFK,LIS,2027-05,,900,60000,yes'), TODAY);
    expect(row.report?.airline).toBeNull();
  });

  it('accepts basic economy, written several ways', () => {
    for (const written of ['basic', 'Basic Economy', 'basic_economy', 'basic-economy']) {
      const [row] = checkRows(csv(`2026-10-20,reserve,flight,JFK,LIS,2027-05,${written},900,60000,no`), TODAY);
      expect(row.report?.cabin, written).toBe('basic_economy');
    }
  });

  it('treats a blank date as today and a hotel row without origin or cabin as valid', () => {
    const [row] = checkRows(csv(',preferred,hotel,,PAR,2026-12,,1200,60000,no'), TODAY);
    expect(row.report).toMatchObject({ submitted_on: TODAY, origin: null, cabin: null, implied_cpp: 2 });
  });

  it('reports problems by spreadsheet line, including dates and implausible prices', () => {
    const checks = checkRows(
      csv(
        '2026-10-20,reserve,flight,JFK,LIS,2027-05,,900,60000,yes',
        '2026-12-01,reserve,flight,JFK,LIS,2027-05,,900,60000,yes',
        '2024-01-01,reserve,flight,JFK,LIS,2024-05,,900,60000,yes',
        '2026-10-20,reserve,flight,JFK,LIS,2027-05,,900,6000,yes',
        '2026-10-20,platinum,boat,JFK,Lisbon,2027-05,,900,60000,maybe',
      ),
      TODAY,
    );
    expect(checks.map((c) => c.line)).toEqual([2, 3, 4, 5, 6]);
    expect(checks[0].errors).toEqual([]);
    expect(checks[1].errors.join()).toMatch(/future/);
    expect(checks[2].errors.join()).toMatch(/older than the retention period/);
    expect(checks[3].errors.join()).toMatch(/outside the 0.3¢ to 5¢/);
    expect(checks[4].errors.length).toBeGreaterThanOrEqual(3);
  });

  it('stores nothing when any row has a problem, unless told to skip them', async () => {
    const rows = csv(
      '2026-10-20,reserve,flight,JFK,LIS,2027-05,,900,60000,yes',
      '2026-10-20,reserve,flight,JFK,Lisbon,2027-05,,900,60000,yes',
    );
    const store = createMemoryStore();
    expect(await importReports(store, rows, { today: TODAY, now: NOW })).toMatchObject({ stored: 0 });
    expect(await allReports(store)).toHaveLength(0);

    expect(await importReports(store, rows, { today: TODAY, now: NOW, skipInvalid: true })).toMatchObject({ stored: 1 });
    expect(await allReports(store)).toHaveLength(1);
  });

  it('stores nothing on a dry run', async () => {
    const store = createMemoryStore();
    const rows = csv('2026-10-20,reserve,flight,JFK,LIS,2027-05,,900,60000,yes');
    expect(await importReports(store, rows, { today: TODAY, now: NOW, dryRun: true })).toMatchObject({ checked: 1, stored: 0, problems: [] });
    expect(store.dump().size).toBe(0);
  });

  it('deletes an older entry 24 months after the day it was seen, not after the import', async () => {
    const store = createMemoryStore();
    await importReports(store, csv('2025-10-23,reserve,flight,JFK,LIS,2026-05,,900,60000,yes'), { today: TODAY, now: NOW });
    const key = [...store.dump().keys()].find((k) => k.startsWith('report:'))!;
    const daysLeft = store.ttl(key)! / 86400;
    // Seen a year ago, so about a year remains.
    expect(daysLeft).toBeGreaterThan(360);
    expect(daysLeft).toBeLessThan(370);
  });

  it('keeps visitor and admin reports apart in the export', async () => {
    const store = createMemoryStore();
    const handler = createReportHandler({ store, secret: 'x', now: () => NOW });
    await handler.fetch(
      new Request('https://x/api/report', {
        method: 'POST',
        body: JSON.stringify({
          card_type: 'reserve', booking_type: 'hotel', origin: null, destination: 'PAR', travel_month: '2026-12',
          cabin: null, cash_price_usd: 1200, chase_points_price: 60000, boost_shown: 'yes',
        }),
      }),
    );
    await importReports(store, csv('2026-10-20,reserve,flight,JFK,LIS,2027-05,,900,60000,yes'), { today: TODAY, now: NOW });
    // A report saved before the source field existed counts as a visitor's.
    await store.set('report:old', JSON.stringify({ submitted_on: '2026-10-01', card_type: 'other', booking_type: 'hotel', origin: null, destination: 'NYC', travel_month: '2026-11', cabin: null, cash_price_usd: 500, chase_points_price: 50000, boost_shown: 'no', implied_cpp: 1 }));

    const sources = (await allReports(store)).map((r) => r.source).sort();
    expect(sources).toEqual(['admin', 'visitor', 'visitor']);
    expect(toCsv((await allReports(store)) as unknown as Record<string, unknown>[], REPORT_COLUMNS).split('\n')[0]).toMatch(/,source$/);
  });

  it("won't let a website visitor claim to be admin", async () => {
    const store = createMemoryStore();
    const handler = createReportHandler({ store, secret: 'x', now: () => NOW });
    const response = await handler.fetch(
      new Request('https://x/api/report', {
        method: 'POST',
        body: JSON.stringify({
          card_type: 'reserve', booking_type: 'hotel', origin: null, destination: 'PAR', travel_month: '2026-12',
          cabin: null, cash_price_usd: 1200, chase_points_price: 60000, boost_shown: 'yes', source: 'admin',
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await allReports(store)).toHaveLength(0);
  });
});
