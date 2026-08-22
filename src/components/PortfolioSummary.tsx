import { formatUSD } from '../utils/format';
import { computeCardValuation } from '../utils/valuation';
import { AnimatedNumber } from './AnimatedNumber';
import { HERO_SURFACE, ISSUER_LABELS, ISSUER_ORDER, LABEL_ON_DARK } from '../styles/constants';
import type { CardConfig, Issuer, TransferPartner } from '../types';

interface PortfolioSummaryProps {
  ownedCards: CardConfig[];
  balances: Record<string, number>;
  transferPartners: TransferPartner[];
}

interface Totals {
  floor: number;
  marker: number;
  ceiling: number;
}

const ZERO_TOTALS: Totals = { floor: 0, marker: 0, ceiling: 0 };

function sumValuations(cards: CardConfig[], balances: Record<string, number>, allCards: CardConfig[], transferPartners: TransferPartner[]): Totals {
  return cards.reduce((acc, card) => {
    const valuation = computeCardValuation({
      card,
      balance: balances[card.id] ?? 0,
      allCards,
      transferPartners,
    });
    return {
      floor: acc.floor + valuation.floor,
      marker: acc.marker + valuation.marker,
      ceiling: acc.ceiling + valuation.ceiling,
    };
  }, ZERO_TOTALS);
}

export function PortfolioSummary({ ownedCards, balances, transferPartners }: PortfolioSummaryProps) {
  const totals = sumValuations(ownedCards, balances, ownedCards, transferPartners);

  const totalsByIssuer = Object.fromEntries(
    ISSUER_ORDER.map((issuer) => [
      issuer,
      sumValuations(
        ownedCards.filter((card) => card.issuer === issuer),
        balances,
        ownedCards,
        transferPartners,
      ),
    ]),
  ) as Record<Issuer, Totals>;

  return (
    <div
      className={`${HERO_SURFACE} mb-8 flex flex-col gap-6 p-7 sm:flex-row sm:items-start sm:justify-between`}
    >
      <div>
        <p className={LABEL_ON_DARK}>Total portfolio value</p>
        <p className="mt-1.5 font-mono text-4xl font-medium text-teal sm:text-5xl">
          <AnimatedNumber value={totals.marker} format={formatUSD} />
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
          {ISSUER_ORDER.map((issuer) => (
            <p key={issuer} className="text-xs text-slate-50/50">
              {ISSUER_LABELS[issuer]}{' '}
              <span className="font-mono text-slate-50/80">
                {formatUSD(totalsByIssuer[issuer]?.marker ?? 0)}
              </span>
            </p>
          ))}
        </div>
      </div>
      <div className="flex gap-8">
        <div>
          <p className={LABEL_ON_DARK}>Cash-back floor</p>
          <p className="mt-1.5 font-mono text-lg text-slate-50/80">{formatUSD(totals.floor)}</p>
        </div>
        <div>
          <p className={LABEL_ON_DARK}>Transfer ceiling</p>
          <p className="mt-1.5 font-mono text-lg text-slate-50/80">{formatUSD(totals.ceiling)}</p>
        </div>
      </div>
    </div>
  );
}
