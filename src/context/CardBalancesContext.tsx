import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import cards from '../data/cards.json';
import { DEFAULT_VALUATION_BASIS, type ValuationBasis } from '../types';

// NOTE: this context has outgrown its name — it now holds every piece of
// persisted, cross-view user state, not just balances. If anything further
// is added here, rename it to something like UserStateContext.
const BALANCES_STORAGE_KEY = 'cco:balances';
const OWNERSHIP_STORAGE_KEY = 'cco:ownership';
const BASIS_STORAGE_KEY = 'cco:basis';

const VALID_BASES: ValuationBasis[] = ['cashBack', 'guaranteed', 'transfer'];

function isValuationBasis(value: unknown): value is ValuationBasis {
  return typeof value === 'string' && (VALID_BASES as string[]).includes(value);
}

// Basis is the one piece of shared state that's also shareable via URL, so
// its precedence lives here rather than in a view: a link someone sends you
// should show THEIR basis, overriding whatever you last picked locally.
// Mirrors loadInitialTripInputs' URL > localStorage > default ordering in
// TripOptimizerView.
function loadInitialBasis(): ValuationBasis {
  const fromUrl = new URLSearchParams(window.location.search).get('basis');
  if (isValuationBasis(fromUrl)) return fromUrl;

  try {
    const stored = localStorage.getItem(BASIS_STORAGE_KEY);
    if (isValuationBasis(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode / quota) — fall through.
  }
  return DEFAULT_VALUATION_BASIS;
}

function loadInitialBalances(): Record<string, number> {
  const defaults = Object.fromEntries(cards.map((card) => [card.id, 0]));

  try {
    const stored = localStorage.getItem(BALANCES_STORAGE_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function loadInitialOwnership(): Record<string, boolean> {
  const defaults = Object.fromEntries(cards.map((card) => [card.id, true]));

  try {
    const stored = localStorage.getItem(OWNERSHIP_STORAGE_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

interface CardBalancesContextValue {
  balances: Record<string, number>;
  setBalance: (cardId: string, value: number) => void;
  clearAllBalances: () => void;
  ownership: Record<string, boolean>;
  setOwned: (cardId: string, value: boolean) => void;
  basis: ValuationBasis;
  setBasis: (value: ValuationBasis) => void;
}

const CardBalancesContext = createContext<CardBalancesContextValue | null>(null);

export function CardBalancesProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<Record<string, number>>(loadInitialBalances);
  const [ownership, setOwnership] = useState<Record<string, boolean>>(loadInitialOwnership);
  const [basis, setBasis] = useState<ValuationBasis>(loadInitialBasis);

  useEffect(() => {
    try {
      localStorage.setItem(BALANCES_STORAGE_KEY, JSON.stringify(balances));
    } catch {
      // localStorage unavailable (private mode / quota) — balances still work in-memory.
    }
  }, [balances]);

  useEffect(() => {
    try {
      localStorage.setItem(OWNERSHIP_STORAGE_KEY, JSON.stringify(ownership));
    } catch {
      // localStorage unavailable (private mode / quota) — ownership still works in-memory.
    }
  }, [ownership]);

  useEffect(() => {
    try {
      localStorage.setItem(BASIS_STORAGE_KEY, basis);
    } catch {
      // localStorage unavailable (private mode / quota) — basis still works in-memory.
    }
  }, [basis]);

  const setBalance = (cardId: string, value: number) => {
    setBalances((prev) => ({ ...prev, [cardId]: value }));
  };

  const clearAllBalances = () => {
    setBalances(Object.fromEntries(cards.map((card) => [card.id, 0])));
  };

  const setOwned = (cardId: string, value: boolean) => {
    setOwnership((prev) => ({ ...prev, [cardId]: value }));
  };

  return (
    <CardBalancesContext.Provider
      value={{ balances, setBalance, clearAllBalances, ownership, setOwned, basis, setBasis }}
    >
      {children}
    </CardBalancesContext.Provider>
  );
}

export function useCardBalances(): CardBalancesContextValue {
  const context = useContext(CardBalancesContext);
  if (!context) {
    throw new Error('useCardBalances must be used within a CardBalancesProvider');
  }
  return context;
}
