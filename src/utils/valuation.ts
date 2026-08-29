import type { CardConfig, CardValuation, Issuer, RedemptionPath, TransferPartner } from '../types';

// Base rate for travel-restricted redemption (Chase's portal / Capital
// One's "Purchase Eraser" against a travel purchase) — a program rule, not
// a third-party valuation opinion. Same baseline for every card regardless
// of issuer; each card's own portalMultiplier scales it from there.
export const BASE_CPP = 0.01; // $ per point, travel-redemption base rate

// The TRUE unconditional cash-back floor — no travel-purchase restriction,
// e.g. a plain statement credit or a mailed check. Each issuer publishes its
// own real, structural gap here between "cash out" and "book travel":
// - Chase: Freedom's 1 UR point = $0.01 statement credit, no restriction —
//   floor equals the travel rate exactly.
// - Capital One: unrestricted cash-back/check is 0.5 cents/mile, exactly
//   half its 1 cent/mile travel-purchase rate.
// - Amex: "Cover Your Card Charges" statement credit is 0.6 cents/point,
//   below its 1 cent/point flights/Fine Hotels & Resorts rate.
// - Citi: cash back on the ThankYou-earning cards is 0.75 cents/point,
//   below the Citi Travel portal's 1 cent/point.
// - Bank of America: Premium Rewards and Premium Rewards Elite redeem for
//   cash (deposit, statement credit, gift card) at the full $0.01/point, no
//   gap at all — this is the issuer default below. The no-fee Travel
//   Rewards card is the one real exception: its cash-out rate is only
//   $0.006/point, genuinely worse than its own siblings, so it carries a
//   per-card cashBackRateOverride in cards.json rather than changing this
//   issuer-wide default.
export const CASH_BACK_RATE: Record<Issuer, number> = {
  chase: BASE_CPP,
  capitalOne: BASE_CPP / 2,
  amex: 0.006,
  citi: 0.0075,
  bankOfAmerica: BASE_CPP,
};

// A card's own true cash-back rate: its cashBackRateOverride if it has one
// (a documented per-card exception), otherwise its issuer's usual rate.
function getCashBackRate(card: CardConfig): number {
  return card.cashBackRateOverride ?? CASH_BACK_RATE[card.issuer];
}

// The best cash-back rate reachable among held cards in the same issuer
// family — mirrors getBestPortalCard's "a rational cardholder consolidates
// into their best card before redeeming" reasoning, just applied to the
// cash-out rate instead of the travel-portal rate. This only ever differs
// from a card's own rate when a per-card cashBackRateOverride exists (only
// Bank of America Travel Rewards has one today), so it's a no-op for every
// other issuer.
function getBestCashBackRate(cardsInScope: CardConfig[]): number {
  return Math.max(...cardsInScope.map(getCashBackRate));
}

// Award-chart (transfer) redemptions are priced at fixed point costs while
// cash prices float with demand, so premium-cabin / peak-date bookings tend
// to land well above cash-equivalent value. This is this app's own reasoned
// estimate of that upside, applied on top of a card's own stated portal
// rate — it is not sourced from any published point-valuation guide.
export const TRANSFER_PREMIUM_FACTOR = 1.75;

// Best transfer rate this issuer's cards can reach across the whole partner
// roster. Partners aren't exclusive to one issuer — e.g. Air France-KLM
// Flying Blue, British Airways, and Wyndham all accept transfers from both
// Chase and Capital One, each at that partner's own ratio for that issuer —
// so this looks up each partner's issuer-specific ratio, not a single flat
// number. Most real ratios are 1:1 or better, but not universally (Capital
// One's Emirates is below 1:1); taking the MAX keeps the floor <= marker <=
// ceiling invariant safe as long as at least one partner for this issuer is
// >= 1 (true for every issuer in transferPartners.json today).
export function getBestTransferRatio(transferPartners: TransferPartner[], issuer: Issuer): number {
  const ratios = transferPartners
    .map((partner) => partner.ratiosByIssuer[issuer])
    .filter((ratio): ratio is number => ratio !== undefined);
  if (ratios.length === 0) return 1;
  return Math.max(...ratios);
}

