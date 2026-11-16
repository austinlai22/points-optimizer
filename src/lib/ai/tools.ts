import transferPartnersData from '../../data/transferPartners.json';
import { formatCents, verdictHeadline } from '../verdict';
import type { PointsOption } from '../verdict/types';
import { describePointsOption, evaluateTrip, partnerName, type SavedTrip, type TripContext, type TripInputs, type TripVerdict } from '../trips';
import { planPoints } from '../planPoints';
import { ISSUER_LABELS } from '../../utils/issuers';
import type { Issuer, TransferPartner } from '../../types';
import { sanitizeParsedTrip, type ParsedTrip } from './protocol';

// The assistant's tools, run in the browser against the person's own cards,
// balances and saved trips. Only their results go to the AI, and those are
// built here to carry no balances and no cash amounts: points a booking would
// spend, yes; points held or dollars in the bank, never.

const transferPartners = transferPartnersData as TransferPartner[];

export interface ToolContext {
  trip: TripContext;
  savedTrips: SavedTrip[];
  currentTrip: TripInputs | null;
  // Present on Check a trip: fills in its form.
  fillTripForm?: (inputs: TripInputs) => void;
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
    case 'fill_trip_form': {
      if (!ctx.fillTripForm) return { error: 'The trip form is on Check a trip, not this page.' };
      const trip = tripFromParsed(sanitizeParsedTrip(args), ctx.currentTrip);
      ctx.fillTripForm(trip);
      return { done: true, now_showing: shareableResult(trip, evaluateTrip(trip, ctx.trip)) };
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
