import cardsData from '../data/cards.json';
import transferPartnersData from '../data/transferPartners.json';
import { useCardBalances } from '../context/CardBalancesContext';
import { PortfolioCard } from './PortfolioCard';
import { PortfolioSummary } from './PortfolioSummary';
import { Methodology } from './Methodology';
import { FOCUS_RING, ISSUER_LABELS, ISSUER_ORDER, TAP_TARGET } from '../styles/constants';
import type { CardConfig, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

export function PortfolioView() {
  const { balances, setBalance, clearAllBalances, ownership, setOwned } = useCardBalances();
  const ownedCards = cards.filter((card) => ownership[card.id]);

  const handleClearAll = () => {
    if (window.confirm('Clear all entered balances? This cannot be undone.')) {
      clearAllBalances();
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-medium tracking-tight text-navy-950">
          Portfolio
        </h2>
        <button
          type="button"
          onClick={handleClearAll}
          className={`rounded-lg border border-navy/20 px-3 text-sm font-medium text-navy-950/70 transition-colors hover:border-navy/40 hover:text-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
        >
          Clear all balances
        </button>
      </div>
      <p className="mb-8 max-w-2xl text-navy-950/60">
        Enter your current balance for each card to see its cash-back floor, realistic value, and
        transfer ceiling. Points only pool within the same issuer's family of cards.
      </p>

      <PortfolioSummary
        ownedCards={ownedCards}
        balances={balances}
        transferPartners={transferPartners}
      />

      {ISSUER_ORDER.map((issuer) => {
        // Most premium (highest annual fee) first, left to right — annual
        // fee is this roster's own signal for card tier, so no separate
        // "premium rank" field is needed.
        const issuerCards = cards
          .filter((card) => card.issuer === issuer)
          .sort((a, b) => b.annualFee - a.annualFee);
        if (issuerCards.length === 0) return null;

        return (
          <section key={issuer} className="mb-10 last:mb-0">
            <h3 className="mb-4 font-display text-xs font-semibold uppercase tracking-wider text-navy-950/45">
              {ISSUER_LABELS[issuer]}
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {issuerCards.map((card) => (
                <PortfolioCard
                  key={card.id}
                  card={card}
                  balance={balances[card.id] ?? 0}
                  onBalanceChange={(value) => setBalance(card.id, value)}
                  owned={ownership[card.id] ?? false}
                  onOwnedChange={(value) => setOwned(card.id, value)}
                  allCards={ownedCards}
                  transferPartners={transferPartners}
                />
              ))}
            </div>
          </section>
        );
      })}
      <Methodology />
    </div>
  );
}
