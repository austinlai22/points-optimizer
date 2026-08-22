import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import cards from '../data/cards.json';

const BALANCES_STORAGE_KEY = 'cco:balances';
const OWNERSHIP_STORAGE_KEY = 'cco:ownership';

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
}

const CardBalancesContext = createContext<CardBalancesContextValue | null>(null);

export function CardBalancesProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<Record<string, number>>(loadInitialBalances);
  const [ownership, setOwnership] = useState<Record<string, boolean>>(loadInitialOwnership);

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
      value={{ balances, setBalance, clearAllBalances, ownership, setOwned }}
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
