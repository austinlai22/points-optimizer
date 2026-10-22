import cardsData from '../data/cards.json';
import transferPartnersData from '../data/transferPartners.json';
import { useCardBalances } from '../context/CardBalancesContext';
import { PortfolioCard } from './PortfolioCard';
import { PortfolioSummary } from './PortfolioSummary';
import { Methodology } from './Methodology';
import { PageIntro } from './PageShell';
import { computeCardValuation } from '../utils/valuation';
import { FOCUS_RING, ISSUER_LABELS, ISSUER_ORDER, TAP_TARGET } from '../styles/constants';
import type { CardConfig, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

export function PortfolioView() {
  const { balances, setBalance, clearAllBalances, ownership, setOwned } = useCardBalances();
  const ownedCards = cards.filter((card) => ownership[card.id]);

  // One axis for every card's bar, so bar length reads as dollars and cards
  // are comparable side by side.
  //
  // Deliberately keyed off the ceiling rather than the selected basis: if the
  // axis grew when you picked potential transfer value, every published
  // figure would slide left even though nothing about it changed — a $600
  // floor jumping from half-way along the bar to a third of the way is
  // exactly the kind of movement that makes a chart untrustworthy. Reserving
  // the full range up front costs some empty track at the lower bases and
  // buys an axis that never moves.
  const axisMax = ownedCards.reduce((max, card) => {
    const valuation = computeCardValuation({
      card,
      balance: balances[card.id] ?? 0,
      allCards: ownedCards,
      transferPartners,
    });
    return Math.max(max, valuation.ceiling);
  }, 0);

  const handleClearAll = () => {
    if (window.confirm('Clear every balance you have entered? This cannot be undone.')) {
      clearAllBalances();
    }
  };

  return (
    <>
      <PageIntro
        title="Portfolio"
        actions={
          <button
            type="button"
            onClick={handleClearAll}
            className={`rounded-full border border-navy/20 px-4 text-sm font-medium text-navy-950/70 transition-colors hover:border-navy/40 hover:text-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
          >
            Clear balances
          </button>
        }
      >
        <p>
          Turn on each card you hold and enter its points balance to see what the points are worth,
          from their cash-back value to their guaranteed travel value. Every bar uses the same scale,
          so cards can be compared directly. Points combine only within the same bank.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
            <section key={issuer} aria-labelledby={`issuer-${issuer}`} className="mb-12 last:mb-0">
              <h2
                id={`issuer-${issuer}`}
                className="mb-4 font-display text-lg font-medium text-navy-950"
              >
                {ISSUER_LABELS[issuer]}
              </h2>
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
                    axisMax={axisMax}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <Methodology />
      </div>
    </>
  );
}
