import { formatPoints, formatUSD } from '../utils/format';
import { AnimatedNumber } from './AnimatedNumber';
import { CARD_SURFACE, HERO_SURFACE, LABEL_BASE, LABEL_ON_DARK } from '../styles/constants';
import type { RedemptionPath } from '../types';

interface RedemptionPathCardProps {
  path: RedemptionPath;
  rank: number;
  isTied: boolean;
  tripCashPrice: number;
}

function TransferIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M7 7h13l-4-4" />
      <path d="M17 17H4l4 4" />
    </svg>
  );
}

function PortalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 21v-9h6v9" />
    </svg>
  );
}

export function RedemptionPathCard({ path, rank, isTied, tripCashPrice }: RedemptionPathCardProps) {
  const { card, kind, partner, pointsUsed, cost, isPoorDeal, usesPooling, pooledFromCards } = path;
  const isTopPick = rank === 1;
  const savings = tripCashPrice - cost;

  const textPrimary = isTopPick ? 'text-slate-50' : 'text-navy-950';
  const textSecondary = isTopPick ? 'text-slate-50/70' : 'text-navy-950/70';
  const textMuted = isTopPick ? 'text-slate-50/40' : 'text-navy-950/40';
  const label = isTopPick ? LABEL_ON_DARK : `${LABEL_BASE} text-navy-950/45`;
  const borderColor = isTopPick ? 'border-slate-50/15' : 'border-navy/10';

  return (
    <div className={`${isTopPick ? HERO_SURFACE : CARD_SURFACE} flex flex-col gap-3 p-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs ${
              isTopPick ? 'bg-teal text-navy-950' : 'bg-navy/10 text-navy-950/60'
            }`}
          >
            {rank}
          </span>
          {isTied && (
            <span className={`text-xs font-medium ${textMuted}`}>Tied</span>
          )}
        </div>
        {isPoorDeal && (
          <span className="rounded-full bg-red/10 px-2 py-0.5 text-xs font-medium text-red">
            Poor deal
          </span>
        )}
      </div>

      <div>
        <h3 className={`font-display text-lg leading-tight ${textPrimary}`}>{card.name}</h3>
        <p className={`mt-1 flex items-center gap-1.5 text-sm ${textSecondary}`}>
          {kind === 'transfer' ? <TransferIcon /> : <PortalIcon />}
          {kind === 'transfer' ? `Transfer to ${partner?.name}` : 'Redeem via card portal'}
        </p>
        <p className={`mt-0.5 font-mono text-xs ${textMuted}`}>
          {formatUSD(card.annualFee)}/yr annual fee
        </p>
      </div>

      {usesPooling && pooledFromCards.length > 0 && (
        <p className={`text-xs ${textSecondary}`}>
          Requires transfer-in from {pooledFromCards.map((c) => c.name).join(', ')}
        </p>
      )}

      <div className={`grid grid-cols-2 gap-3 border-t pt-3 ${borderColor}`}>
        <div>
          <p className={label}>Points used</p>
          <p className={`font-mono text-sm ${textPrimary}`}>{formatPoints(pointsUsed)}</p>
        </div>
        <div className="text-right">
          <p className={label}>Cost</p>
          <p className={`font-mono text-sm ${textPrimary}`}>{formatUSD(cost)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className={label}>Savings vs. cash price</p>
        <p
          className={`font-mono text-lg font-medium ${
            savings > 0 ? 'text-teal' : savings === 0 ? 'text-orange' : 'text-red'
          }`}
        >
          <AnimatedNumber value={savings} format={formatUSD} />
        </p>
      </div>
    </div>
  );
}
