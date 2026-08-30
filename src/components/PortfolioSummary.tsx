import { formatUSD } from '../utils/format';
import { computeCardValuation } from '../utils/valuation';
import { useCardBalances } from '../context/CardBalancesContext';
import { AnimatedNumber } from './AnimatedNumber';
import { ValuationBasisSelect } from './ValuationBasisSelect';
import { HERO_SURFACE, ISSUER_LABELS, ISSUER_ORDER, LABEL_ON_DARK } from '../styles/constants';
import { VALUATION_KEY_BY_BASIS } from '../types';
import type { CardConfig, Issuer, TransferPartner, ValuationBasis } from '../types';

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

const HEADLINE_LABEL_BY_BASIS: Record<ValuationBasis, string> = {
  cashBack: 'Total if cashed out',
  guaranteed: 'Total portfolio value',
  transfer: 'Total at transfer value',
};

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
  const { basis } = useCardBalances();
  const totals = sumValuations(ownedCards, balances, ownedCards, transferPartners);
  const headlineKey = VALUATION_KEY_BY_BASIS[basis];

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
    // Grid, not flex+justify-between: with flex, both columns were sized by
    // their own content, so switching basis (which changes the headline
    // label's length, the figure's width, and the note under the buttons)
    // resized the left column — jittering the basis buttons and sliding the
    // range block sideways. A minmax(0,1fr) + auto grid pins both columns
    // regardless of what's inside them.
    <div
      className={`${HERO_SURFACE} mb-8 grid gap-6 p-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-8`}
    >
      <div className="min-w-0">
        <p className={LABEL_ON_DARK}>{HEADLINE_LABEL_BY_BASIS[basis]}</p>
        <p className="mt-1.5 font-mono text-4xl font-medium text-teal sm:text-5xl">
          <AnimatedNumber value={totals[headlineKey]} format={formatUSD} />
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
          {ISSUER_ORDER.map((issuer) => (
            <p key={issuer} className="text-xs text-slate-50/50">
              {ISSUER_LABELS[issuer]}{' '}
              <span className="font-mono text-slate-50/80">
                {formatUSD(totalsByIssuer[issuer]?.[headlineKey] ?? 0)}
              </span>
            </p>
          ))}
        </div>
        {/* Capped so the three buttons keep one deliberate width instead of
            stretching with the column on wide screens. */}
        <div className="mt-5 max-w-md">
          <ValuationBasisSelect onDark />
        </div>
      </div>
      {/* The range the headline sits inside. Both bounds are always shown so
          this block never changes shape; the one matching the current basis
          is brightened so the headline repeating it reads as deliberate
          rather than as a duplicated number. */}
      <div className="flex gap-8 sm:flex-col sm:gap-5">
        {(
          [
            { key: 'floor' as const, label: 'Cash-back floor' },
            { key: 'ceiling' as const, label: 'Transfer ceiling' },
          ]
        ).map(({ key, label }) => {
          const isActive = headlineKey === key;
          return (
            <div key={key} className="min-w-[7.5rem]">
              <p className={isActive ? 'text-[11px] font-medium uppercase tracking-wider text-slate-50/70' : LABEL_ON_DARK}>
                {label}
              </p>
              <p
                className={`mt-1.5 font-mono text-lg ${
                  isActive ? 'text-slate-50' : 'text-slate-50/80'
                }`}
              >
                {formatUSD(totals[key])}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
