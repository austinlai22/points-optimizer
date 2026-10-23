import { describe, expect, it } from 'vitest';
import cardsData from '../../src/data/cards.json';
import transferPartnersData from '../../src/data/transferPartners.json';
import { breakevenPoints, evaluateVerdict } from '../../src/lib/verdict';
import type { CardConfig, TransferPartner } from '../../src/types';
import { readPeriod } from '../analytics';
import { createMemoryStore } from '../store';
import { createMcpEndpoint } from './server';
import {
  BANKS,
  chaseTravelBreakeven,
  computeCentsPerPoint,
  listTransferPartners,
  pointsBoostRules,
  recommendPayment,
  ToolInputError,
} from './tools';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];
const card = (id: string) => cards.find((c) => c.id === id)!;
const TODAY = '2026-10-23';

// Every object in a tool result that states a fact must say where it came
// from and when that was checked.
function factsWithoutSource(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => factsWithoutSource(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const missing = 'source_url' in obj && (!obj.source_url || !obj.verified_on) ? [path] : [];
    return [...missing, ...Object.entries(obj).flatMap(([k, v]) => factsWithoutSource(v, `${path}.${k}`))];
  }
  return [];
}

describe('agent tools match the web app', () => {
  it('lists the same partners and ratios as the data file, each sourced and dated', () => {
    for (const bank of BANKS) {
      const result = listTransferPartners(bank);
      expect(factsWithoutSource(result), bank).toEqual([]);
      for (const p of result.partners) {
        expect(p.source_url, `${bank}/${p.program_id}`).toMatch(/^https:\/\//);
        expect(p.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    const chase = listTransferPartners('chase');
    const expected = transferPartners.filter((p) => p.ratiosByIssuer.chase !== undefined);
    expect(chase.partner_count).toBe(expected.length);
    expect(chase.partners.find((p) => p.program_id === 'hyatt')?.points_received_per_point).toBe(1);
    expect(chase.card_exceptions.find((e) => e.applies_to === 'World of Hyatt')?.ratio_multiplier).toBe(0.75);
    expect(listTransferPartners('bank_of_america').partner_count).toBe(0);
  });

  it('computes cents per point with the same formula as the recommendation', () => {
    const web = evaluateVerdict({
      tripCashPrice: 900,
      awardTaxes: 90,
      ownedCards: [card('csr')],
      balances: { csr: 150_000 },
      transferPartners,
      award: { partnerId: 'united', pointsRequired: 60_000 },
      cash: { available: 6000, monthlyLeftover: 300, monthlySpend: 2500 },
      today: TODAY,
    });
    const webTransfer = web.options.find((o) => o.kind === 'transfer')!;
    expect(computeCentsPerPoint(900, 60_000, 90).cents_per_point).toBeCloseTo(webTransfer.cppCents!, 3);
  });

  it('gives the same breakeven as the engine', () => {
    expect(chaseTravelBreakeven(1000, 1.6).max_points_price).toBe(62_500);
    expect(chaseTravelBreakeven(1000, 1.2).max_points_price).toBe(breakevenPoints(1000, 1.2));
  });

  it("returns only Chase's stated Boost rules, saying when Chase hasn't stated one", () => {
    expect(pointsBoostRules('reserve').points_boost.max_multiplier).toBe(2);
    expect(pointsBoostRules('reserve').legacy_rate).toMatchObject({ cents_per_point: 1.5, ends_on: '2027-10-26' });
    expect(pointsBoostRules('inkPlus').points_boost.max_multiplier).toBe('not stated by Chase');
    expect(pointsBoostRules('preferred').legacy_rate?.cents_per_point).toBeNull();
    for (const type of ['reserve', 'preferred', 'inkPlus', 'other'] as const) {
      expect(factsWithoutSource(pointsBoostRules(type)), type).toEqual([]);
    }
  });

  it('recommends exactly what the web app recommends for the same trip', () => {
    const cash = { available: 6000, monthlyLeftover: 300, monthlySpend: 2500 };
    const web = evaluateVerdict({
      tripCashPrice: 900,
      awardTaxes: 90,
      ownedCards: [card('csr')],
      balances: { csr: 150_000 },
      transferPartners,
      award: { partnerId: 'united', pointsRequired: 60_000 },
      chase: { cardType: 'reserve', reserveAppliedBeforeCutoff: false },
      cash,
      today: TODAY,
    });
    const agent = recommendPayment(
      {
        trip_cash_price_usd: 900,
        award_taxes_usd: 90,
        balances: { chase: 150_000 },
        chase_card_type: 'reserve',
        reserve_applied_before_2025_06_23: false,
        award: { program: 'United MileagePlus', points_required: 60_000 },
        cash_position: { available_usd: 6000, monthly_leftover_usd: 300, monthly_spending_usd: 2500 },
      },
      TODAY,
    );
    expect(agent.recommendation).toBe(web.verdict);
    expect(agent.reason).toBe(web.reason);
    expect(agent.chase_travel?.breakeven_points).toBe(web.chaseTravel?.breakevenPoints);
    expect(factsWithoutSource(agent)).toEqual([]);
  });

  it('says plainly when no cash position was given', () => {
    const result = recommendPayment({ trip_cash_price_usd: 500, balances: { capital_one: 100_000 } }, TODAY);
    expect(result.assumptions.join(' ')).toMatch(/No cash position was given/);
    expect(result.cash_after_paying).toBeNull();
  });

  it('turns bad input into clear errors', () => {
    expect(() => computeCentsPerPoint(900, 0)).toThrow(ToolInputError);
    expect(() => computeCentsPerPoint(100, 1000, 200)).toThrow(/cannot exceed/);
    expect(() => chaseTravelBreakeven(900, 0)).toThrow(ToolInputError);
    expect(() =>
      recommendPayment({ trip_cash_price_usd: 900, balances: { chase: 1 }, award: { program: 'Nonexistent Air', points_required: 1000 } }),
    ).toThrow(/Unknown program/);
    expect(() =>
      recommendPayment({ trip_cash_price_usd: 900, balances: { chase: 1 }, award: { program: 'air', points_required: 1000 } }),
    ).toThrow(/matches/);
  });
});

// The 2025 protocol revision Claude's custom connectors use, over HTTP,
// against the real endpoint.
describe('the /api/mcp endpoint', () => {
  async function call(endpoint: ReturnType<typeof createMcpEndpoint>, body: unknown, headers: Record<string, string> = {}) {
    const response = await endpoint.fetch(
      new Request('https://pointcompass.vercel.app/api/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
          'x-forwarded-for': '203.0.113.9',
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
    const text = await response.text();
    // A legacy response may come back as JSON or as a one-message SSE stream.
    const json = text.startsWith('{') ? text : text.split('\n').find((l) => l.startsWith('data:'))?.slice(5);
    return { status: response.status, body: json ? JSON.parse(json) : null };
  }

  it('initializes, lists the five read-only tools, and answers a call', async () => {
    const store = createMemoryStore();
    const endpoint = createMcpEndpoint({ store, secret: 'test' });

    const init = await call(endpoint, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe('pointcompass');

    const list = await call(endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = list.body.result.tools as { name: string; description: string; annotations: { readOnlyHint: boolean } }[];
    expect(tools.map((t) => t.name).sort()).toEqual([
      'chase_travel_breakeven',
      'compute_cents_per_point',
      'list_transfer_partners',
      'points_boost_rules',
      'recommend_payment',
    ]);
    for (const tool of tools) {
      expect(tool.description, tool.name).toMatch(/does not look up live fares/);
      expect(tool.annotations.readOnlyHint, tool.name).toBe(true);
    }

    const result = await call(endpoint, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'chase_travel_breakeven', arguments: { cash_price_usd: 1000, target_cents_per_point: 1.6 } },
    });
    expect(JSON.parse(result.body.result.content[0].text).max_points_price).toBe(62_500);

    // Counted by tool, with no id attached.
    const today = new Date().toISOString().slice(0, 10);
    expect((await readPeriod(store, today, today)).counts['agent_call:chase_travel_breakeven']).toBe(1);
  });

  it('returns a clear error, not a crash, for invalid arguments', async () => {
    const endpoint = createMcpEndpoint({ store: null, secret: 'test' });
    const bad = await call(endpoint, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'compute_cents_per_point', arguments: { cash_price_usd: -5, points_price: 1000 } },
    });
    expect(bad.status).toBe(200);
    expect(bad.body.result?.isError ?? Boolean(bad.body.error)).toBe(true);
  });

  it('turns away a browser page from another site', async () => {
    const endpoint = createMcpEndpoint({ store: null, secret: 'test' });
    const response = await endpoint.fetch(
      new Request('https://pointcompass.vercel.app/api/mcp', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }),
    );
    expect(response.status).toBe(403);
  });

  it('rate-limits one sender without storing their address', async () => {
    const store = createMemoryStore();
    const endpoint = createMcpEndpoint({ store, secret: 'test' });
    const ping = { jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} };
    let last = 0;
    for (let i = 0; i < 301; i++) last = (await call(endpoint, ping)).status;
    expect(last).toBe(429);
    expect(JSON.stringify([...store.dump()])).not.toContain('203.0.113.9');
  });
});
