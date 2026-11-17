import transferPartnersData from '../../data/transferPartners.json';
import { formatCents, verdictHeadline } from '../verdict';
import type { PointsOption } from '../verdict/types';
import { describePointsOption, evaluateTrip, MAX_COMPARE, partnerName, type SavedTrip, type TripContext, type TripInputs, type TripVerdict } from '../trips';
import { planPoints } from '../planPoints';
import { ISSUER_LABELS } from '../../utils/issuers';
import { formatUSD, formatUSDExact } from '../../utils/format';
import type { Issuer, TransferPartner } from '../../types';
import { sanitizeParsedTrip, type ParsedTrip } from './protocol';

// The assistant's tools, run in the browser against the person's own cards,
// balances and saved trips. Only their results go to the AI, and those are
// built here to carry no balances and no cash amounts: points a booking would
// spend, yes; points held or dollars in the bank, never.

const transferPartners = transferPartnersData as TransferPartner[];

// A change the assistant suggests. Nothing happens until the person taps
// Apply on its card.
export type Proposal =
  | { kind: 'trip'; trip: TripInputs; summary: string; basedOn: string }
  | { kind: 'save'; name: string; trip: TripInputs; summary: string; basedOn: string }
  | { kind: 'compare'; tripIds: string[]; summary: string; basedOn: string };

export interface ToolContext {
  trip: TripContext;
  savedTrips: SavedTrip[];
  currentTrip: TripInputs | null;
  // Present on Check a trip: the programs its form can show.
  reachablePrograms?: Set<string>;
  // Where suggestions go, for the panel to show as cards.
  proposals?: Proposal[];
}

const basedOn = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : 'what you asked');

// "$900 cash, or 60,000 United MileagePlus points + $85", for a card.
export function describeTrip(t: TripInputs): string {
  const parts = [`${formatUSD(t.tripCashPrice)} cash`];
  const program = t.selectedPartnerId ? partnerName(t.selectedPartnerId) : null;
  if (program && t.pointsRequired > 0) {
    parts.push(`${Math.round(t.pointsRequired).toLocaleString('en-US')} ${program} points${t.awardCashFees > 0 ? ` + ${formatUSDExact(t.awardCashFees)}` : ''}`);
  }
  if (t.chaseTravelPoints > 0) parts.push(`${Math.round(t.chaseTravelPoints).toLocaleString('en-US')} points in Chase Travel`);
  return parts.join(', or ');
}

