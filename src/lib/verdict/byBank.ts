import cardsData from '../../data/cards.json';
import type { CardConfig, Issuer } from '../../types';
import type { ChaseCardType } from './types';

const cards = cardsData as CardConfig[];

// When balances arrive per bank ("Chase 80,000, Amex 45,000") rather than per
// card, as they do from the agent tool, each bank's points are priced as if
// held on a typical transfer-capable card from it. The web app asks per card
// and doesn't need this.
const REPRESENTATIVE_CARD: Record<Exclude<Issuer, 'chase'>, string> = {
  capitalOne: 'venture',
  amex: 'amexgold',
  citi: 'citistratapremier',
  bankOfAmerica: 'boapremiumrewards',
  bilt: 'biltobsidian',
};

function chaseCardId(cardType: ChaseCardType | undefined): string {
  if (cardType === 'preferred') return 'csp';
  // Freedom can book Chase Travel but can't transfer: the honest stand-in for
  // "another Chase card".
  if (cardType === 'other') return 'freedom';
  return 'csr';
}

// The cards and per-card balances the engine expects, from balances by bank.
export function cardsForBankBalances(
  balancesByBank: Partial<Record<Issuer, number>>,
  chaseCardType?: ChaseCardType,
): { ownedCards: CardConfig[]; balances: Record<string, number> } {
  const ownedCards: CardConfig[] = [];
  const balances: Record<string, number> = {};
  for (const [issuer, amount] of Object.entries(balancesByBank) as [Issuer, number][]) {
    if (!(amount > 0)) continue;
    const id = issuer === 'chase' ? chaseCardId(chaseCardType) : REPRESENTATIVE_CARD[issuer];
    const card = cards.find((c) => c.id === id);
    if (!card) continue;
    ownedCards.push(card);
    balances[card.id] = amount;
  }
  return { ownedCards, balances };
}
