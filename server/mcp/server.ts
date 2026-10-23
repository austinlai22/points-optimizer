import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { recordEvent } from '../analytics';
import { allow } from '../ratelimit';
import type { Store } from '../store';
import {
  BANKS,
  CHASE_CARD_TYPES,
  chaseTravelBreakeven,
  computeCentsPerPoint,
  listTransferPartners,
  pointsBoostRules,
  recommendPayment,
  ToolInputError,
} from './tools';
import type { ChaseCardType } from '../../src/lib/verdict/types';

// /api/mcp: PointCompass as a tool for AI assistants (a remote MCP server).
// Read-only and stateless: no tool writes anything or stores anything about
// the caller, apart from a bare per-tool call count.

const LIMITS =
  'PointCompass does not look up live fares, hotel rates, award availability or Points Boost offers. It works only with prices supplied in the request.';

export interface McpDeps {
  store: Store | null;
  secret: string;
}

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

function reply(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

// Runs a tool, counts the call, and turns bad input into a clear error result
// instead of a crash.
function run(deps: McpDeps, tool: string, work: () => unknown): Promise<ToolResult> {
  const count = deps.store
    ? recordEvent(deps.store, { name: 'agent_call', tool }, null).catch(() => undefined)
    : Promise.resolve();
  return count.then(() => {
    try {
      return reply(work());
    } catch (error) {
      if (error instanceof ToolInputError || error instanceof RangeError) {
        return { isError: true, content: [{ type: 'text', text: error.message }] };
      }
      throw error;
    }
  });
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const bank = z.enum(BANKS).describe('The bank whose points these are.');
const chaseCard = z.enum(CHASE_CARD_TYPES as [ChaseCardType, ...ChaseCardType[]]);
const usd = z.number().positive().max(1_000_000);
const points = z.number().int().positive().max(50_000_000);

export function createPointCompassServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'pointcompass', version: '3.0.0' });

  server.registerTool(
    'list_transfer_partners',
    {
      title: 'List transfer partners',
      description: `List the airline and hotel programs a bank's points transfer to, with each ratio, its source and the date it was checked. ${LIMITS}`,
      inputSchema: z.object({ bank }),
      annotations: readOnly,
    },
    ({ bank }) => run(deps, 'list_transfer_partners', () => listTransferPartners(bank)),
  );

  server.registerTool(
    'compute_cents_per_point',
    {
      title: 'Compute cents per point',
      description: `Work out what a redemption gets per point: (cash price − taxes) × 100 ÷ points. ${LIMITS}`,
      inputSchema: z.object({
        cash_price_usd: usd.describe('What the trip costs in cash.'),
        points_price: points.describe('Points the redemption costs.'),
        taxes_usd: z.number().min(0).max(100_000).default(0).describe('Cash still payable on an award (taxes, surcharges). 0 for portal prices.'),
      }),
      annotations: readOnly,
    },
    ({ cash_price_usd, points_price, taxes_usd }) =>
      run(deps, 'compute_cents_per_point', () => computeCentsPerPoint(cash_price_usd, points_price, taxes_usd)),
  );

  server.registerTool(
    'chase_travel_breakeven',
    {
      title: 'Chase Travel breakeven',
      description: `The most points a Chase Travel price can be while still giving at least a target value per point: floor(cash × 100 ÷ target). ${LIMITS}`,
      inputSchema: z.object({
        cash_price_usd: usd.describe('What the trip costs in cash.'),
        target_cents_per_point: z.number().positive().max(20).describe('The value per point to beat, in cents, e.g. 1.25.'),
      }),
      annotations: readOnly,
    },
    ({ cash_price_usd, target_cents_per_point }) =>
      run(deps, 'chase_travel_breakeven', () => chaseTravelBreakeven(cash_price_usd, target_cents_per_point)),
  );

  server.registerTool(
    'points_boost_rules',
    {
      title: 'Chase Points Boost rules',
      description: `Chase's own stated Points Boost and legacy-rate rules for a Chase card, with links and dates. Anything Chase hasn't stated is marked "not stated by Chase". ${LIMITS}`,
      inputSchema: z.object({ card_type: chaseCard.describe('The Chase card the points are on.') }),
      annotations: readOnly,
    },
    ({ card_type }) => run(deps, 'points_boost_rules', () => pointsBoostRules(card_type)),
  );

  server.registerTool(
    'recommend_payment',
    {
      title: 'Recommend how to pay for a trip',
      description: `Recommend paying cash, transferring points, booking in Chase Travel or another bank's portal, or waiting, for one trip. The same engine as pointcompass.vercel.app, with its reasons and assumptions. Supply a cash position to include the check on whether paying cash would leave the traveller short. ${LIMITS}`,
      inputSchema: z.object({
        trip_cash_price_usd: usd.describe('What the trip costs in cash.'),
        balances: z.partialRecord(z.enum(BANKS), z.number().int().min(0).max(50_000_000)).describe('Points held at each bank, e.g. {"chase": 80000, "amex": 45000}.'),
        chase_card_type: chaseCard.optional().describe('The Chase card the points are on, if any.'),
        reserve_applied_before_2025_06_23: z.boolean().optional().describe('Sapphire Reserve only: applied before June 23, 2025 (enables the 1.5¢ legacy rate).'),
        chase_travel_points_price: points.optional().describe('A points price seen in Chase Travel for this trip.'),
        award_taxes_usd: z.number().min(0).max(100_000).optional().describe('Cash still payable on the award, if one is given.'),
        award: z
          .object({
            program: z.string().min(2).max(80).describe('A program_id from list_transfer_partners, or its name.'),
            points_required: points.describe('The award price in that program’s points.'),
            points_already_held: z.number().int().min(0).max(50_000_000).optional(),
          })
          .optional()
          .describe('An award price found with an airline or hotel program.'),
        cash_position: z
          .object({
            available_usd: z.number().min(0).max(100_000_000),
            monthly_leftover_usd: z.number().min(-10_000_000).max(10_000_000),
            monthly_spending_usd: z.number().min(0).max(10_000_000),
          })
          .optional()
          .describe('Cash available for travel, what is left after bills each month (may be negative), and typical monthly spending.'),
        value_points_at: z.enum(['cashBack', 'guaranteed', 'transfer']).optional().describe('Usual value of points: cash back, guaranteed travel (default), or potential transfer value (an estimate).'),
      }),
      annotations: readOnly,
    },
    (input) => run(deps, 'recommend_payment', () => recommendPayment(input)),
  );

  return server;
}

// Only browsers send Origin. Requests from AI assistants' servers don't, so
// those pass; a browser page on another site is turned away (the spec's DNS
// rebinding protection).
const ALLOWED_ORIGINS = new Set(['https://pointcompass.vercel.app', 'https://claude.ai', 'https://claude.com']);

const MCP_CALLS_PER_HOUR = 300;

export function createMcpEndpoint(deps: McpDeps) {
  const mcp = createMcpHandler(() => createPointCompassServer(deps));
  return {
    async fetch(request: Request): Promise<Response> {
      const origin = request.headers.get('origin');
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response('Forbidden', { status: 403 });
      if (deps.store && request.method === 'POST') {
        const permitted = await allow(deps.store, 'mcp', request, {
          limit: MCP_CALLS_PER_HOUR,
          windowSeconds: 3600,
          secret: deps.secret,
        });
        if (!permitted) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '3600' } });
      }
      return mcp.fetch(request);
    },
  };
}