export function tripFromParsed(p: ParsedTrip, base: TripInputs | null = null): TripInputs {
  return {
    tripCashPrice: p.trip_cash_price_usd ?? base?.tripCashPrice ?? 0,
    selectedPartnerId: p.program ?? base?.selectedPartnerId ?? '',
    pointsRequired: p.award_points ?? (p.program && p.program !== base?.selectedPartnerId ? 0 : (base?.pointsRequired ?? 0)),
    partnerPointsHeld: p.partner_points_held ?? (p.program && p.program !== base?.selectedPartnerId ? 0 : (base?.partnerPointsHeld ?? 0)),
    awardCashFees: p.award_taxes_usd ?? (p.program && p.program !== base?.selectedPartnerId ? 0 : (base?.awardCashFees ?? 0)),
    chaseTravelPoints: p.chase_travel_points ?? base?.chaseTravelPoints ?? 0,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function describeForAi(o: PointsOption) {
  const { title, detail } = describePointsOption(o);
  return {
    way: `${title} (${detail})`,
    bank: ISSUER_LABELS[o.issuer],
    points_spent: Math.round(o.pointsUsed),
    partner_points_used: o.partnerPointsApplied || undefined,
    cents_per_point: o.cppCents === null ? null : round(o.cppCents),
    usual_cents_per_point: round(o.benchmarkCents),
    cash_still_due_usd: o.cashFees,
  };
}

// A recommendation as the AI may see it. The engine's own reason sentence is
// left out because it can quote cash figures; whether cash was a factor is
// given as a word instead.
export function shareableResult(trip: TripInputs, v: TripVerdict | null) {
  if (!v) return { error: 'Add a trip cash price to get a recommendation.' };
  return {
    trip: {
      cash_price_usd: trip.tripCashPrice,
      program: trip.selectedPartnerId ? partnerName(trip.selectedPartnerId) : null,
      award_points: trip.pointsRequired || null,
      award_taxes_usd: trip.awardCashFees || null,
      chase_travel_points: trip.chaseTravelPoints || null,
    },
    recommendation: verdictHeadline(v),
    cash_check: !v.cashConsidered ? 'cash position not given' : v.runway.payCash.strained ? 'paying cash would leave them stretched' : 'paying cash is affordable',
    options: v.options.slice(0, 4).map(describeForAi),
    chase_travel: v.chaseTravel
      ? { breakeven_points: v.chaseTravel.breakevenPoints, standard_points: Math.round(v.chaseTravel.nonBoostPoints), advice: v.chaseTravel.sentence }
      : null,
    assumptions: v.assumptions,
  };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): unknown {
  switch (name) {
    case 'check_trip': {
      const trip = tripFromParsed(sanitizeParsedTrip(args));
      return shareableResult(trip, evaluateTrip(trip, ctx.trip));
    }
    case 'propose_trip': {
      if (!ctx.reachablePrograms || !ctx.proposals) return { error: 'The trip form is on Check a trip, not this page.' };
      const parsed = sanitizeParsedTrip(args);
      if (parsed.program && !ctx.reachablePrograms.has(parsed.program)) {
        return { error: `None of their cards transfer to ${partnerName(parsed.program)}, so the form can't show that award.` };
      }
      const trip = tripFromParsed(parsed, ctx.currentTrip);
      if (!(trip.tripCashPrice > 0)) return { error: 'Needs the trip cash price. Ask for it.' };
      // One trip suggestion at a time: a newer one replaces the last.
      const others = ctx.proposals.filter((p) => p.kind !== 'trip');
      ctx.proposals.splice(0, ctx.proposals.length, ...others, { kind: 'trip', trip, summary: describeTrip(trip), basedOn: basedOn(args.based_on) });
      return { proposed: true, waiting_for: 'the person to tap Apply', would_show: shareableResult(trip, evaluateTrip(trip, ctx.trip)) };
    }
    case 'propose_save_trip': {
      if (!ctx.proposals) return { error: 'Trips can only be saved from Check a trip.' };
      const pending = [...ctx.proposals].reverse().find((p) => p.kind === 'trip');
      const trip = pending?.trip ?? ctx.currentTrip;
      if (!trip || !(trip.tripCashPrice > 0)) return { error: 'There is no trip to save yet.' };
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim().slice(0, 60) : 'Untitled trip';
      ctx.proposals.push({ kind: 'save', name, trip, summary: `Save “${name}”: ${describeTrip(trip)}`, basedOn: basedOn(args.based_on) });
      return { proposed: true, waiting_for: 'the person to tap Apply' };
    }
    case 'propose_compare': {
      if (!ctx.proposals) return { error: 'Trips can only be compared from Check a trip.' };
      const names = Array.isArray(args.trip_names) ? args.trip_names.filter((n): n is string => typeof n === 'string') : [];
      const found = names.map((n) => ctx.savedTrips.find((t) => t.name.trim().toLowerCase() === n.trim().toLowerCase()));
      const missing = names.filter((_, i) => !found[i]);
      if (missing.length) return { error: `No saved trip is called ${missing.map((n) => `“${n}”`).join(', ')}. Use list_saved_trips for the names.` };
      const ids = [...new Set(found.map((t) => t!.id))];
      if (ids.length === 0) return { error: 'Name at least one saved trip.' };
      if (ids.length > MAX_COMPARE) return { error: `Up to ${MAX_COMPARE} trips can be compared at once.` };
      const shown = ids.map((id) => ctx.savedTrips.find((t) => t.id === id)!.name);
      ctx.proposals.push({ kind: 'compare', tripIds: ids, summary: `Compare ${shown.join(', ')}`, basedOn: basedOn(args.based_on) });
      return { proposed: true, waiting_for: 'the person to tap Apply' };
    }
    case 'current_trip': {
      if (!ctx.currentTrip || !(ctx.currentTrip.tripCashPrice > 0)) return { error: 'No trip is in the form yet.' };
      return shareableResult(ctx.currentTrip, evaluateTrip(ctx.currentTrip, ctx.trip));
    }
    case 'list_saved_trips':
      return {
        saved_trips: ctx.savedTrips.map((t) => {
          const v = evaluateTrip(t.inputs, ctx.trip);
          return {
            name: t.name,
            cash_price_usd: t.inputs.tripCashPrice,
            program: t.inputs.selectedPartnerId ? partnerName(t.inputs.selectedPartnerId) : null,
            award_points: t.inputs.pointsRequired || null,
            recommendation: v ? verdictHeadline(v) : null,
            best_cents_per_point: v?.options[0]?.cppCents != null ? round(v.options[0].cppCents) : null,
          };
        }),
      };
    case 'plan_points': {
      if (ctx.savedTrips.length === 0) return { error: 'There are no saved trips yet.' };
      const verdicts = new Map(ctx.savedTrips.map((t) => [t.id, evaluateTrip(t.inputs, ctx.trip)]));
      const balances: Partial<Record<Issuer, number>> = {};
      for (const c of ctx.trip.ownedCards) balances[c.issuer] = (balances[c.issuer] ?? 0) + (ctx.trip.balances[c.id] ?? 0);
      const plan = planPoints(ctx.savedTrips, verdicts, balances);
      return {
        plan: plan.trips.map((p) => ({
          trip: p.trip.name,
          use: p.option ? describeForAi(p.option) : 'pay cash',
          saves_usd: Math.round(p.savings),
        })),
        total_saved_usd: Math.round(plan.totalSavings),
        points_spent_by_bank: Object.fromEntries(Object.entries(plan.pointsUsed).map(([i, n]) => [ISSUER_LABELS[i as Issuer], Math.round(n!)])),
        note: 'Savings are against paying cash, with points at their usual value. Points held with a partner are counted per trip as entered.',
      };
    }
    case 'list_transfer_partners': {
      const bank = args.bank as Issuer;
      if (!(bank in ISSUER_LABELS)) return { error: 'Unknown bank.' };
      return {
        bank: ISSUER_LABELS[bank],
        partners: transferPartners
          .filter((p) => p.ratiosByIssuer[bank] !== undefined)
          .map((p) => ({ program: p.name, type: p.type, points_received_per_point: p.ratiosByIssuer[bank], verified_on: p.verifiedOn })),
      };
    }
    case 'cents_per_point': {
      const cash = num(args.cash_price_usd);
      const points = num(args.points);
      const taxes = num(args.taxes_usd) ?? 0;
      if (cash === null || points === null || points <= 0) return { error: 'Needs a cash price and a points price above zero.' };
      const cents = Math.max(0, ((cash - taxes) * 100) / points);
      return { cents_per_point: round(cents), as_text: formatCents(cents) };
    }
    default:
      return { error: `Unknown tool ${name}.` };
  }
}