// Whether a card has a known, documented transfer-ratio shortfall for a
// given partner — "*" (via reducedRatioPartners) means every partner (a
// blanket, card-tier-wide shortfall like Citi Strata's); pass partnerId null
// to test only for that blanket case, ignoring partner-specific ones like
// Chase Preferred's Hyatt exception.
function hasReducedRatioFor(card: CardConfig, partnerId: string | null): boolean {
  if (!card.reducedRatioPartners) return false;
  if (card.reducedRatioPartners.includes('*')) return true;
  return partnerId !== null && card.reducedRatioPartners.includes(partnerId);
}

// A rational cardholder always consolidates into whichever held card has the
// best portal rate before redeeming, so that card sets the "realistic" value
// for every point in its family — but ONLY within the same issuer's points
// program. Chase Ultimate Rewards, Capital One miles, Amex Membership
// Rewards, and Citi ThankYou Points are separate, non-interchangeable
// currencies; callers must pre-filter to one issuer's cards before calling
// this, or pooling will incorrectly cross programs.
//
// Every card in this app currently ties at the same flat portal rate, so the
// portal-rate comparison alone can never break a tie today — without an
// explicit tiebreaker, a plain reduce() would just return whichever card
// happens to come first in the array, which is correct today only because
// cards.json happens to list each issuer's non-transfer-eligible card last.
// That's an accident of ordering, not a guarantee, so ties are broken
// explicitly here: prefer a transfer-eligible card whenever one exists,
// among those prefer one with no blanket ratio shortfall (e.g. pick Citi
// Strata Premier over the plain Strata card), and finally prefer whichever
// has the better cash-back rate (e.g. Bank of America Premium Rewards over
// Travel Rewards — both 1.0x portal, neither transfer-eligible, but
// Premium Rewards' cash-out rate is genuinely better) — so the "best" card
// used to value every point in the family, and named in pooledViaCard, is
// never one known to underperform on ANY dimension this app models when a
// genuinely better held card exists.
function getBestPortalCard(cardsInScope: CardConfig[]): CardConfig {
  return cardsInScope.reduce((best, c) => {
    if (c.portalMultiplier > best.portalMultiplier) return c;
    if (c.portalMultiplier < best.portalMultiplier) return best;
    if (c.transferEligible !== best.transferEligible) {
      return c.transferEligible ? c : best;
    }
    const cReduced = hasReducedRatioFor(c, null);
    const bestReduced = hasReducedRatioFor(best, null);
    if (cReduced !== bestReduced) return cReduced ? best : c;
    const cCashBack = getCashBackRate(c);
    const bestCashBack = getCashBackRate(best);
    if (cCashBack !== bestCashBack) return cCashBack > bestCashBack ? c : best;
    return best;
  });
}

interface ComputeCardValuationArgs {
  card: CardConfig;
  balance: number;
  allCards: CardConfig[];
  transferPartners: TransferPartner[];
}

export function computeCardValuation({
  card,
  balance,
  allCards,
  transferPartners,
}: ComputeCardValuationArgs): CardValuation {
  // Scope pooling to this card's own issuer — Chase points and Capital One
  // miles never pool together.
  const sameIssuerCards = allCards.filter((c) => c.issuer === card.issuer);
  const ratioMultiplier = getBestTransferRatio(transferPartners, card.issuer);
  const bestCard = getBestPortalCard(sameIssuerCards);

  // Same "consolidate into your best card first" reasoning as the portal
  // rate, applied to cash-back rate — matters today only for Bank of
  // America, where Travel Rewards' own cash-out rate is worse than Premium
  // Rewards/Elite's. A no-op for every other issuer, since none of them
  // have a per-card cashBackRateOverride.
  const bestCashBackRate = getBestCashBackRate(sameIssuerCards);
  const floor = balance * bestCashBackRate;

  // "Pooled" means consolidating into bestCard (or, for cash-back, into
  // whichever held card has the best rate) genuinely changes something for
  // this card — a better portal rate, gaining transfer eligibility it
  // doesn't have on its own (e.g. Freedom has no transfer partners of its
  // own, but ties Reserve/Preferred's flat portal rate — pooling still
  // unlocks its ceiling even though its "realistic" rate doesn't move),
  // escaping its OWN blanket ratio shortfall by riding a better held card's
  // rate instead (e.g. Strata's balance pooled into Strata Premier), or
  // escaping a worse cash-back floor (e.g. Bank of America Travel Rewards
  // pooled into Premium Rewards Elite). Checking portal rate alone would
  // miss all but the first case now that every card within an issuer shares
  // the same flat 1.0x portal rate (Premium Rewards Elite's airfare-only
  // 1.25x aside).
  const isPooled =
    card.portalMultiplier < bestCard.portalMultiplier ||
    (!card.transferEligible && bestCard.transferEligible) ||
    (hasReducedRatioFor(card, null) && bestCard.id !== card.id) ||
    getCashBackRate(card) < bestCashBackRate;

  const marker = balance * BASE_CPP * bestCard.portalMultiplier;

  // Ceiling only gets the transfer premium if the pool target itself is
  // transfer-eligible; otherwise no card in this issuer's held roster
  // unlocks transfer value. If bestCard itself carries a blanket ratio
  // shortfall — meaning no better same-issuer card exists to pool into —
  // the ceiling must reflect THAT card's own real (worse) ratio rather than
  // the issuer's generic best rate, or a Strata-only holder would see an
  // inflated ceiling they could never actually redeem.
  const bestCardOwnRatio = hasReducedRatioFor(bestCard, null)
    ? ratioMultiplier * (bestCard.blanketRatioMultiplier ?? 1)
    : ratioMultiplier;
  const ceiling = bestCard.transferEligible
    ? marker * TRANSFER_PREMIUM_FACTOR * bestCardOwnRatio
    : marker;

  return {
    floor,
    marker,
    ceiling,
    isFixedValue: floor === ceiling,
    isPooled,
    pooledViaCard: isPooled ? bestCard : null,
  };
}

