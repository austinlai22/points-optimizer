import { computeCardValuation } from '../utils/valuation';
import { formatUSD, parseNonNegativeNumber } from '../utils/format';
import { CARD_SURFACE, FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import { ValueRangeBar } from './ValueRangeBar';
import { Toggle } from './Toggle';
import type { CardConfig, TransferPartner } from '../types';

interface PortfolioCardProps {
  card: CardConfig;
  balance: number;
  onBalanceChange: (value: number) => void;
  owned: boolean;
  onOwnedChange: (value: boolean) => void;
  allCards: CardConfig[];
  transferPartners: TransferPartner[];
}

function CardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.25" />
      <line x1="2.5" y1="10" x2="21.5" y2="10" />
    </svg>
  );
}

export function PortfolioCard({
  card,
  balance,
  onBalanceChange,
  owned,
  onOwnedChange,
  allCards,
  transferPartners,
}: PortfolioCardProps) {
  const valuation = owned
    ? computeCardValuation({ card, balance, allCards, transferPartners })
    : null;
  const inputId = `balance-${card.id}`;
  const ownedId = `owned-${card.id}`;

  return (
    <div className={`${CARD_SURFACE} flex flex-col gap-5 p-6`}>
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy/10 text-navy">
          <CardIcon />
        </div>
        <div>
          <h3 className="font-display text-lg leading-tight text-navy-950">{card.name}</h3>
          <p className="mt-1 font-mono text-sm text-navy-950/60">
            {formatUSD(card.annualFee)}{' '}
            <span className="font-sans text-navy-950/45">annual fee</span>
          </p>
        </div>
      </div>

      <div className="border-t border-navy/10 pt-4">
        <Toggle id={ownedId} checked={owned} onChange={onOwnedChange} label="I have this card" />
      </div>

      {owned ? (
        <>
          <div>
            <label htmlFor={inputId} className={`mb-1.5 block ${LABEL}`}>
              Points / cash-back balance
            </label>
            <input
              id={inputId}
              type="number"
              min={0}
              inputMode="numeric"
              value={balance || ''}
              onChange={(event) => onBalanceChange(parseNonNegativeNumber(event.target.value))}
              placeholder="0"
              className={`${FIELD} ${TAP_TARGET} ${FOCUS_RING}`}
            />
          </div>

          {valuation && <ValueRangeBar valuation={valuation} />}
        </>
      ) : (
        <p className="text-sm text-navy-950/50">
          Not currently held — toggle above to add it to your portfolio.
        </p>
      )}
    </div>
  );
}
