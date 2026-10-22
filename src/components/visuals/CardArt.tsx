import { cardArtStyle } from '../../styles/cardArt';
import { ISSUER_LABELS } from '../../utils/issuers';
import type { Issuer } from '../../types';

interface CardArtProps {
  cardId: string;
  issuer: Issuer;
  className?: string;
  // Compact cards drop the name, for small thumbnails.
  compact?: boolean;
}

// A credit card drawn in code: gradient, chip, contactless mark, names.
// Decorative, so hidden from screen readers; the card's name is always given
// as text alongside it.
export function CardArt({ cardId, issuer, className = 'w-28', compact = false }: CardArtProps) {
  const style = cardArtStyle(cardId);
  const ink = style.ink === 'light' ? 'text-white' : 'text-navy-950';
  return (
    <div
      aria-hidden="true"
      className={`@container relative aspect-[1.586] shrink-0 overflow-hidden rounded-[9%/14%] shadow-[0_8px_20px_-8px_rgba(11,18,32,0.45)] ring-1 ring-black/5 ${ink} ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
    >
      {/* Soft sheen across the top, as on a real card. */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-between p-[7%]">
        <div className="flex items-start justify-between">
          <span className="text-[6.5cqw] font-semibold uppercase leading-none tracking-wider opacity-80">
            {ISSUER_LABELS[issuer]}
          </span>
          <svg viewBox="0 0 24 24" className="h-[9cqw] w-[9cqw] opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 2.5a13.5 13.5 0 0 1 0 19" />
          </svg>
        </div>
        <svg viewBox="0 0 40 30" className="h-[13cqw] w-[17.3cqw]" aria-hidden="true">
          <rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="#d8b56a" stroke="#b8924a" />
          <path d="M0 10h14M0 20h14M26 10h14M26 20h14M14 0v30M26 0v30" stroke="#b8924a" strokeWidth="1.2" />
        </svg>
        {!compact && (
          <span className="truncate text-[8cqw] font-medium leading-none tracking-wide">
            {style.shortName}
          </span>
        )}
      </div>
    </div>
  );
}
