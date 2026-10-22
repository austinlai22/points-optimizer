import cardsData from '../../src/data/cards.json';
import transferPartnersData from '../../src/data/transferPartners.json';
import { describeRunway, evaluateVerdict, verdictHeadline } from '../../src/lib/verdict';
import type { ChaseCardType, VerdictResult } from '../../src/lib/verdict/types';
import type { CardConfig, Issuer, TransferPartner } from '../../src/types';
import type { Profile, Trip } from './conversation';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

// WhatsApp asks for one balance per bank, not per card, so each bank's points
// are priced as if held on a typical transfer-capable card from it. With no
// award price in the chat, only portal and Chase Travel options are judged
// anyway; the web app handles transfers and card-specific ratios.
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

export function verdictForProfile(profile: Profile, trip: Trip & { price: number }, today?: string): VerdictResult {
  const ownedCards: CardConfig[] = [];
  const balances: Record<string, number> = {};
  for (const [issuer, amount] of Object.entries(profile.balances ?? {}) as [Issuer, number][]) {
    if (!(amount > 0)) continue;
    const id = issuer === 'chase' ? chaseCardId(profile.chaseCardType) : REPRESENTATIVE_CARD[issuer];
    const card = cards.find((c) => c.id === id);
    if (!card) continue;
    ownedCards.push(card);
    balances[card.id] = amount;
  }

  return evaluateVerdict({
    tripCashPrice: trip.price,
    ownedCards,
    balances,
    transferPartners,
    chase: {
      cardType: profile.chaseCardType,
      reserveAppliedBeforeCutoff: profile.reserveBeforeCutoff,
      travelPricePoints: trip.chaseTravelPoints,
    },
    cash: {
      available: profile.cashAvailable ?? 0,
      monthlyLeftover: profile.monthlyLeftover ?? 0,
      monthlySpend: profile.monthlySpend ?? 0,
    },
    today,
  });
}

// At most six lines: verdict, reason, cash impact, Chase breakeven, link,
// footer.
export function formatVerdictReply(result: VerdictResult, price: number, appUrl: string): string {
  const lines = [`*${verdictHeadline(result)}*`, result.reason];
  // A strained verdict's reason already says what paying cash would do.
  if (!result.runway.payCash.strained) {
    lines.push(`If you pay cash: ${describeRunway(result.runway.payCash)}.`);
  }
  if (result.chaseTravel) {
    lines.push(
      result.chaseTravel.pastedPricePoints === null
        ? `${result.chaseTravel.sentence} Reply with the points price you see there to check it.`
        : result.chaseTravel.sentence,
    );
  }
  lines.push(`Details: ${appUrl}/app?price=${price}`);
  lines.push('Estimates, not financial advice. Verify prices before booking.');
  return lines.join('\n');
}
