import type { ChaseCardType } from '../../src/lib/verdict/types';
import type { Issuer } from '../../src/types';
import type { PilotEvent } from '../analytics';
import {
  CHASE_CARD_CHOICES,
  isGreeting,
  parseAmount,
  parseBalances,
  parseChaseCardType,
  parseCommand,
  parsePointsPrice,
  parseTripPrice,
  parseYesNo,
} from './parse';
import { formatVerdictReply, verdictForProfile } from './verdict';

// The whole WhatsApp conversation as a pure function: (stored state, one
// message) -> (new state, replies, events). No network, no clock beyond what's
// passed in, so every path is testable without Meta.

export interface Profile {
  balances?: Partial<Record<Issuer, number>>;
  chaseCardType?: ChaseCardType;
  reserveBeforeCutoff?: boolean;
  cashAvailable?: number;
  monthlyLeftover?: number;
  monthlySpend?: number;
}

// Only the numbers. The trip's description ("NYC to Lisbon in May") feeds no
// calculation, so it's never stored.
export interface Trip {
  price?: number;
  chaseTravelPoints?: number;
}

export type Step = 'price' | 'balances' | 'chaseCard' | 'reserveCutoff' | 'cash' | 'leftover' | 'spend';

export interface ConversationState {
  version: 1;
  profile: Profile;
  trip?: Trip;
  // The question we're waiting on an answer to.
  pending?: Step;
}

export type OutMessage =
  | { kind: 'text'; body: string }
  | { kind: 'buttons'; body: string; buttons: { id: string; title: string }[] }
  | { kind: 'list'; body: string; button: string; rows: { id: string; title: string }[] };

export interface Inbound {
  text: string;
  // The id of a tapped button or list row, when the message was one.
  replyId?: string;
}

export interface Turn {
  // null means delete everything stored for this person.
  state: ConversationState | null;
  replies: OutMessage[];
  events: PilotEvent[];
}

export interface Context {
  appUrl: string;
  today?: string;
}

const EXAMPLE = '"NYC to Lisbon in May, $900, worth using points?"';

const WELCOME = `Welcome to PointCompass. Send a trip and its cash price, for example ${EXAMPLE}, and I will recommend whether to pay cash or use points. Reply HELP for commands.`;

const HELP = [
  'PointCompass recommends whether to pay cash or use points for a trip, based on your points and your cash position.',
  `Send a trip with its price, for example ${EXAMPLE}`,
  'UPDATE: change your saved details',
  'RESET: delete everything stored for you',
  'HELP: show this message',
].join('\n');

const RESET_DONE =
  'I have deleted everything stored for you: your balances, cash figures and last trip. Send a trip at any time to start again.';

const text = (body: string): OutMessage => ({ kind: 'text', body });

function question(step: Step): OutMessage {
  switch (step) {
    case 'price':
      return text('What is the cash price of the trip, in US dollars?');
    case 'balances':
      return text(
        'Which points do you have, and roughly how many? For example: Chase 80k, Amex 45k\n(Chase, Capital One, Amex, Citi, Bank of America or Bilt. Reply NONE if you have none.)',
      );
    case 'chaseCard':
      return {
        kind: 'list',
        body: 'Which Chase card holds your points? It determines your Points Boost range.',
        button: 'Choose card',
        rows: CHASE_CARD_CHOICES,
      };
    case 'reserveCutoff':
      return {
        kind: 'buttons',
        body: 'Did you apply for your Sapphire Reserve before June 23, 2025? If so, points earned before October 26, 2025 redeem at 1.5¢ in Chase Travel until October 2027.',
        buttons: [
          { id: 'yes', title: 'Yes, before' },
          { id: 'no', title: 'No, after' },
          { id: 'unsure', title: 'Not sure' },
        ],
      };
    case 'cash':
      return text('How much cash could you spend on travel at the moment without difficulty?');
    case 'leftover':
      return text('After bills, how much is usually left over each month? It may be negative, for example -200.');
    case 'spend':
      return text('Roughly how much do you spend in a typical month in total?');
  }
}

function nextMissing(state: ConversationState): Step | null {
  const { profile, trip } = state;
  if (trip && trip.price === undefined) return 'price';
  if (profile.balances === undefined) return 'balances';
  if ((profile.balances.chase ?? 0) > 0) {
    if (profile.chaseCardType === undefined) return 'chaseCard';
    if (profile.chaseCardType === 'reserve' && profile.reserveBeforeCutoff === undefined) {
      return 'reserveCutoff';
    }
  }
  if (profile.cashAvailable === undefined) return 'cash';
  if (profile.monthlyLeftover === undefined) return 'leftover';
  if (profile.monthlySpend === undefined) return 'spend';
  return null;
}

