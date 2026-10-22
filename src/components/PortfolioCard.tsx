import { computeCardValuation } from '../utils/valuation';
import { formatUSD, parseNonNegativeNumber } from '../utils/format';
import { CARD_SURFACE, FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import { ValueRangeBar } from './ValueRangeBar';
import { Toggle } from './Toggle';
import { CardArt } from './visuals/CardArt';
import type { CardConfig, TransferPartner } from '../types';

interface PortfolioCardProps {
  card: CardConfig;
  balance: number;
  onBalanceChange: (value: number) => void;
  owned: boolean;
  onOwnedChange: (value: boolean) => void;
  allCards: CardConfig[];
  transferPartners: TransferPartner[];
  // Shared across every card so the bars are comparable — see ValueRangeBar.
  axisMax: number;
}

export function PortfolioCard({
  card,
  balance,
  onBalanceChange,
  owned,
  onOwnedChange,
  allCards,
  transferPartners,
  axisMax,
}: PortfolioCardProps) {
  const valuation = owned
    ? computeCardValuation({ card, balance, allCards, transferPartners })
    : null;
  const inputId = `balance-${card.id}`;
  const ownedId = `owned-${card.id}`;

  return (
    <div className={`${CARD_SURFACE} flex flex-col gap-5 p-6 ${owned ? '' : 'opacity-80'}`}>
      <div className="flex items-center gap-4">
        <CardArt cardId={card.id} issuer={card.issuer} compact className="w-20" />
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
              Points balance
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

          {valuation && <ValueRangeBar valuation={valuation} axisMax={axisMax} />}
        </>
      ) : (
        <p className="text-sm text-navy-950/50">
          Turn on "I have this card" to include it.
        </p>
      )}
    </div>
  );
}