interface ComputeRedemptionPathsArgs {
  cards: CardConfig[];
  transferPartners: TransferPartner[];
  balances: Record<string, number>;
  tripCashPrice: number;
  // partnerId -> points required, in that partner's own currency. A partner's
  // award price doesn't depend on which of your cards you'd transfer from
  // (Hyatt charges the same points whether they came from a Reserve or a
  // Preferred), so this is keyed by partner only, not by (card, partner).
  pointsRequiredByPartner: Record<string, number>;
  // Out-of-pocket cash still owed on an award booking — taxes and
  // carrier-imposed surcharges (trivial on most domestic awards, but
  // hundreds of dollars on some international ones). Applies to TRANSFER
  // paths only: a portal booking is paid entirely in points at the trip's
  // cash price, which already includes taxes, so there is nothing left to
  // pay out of pocket there. Like pointsRequiredByPartner, this is a
  // property of the award booking itself, so it's issuer-independent.
  // Defaults to 0.
  awardCashFees?: number;
}

export function computeRedemptionPaths({
  cards,
  transferPartners,
  balances,
  tripCashPrice,
  pointsRequiredByPartner,
  awardCashFees = 0,
}: ComputeRedemptionPathsArgs): RedemptionPath[] {
  if (!tripCashPrice || tripCashPrice <= 0) return [];

  const paths: RedemptionPath[] = [];
  const issuers = [...new Set(cards.map((c) => c.issuer))];

  // Pre-sum per issuer so cross-program pooling is impossible by construction
  // — Chase points and Capital One miles never combine.
  const totalBalanceByIssuer = Object.fromEntries(
    issuers.map((issuer) => [
      issuer,
      cards
        .filter((c) => c.issuer === issuer)
        .reduce((sum, c) => sum + (balances[c.id] ?? 0), 0),
    ]),
  );

  for (const issuer of issuers) {
    const issuerCards = cards.filter((c) => c.issuer === issuer);
    const transferEligibleCards = issuerCards.filter((c) => c.transferEligible);
    // Cost is priced at what these points are worth at your issuer's best
    // guaranteed rate — the same "realistic value" basis as Portfolio — not
    // at trip price or at any one card's own weaker rate. That's what makes
    // every card within an issuer show the identical cost for the same
    // redemption: it's genuinely the same points, valued the same way.
    const bestCard = getBestPortalCard(issuerCards);
    const issuerRealisticRate = BASE_CPP * bestCard.portalMultiplier;
    const pooledBalance = totalBalanceByIssuer[issuer] ?? 0;

    // TRANSFER: one path per partner this issuer can reach, not one per
    // card — every owned transfer-eligible card draws on the same pooled
    // balance for the same partner, so they'd all show identical cost.
    if (transferEligibleCards.length > 0) {
      const relevantPartners = transferPartners.filter(
        (p) => p.ratiosByIssuer[issuer] !== undefined,
      );

      for (const partner of relevantPartners) {
        const ratio = partner.ratiosByIssuer[issuer]!;
        const partnerPointsRequired = pointsRequiredByPartner[partner.id] ?? 0;
        if (!partnerPointsRequired || partnerPointsRequired <= 0 || ratio <= 0) continue;

        // Name whichever eligible card has the lowest annual fee, since with
        // cost decoupled from fee there's no reason to point at a pricier
        // one by default — BUT never recommend a card with a documented,
        // worse-than-modeled ratio for THIS specific partner (e.g. Citi's
        // no-fee Strata card is worse on every partner; Chase Preferred is
        // specifically worse on Hyatt) when a better-fee alternative exists
        // that doesn't carry that caveat.
        const recommendedCard = transferEligibleCards.reduce((best, c) => {
          const cReduced = hasReducedRatioFor(c, partner.id);
          const bestReduced = hasReducedRatioFor(best, partner.id);
          if (cReduced !== bestReduced) return cReduced ? best : c;
          return c.annualFee < best.annualFee ? c : best;
        });

        // Points required is entered in partner currency; convert to the
        // issuer's own points actually debited via THIS issuer's transfer
        // ratio to this partner (a shared partner can have a different
        // ratio for each issuer that reaches it). If the recommended card
        // still carries a blanket ratio shortfall (only possible when every
        // held transfer-eligible card for this issuer has one, i.e. there
        // was no better card to recommend instead — e.g. holding only Citi
        // Strata), divide by its real blanketRatioMultiplier too, so the
        // points/cost shown reflect that card's own worse rate rather than
        // silently assuming the issuer-wide generic ratio still applies.
        const pointsUsed =
          partnerPointsRequired / ratio / (recommendedCard.blanketRatioMultiplier ?? 1);
        // An award booking costs you BOTH the points (valued at their
        // opportunity cost) AND whatever cash you still hand over in taxes
        // and carrier surcharges — so the honest total is the sum. Without
        // this, a "cheap" award with $600 of surcharges would rank above a
        // portal booking that actually costs you less overall.
        const cost = pointsUsed * issuerRealisticRate + awardCashFees;

        const ownBalance = balances[recommendedCard.id] ?? 0;
        // Cash fees are paid with money, not points, so they never affect
        // whether your balance covers the award.
        const sufficient = pooledBalance >= pointsUsed;
        const usesPooling = ownBalance < pointsUsed && sufficient;
        const otherContributingCards = issuerCards.filter(
          (c) => c.id !== recommendedCard.id && (balances[c.id] ?? 0) > 0,
        );

        paths.push({
          card: recommendedCard,
          issuer,
          kind: 'transfer',
          partner,
          pointsUsed,
          cashFees: awardCashFees,
          cost,
          sufficient,
          isPoorDeal: cost > tripCashPrice,
          usesPooling,
          pooledFromCards: usesPooling ? otherContributingCards : [],
        });
      }
    }

    // PORTAL: kept per-card, since portal efficiency genuinely differs by
    // card (each has its own portalMultiplier) — unlike transfer, these
    // aren't the same redemption twice. Pooling doesn't apply; every card
    // uses only its own balance for its own portal. Cost still prices the
    // points used at the ISSUER's best rate, so a card with a weaker portal
    // than your best one correctly shows as burning more value than the
    // trip is worth.
    //
    // No cash fees here, deliberately: booking through a portal pays the
    // trip's full cash price in points, and that price already includes
    // taxes — there's no separate award surcharge left to hand over. That
    // asymmetry with transfer paths is the whole point of tracking fees;
    // it's often what makes a portal booking the better deal.
    for (const card of issuerCards) {
      const balance = balances[card.id] ?? 0;
      const cppPortal = BASE_CPP * card.portalMultiplier;
      const pointsUsed = tripCashPrice / cppPortal;
      const cost = pointsUsed * issuerRealisticRate;

      paths.push({
        card,
        issuer,
        kind: 'portal',
        partner: null,
        pointsUsed,
        cashFees: 0,
        cost,
        sufficient: balance >= pointsUsed,
        isPoorDeal: cost > tripCashPrice,
        usesPooling: false,
        pooledFromCards: [],
      });
    }
  }

  return paths.filter((path) => path.sufficient).sort((a, b) => a.cost - b.cost);
}
