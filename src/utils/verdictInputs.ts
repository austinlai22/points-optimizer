import { listChaseCardTypes } from '../lib/verdict';
import type { ChaseCardType } from '../lib/verdict/types';

// The verdict's extra inputs, and how to restore them from localStorage.
// Kept apart from the components so those files export components only.

// Raw strings, so "not entered yet" and a typed-in negative ("-") are both
// representable while someone is still typing.
export interface CashInputValues {
  available: string;
  leftover: string;
  spend: string;
}

export const EMPTY_CASH_INPUTS: CashInputValues = { available: '', leftover: '', spend: '' };

export function sanitizeCashInputs(stored: unknown): CashInputValues {
  const s = (stored ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return { available: str(s.available), leftover: str(s.leftover), spend: str(s.spend) };
}

const CHASE_CARD_TYPE_IDS = listChaseCardTypes().map((t) => t.id);

export interface ChaseInputValues {
  // '' means "work it out from the cards marked as held".
  cardType: ChaseCardType | '';
  appliedBeforeCutoff: boolean | null;
  // '' means "all of them".
  legacyPoints: string;
}

export const EMPTY_CHASE_INPUTS: ChaseInputValues = {
  cardType: '',
  appliedBeforeCutoff: null,
  legacyPoints: '',
};

export function sanitizeChaseInputs(stored: unknown): ChaseInputValues {
  const s = (stored ?? {}) as Record<string, unknown>;
  return {
    cardType: CHASE_CARD_TYPE_IDS.includes(s.cardType as ChaseCardType) ? (s.cardType as ChaseCardType) : '',
    appliedBeforeCutoff: typeof s.appliedBeforeCutoff === 'boolean' ? s.appliedBeforeCutoff : null,
    legacyPoints: typeof s.legacyPoints === 'string' ? s.legacyPoints : '',
  };
}
