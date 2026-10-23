import { useId } from 'react';

// The PointCompass mark: a plane on a tilted orbit around a compass. The back
// of the orbit passes behind the compass (masked out where they overlap) and
// the front passes over it, so it reads as a path around, not across.
//
//   onDark   white compass and orbit, teal needle and plane (the banner, footer)
//   onLight  navy compass and orbit, teal needle and plane
//   mono     everything in currentColor, for decorative or one-colour use
type Tone = 'onDark' | 'onLight' | 'mono';

const PLANE =
  'M12 2 C12.8 2 13.3 2.8 13.3 3.8 V9.2 L21 13.6 V15.6 L13.3 13.2 V18.2 L15.6 19.9 V21.4 L12 20.4 L8.4 21.4 V19.9 L10.7 18.2 V13.2 L3 15.6 V13.6 L10.7 9.2 V3.8 C10.7 2.8 11.2 2 12 2 Z';

const TEAL = '#0D9488';
const NAVY = '#1E3A5F';
const WHITE = '#F8FAFC';

export function LogoMark({ className = 'h-8 w-8', tone = 'onDark' }: { className?: string; tone?: Tone }) {
  const maskId = `logo-orbit-${useId().replace(/:/g, '')}`;
  const line = tone === 'onDark' ? WHITE : tone === 'onLight' ? NAVY : 'currentColor';
  const accent = tone === 'mono' ? 'currentColor' : TEAL;

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="white" />
          <circle cx="32" cy="33" r="15.5" fill="black" />
        </mask>
      </defs>
      {/* Back of the orbit, hidden where it passes behind the compass. */}
      <g mask={`url(#${maskId})`}>
        <ellipse
          cx="32"
          cy="33"
          rx="29"
          ry="11"
          transform="rotate(-22 32 33)"
          fill="none"
          stroke={line}
          strokeOpacity="0.35"
          strokeWidth="2.4"
        />
      </g>
      <circle cx="32" cy="33" r="12.5" fill="none" stroke={line} strokeWidth="4" />
      <g transform="rotate(40 32 33)">
        <path d="M32 24 L34.8 33 L29.2 33 Z" fill={accent} />
        <path d="M32 42 L29.2 33 L34.8 33 Z" fill={line} fillOpacity="0.5" />
      </g>
      {/* Front of the orbit, over the compass, and the plane on it. */}
      <g transform="translate(32 33) rotate(-22)">
        <path d="M-29 0 A29 11 0 0 0 29 0" fill="none" stroke={line} strokeWidth="2.4" strokeLinecap="round" />
        <g transform="translate(18 -8.6) rotate(108) scale(0.46) translate(-12 -12)">
          <path d={PLANE} fill={accent} />
        </g>
      </g>
    </svg>
  );
}