// Applies an answer to the pending question. Returns false when the answer
// couldn't be read, so the question gets asked again.
function applyAnswer(state: ConversationState, step: Step, msg: Inbound): boolean {
  const { profile } = state;
  const answer = msg.replyId ?? msg.text;
  switch (step) {
    case 'price': {
      const price = parseTripPrice(msg.text) ?? parseAmount(msg.text);
      if (price === null || price <= 0) return false;
      state.trip = { ...state.trip, price };
      return true;
    }
    case 'balances': {
      const balances = parseBalances(msg.text);
      if (balances === null) return false;
      profile.balances = balances;
      return true;
    }
    case 'chaseCard': {
      const cardType = parseChaseCardType(answer);
      if (cardType === null) return false;
      profile.chaseCardType = cardType;
      return true;
    }
    case 'reserveCutoff': {
      // "Not sure" counts as no: the legacy rate is only applied when known.
      const yes = answer === 'yes' ? true : answer === 'no' || answer === 'unsure' ? false : parseYesNo(answer);
      if (yes === null) return false;
      profile.reserveBeforeCutoff = yes;
      return true;
    }
    case 'cash':
    case 'spend': {
      const amount = parseAmount(msg.text);
      if (amount === null || amount < 0) return false;
      if (step === 'cash') profile.cashAvailable = amount;
      else profile.monthlySpend = amount;
      return true;
    }
    case 'leftover': {
      const amount = parseAmount(msg.text);
      if (amount === null) return false;
      profile.monthlyLeftover = amount;
      return true;
    }
  }
}

// Ask the next missing question, or, once nothing is missing, give the verdict.
function advance(state: ConversationState, ctx: Context, prefix: string[], events: PilotEvent[]): Turn {
  const step = nextMissing(state);
  if (step) {
    state.pending = step;
    const ask = question(step);
    const replies = prefix.length ? [text(prefix.join('\n')), ask] : [ask];
    return { state, replies, events };
  }

  delete state.pending;
  const trip = state.trip;
  if (!trip?.price) {
    return {
      state,
      replies: [text([...prefix, `Saved. Now send a trip and its cash price, for example ${EXAMPLE}`].join('\n'))],
      events,
    };
  }

  const result = verdictForProfile(state.profile, { ...trip, price: trip.price }, ctx.today);
  events.push({ name: 'verdict_shown', verdict: result.verdict });
  const reply = formatVerdictReply(result, trip.price, ctx.appUrl);
  return { state, replies: [text([...prefix, reply].join('\n'))], events };
}

export function handleMessage(
  prev: ConversationState | null,
  msg: Inbound,
  ctx: Context,
): Turn {
  const command = parseCommand(msg.text);
  if (command === 'RESET') return { state: null, replies: [text(RESET_DONE)], events: [] };
  if (command === 'HELP') return { state: prev, replies: [text(HELP)], events: [] };

  if (!prev && (command === 'UPDATE' || isGreeting(msg.text))) {
    return { state: null, replies: [text(WELCOME)], events: [] };
  }

  // Deep copy: the caller's state is never mutated.
  const state: ConversationState = prev
    ? (JSON.parse(JSON.stringify(prev)) as ConversationState)
    : { version: 1, profile: {} };
  const events: PilotEvent[] = prev ? [] : [{ name: 'whatsapp_conversation_started' }];

  if (command === 'UPDATE') {
    state.profile = {};
    if (state.trip) delete state.trip.chaseTravelPoints;
    return advance(state, ctx, ['Updating your details.'], events);
  }

  if (state.pending) {
    const step = state.pending;
    if (!applyAnswer(state, step, msg)) {
      return { state, replies: [text('Sorry, I could not read that answer.'), question(step)], events };
    }
    return advance(state, ctx, [], events);
  }

  if (isGreeting(msg.text)) return { state, replies: [text(WELCOME)], events };

  const price = parseTripPrice(msg.text);
  if (price !== null) {
    const hadProfile = nextMissing({ ...state, trip: undefined }) === null;
    state.trip = { price };
    return advance(state, ctx, hadProfile ? ['Using your saved details. Reply UPDATE to change them.'] : [], events);
  }

  // A points price for the last trip, pasted from Chase Travel.
  const points = parsePointsPrice(msg.text);
  if (points !== null && state.trip?.price && (state.profile.balances?.chase ?? 0) > 0) {
    state.trip.chaseTravelPoints = points;
    events.push({ name: 'pasted_price_used' });
    return advance(state, ctx, [], events);
  }

  // Anything else is a trip without a price yet.
  state.trip = {};
  return advance(state, ctx, [], events);
}
