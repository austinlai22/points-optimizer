import type { Issuer } from '../../src/types';
import type { ChaseCardType } from '../../src/lib/verdict/types';

// Plain pattern matching, no language model: the only free text that feeds a
// calculation is a handful of numbers, and a regex that's wrong is wrong the
// same way every time, which a test can catch.

export type Command = 'RESET' | 'UPDATE' | 'HELP';

export function parseCommand(text: string): Command | null {
  const word = text.trim().toUpperCase().replace(/[.!]+$/, '');
  return word === 'RESET' || word === 'UPDATE' || word === 'HELP' ? word : null;
}

export function isGreeting(text: string): boolean {
  return /^(hi|hey|hello|hiya|yo|start|hola)\b[\s!.]*$/i.test(text.trim());
}

// "1,200", "1.2k", "$900", "-200", "(200)", "minus 200". Returns null when
// there's no number at all.
export function parseAmount(text: string): number | null {
  const cleaned = text.trim().toLowerCase();
  const match = cleaned.match(/(-|minus\s*|\()?\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/);
  if (!match) return null;
  const value = Number(match[2].replace(/,/g, '')) * (match[3] ? 1000 : 1);
  if (!Number.isFinite(value)) return null;
  return match[1] ? -value : value;
}

// The trip's cash price from a message like "NYC to Lisbon in May, $900,
// worth using points?". Wants a $ sign or a currency word, so "May 2027" or
// "2 people" is never read as a price.
export function parseTripPrice(text: string): number | null {
  const dollar = text.match(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i);
  const worded = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:usd|dollars|bucks)\b/i);
  const match = dollar ?? worded;
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// A points price someone saw, e.g. "chase travel 65k" or "65,000 points".
export function parsePointsPrice(text: string): number | null {
  if (/\$/.test(text)) return null;
  const match = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:points|pts|pt)\b/i)
    ?? text.match(/chase\s*travel\D*(\d[\d,]*(?:\.\d+)?)\s*(k)?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

const ISSUER_ALIASES: [Issuer, RegExp][] = [
  ['chase', /\b(?:chase|ultimate\s*rewards|ur)\b/],
  ['capitalOne', /\b(?:capital\s*one|cap\s*one|capone|c1|venture)\b/],
  ['amex', /\b(?:amex|american\s*express|membership\s*rewards|mr)\b/],
  ['citi', /\b(?:citi|thank\s*you|ty)\b/],
  ['bankOfAmerica', /\b(?:bank\s*of\s*america|boa|bofa)\b/],
  ['bilt', /\bbilt\b/],
];

// "Chase 80k, Amex 45,000" -> { chase: 80000, amex: 45000 }. "none" -> {}.
// Returns null when nothing recognisable was said.
export function parseBalances(text: string): Partial<Record<Issuer, number>> | null {
  const lower = text.toLowerCase();
  if (/^\s*(none|no|nothing|0|zero)\s*[.!]?\s*$/.test(lower)) return {};

  const balances: Partial<Record<Issuer, number>> = {};
  for (const [issuer, alias] of ISSUER_ALIASES) {
    const found = lower.match(alias);
    if (!found || found.index === undefined) continue;
    // The number nearest after the name, before the next comma or "and". A
    // comma followed by three digits is a thousands separator, not a break:
    // "Amex 45,000" is 45,000.
    const rest = lower.slice(found.index + found[0].length).split(/,(?!\d{3}\b)|;|\band\b|\n/)[0];
    const amount = parseAmount(rest);
    if (amount !== null && amount >= 0) balances[issuer] = Math.round(amount);
  }
  return Object.keys(balances).length > 0 ? balances : null;
}

export const CHASE_CARD_CHOICES: { id: ChaseCardType; title: string }[] = [
  { id: 'reserve', title: 'Sapphire Reserve' },
  { id: 'preferred', title: 'Sapphire Preferred' },
  { id: 'reserveForBusiness', title: 'Reserve for Business' },
  { id: 'inkPreferred', title: 'Ink Preferred' },
  { id: 'inkPlus', title: 'Ink Plus' },
  { id: 'jpmReserve', title: 'J.P. Morgan Reserve' },
  { id: 'other', title: 'Another Chase card' },
];

export function parseChaseCardType(text: string): ChaseCardType | null {
  const byId = CHASE_CARD_CHOICES.find((c) => c.id === text.trim());
  if (byId) return byId.id;
  const lower = text.toLowerCase();
  if (/business/.test(lower) && /reserve/.test(lower)) return 'reserveForBusiness';
  if (/j\.?\s?p\.?\s?morgan|jpm/.test(lower)) return 'jpmReserve';
  if (/ink/.test(lower) && /pref/.test(lower)) return 'inkPreferred';
  if (/ink/.test(lower) && /plus/.test(lower)) return 'inkPlus';
  if (/reserve|csr/.test(lower)) return 'reserve';
  if (/pref|csp/.test(lower)) return 'preferred';
  if (/other|freedom|unlimited|flex|ink|cash/.test(lower)) return 'other';
  return null;
}

export function parseYesNo(text: string): boolean | null {
  const lower = text.trim().toLowerCase();
  if (/^(yes|y|yeah|yep|yup|before)\b/.test(lower)) return true;
  if (/^(no|n|nope|after|not sure|unsure|dunno|idk)\b/.test(lower)) return false;
  return null;
}
