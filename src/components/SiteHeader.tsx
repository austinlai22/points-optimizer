import { useEffect, useState, type ReactNode } from 'react';
import { useCardBalances } from '../context/CardBalancesContext';
import { linkHandler } from '../lib/router';
import { useSavedTrips } from '../lib/trips';
import { TAP_TARGET } from '../styles/constants';
import { LogoMark } from './LogoMark';

export type PageName = 'home' | 'portfolio' | 'trips' | 'check' | 'privacy' | 'agents';

// Focus ring that stays visible on the navy banner.
const RING_ON_DARK =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy';

// About PointCompass, as opposed to the product itself.
const LEARN_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#numbers', label: 'The numbers' },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16 14.5h2" strokeLinecap="round" />
    </svg>
  );
}

function TripsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M6 3.5h12v17l-6-4-6 4z" />
    </svg>
  );
}

function Count({ n, onLight = false }: { n: number; onLight?: boolean }) {
  if (n === 0) return null;
  return (
    <span className={`rounded-full px-1.5 font-mono text-[11px] leading-5 ${onLight ? 'bg-navy/10 text-navy-950/70' : 'bg-slate-50/15 text-slate-50/90'}`}>
      {n}
    </span>
  );
}

export function SiteHeader({ current }: { current: PageName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const { ownership } = useCardBalances();
  const savedTrips = useSavedTrips();
  const cardCount = Object.values(ownership).filter(Boolean).length;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // The product's own pages, kept together and set apart from the "about"
  // links so Portfolio reads as part of the tool, not as information.
  const toolLinks: { href: string; label: string; page: PageName; icon: ReactNode; count: number }[] = [
    { href: '/portfolio', label: 'Portfolio', page: 'portfolio', icon: <WalletIcon />, count: cardCount },
    { href: '/trips', label: 'My trips', page: 'trips', icon: <TripsIcon />, count: savedTrips.length },
  ];

  const learnLink = `rounded-lg px-3 py-2 text-sm font-medium text-slate-50/60 transition-colors hover:text-slate-50 motion-reduce:transition-none ${RING_ON_DARK}`;

  const checkTrip = (extra: string) => (
    <a
      href="/app"
      onClick={linkHandler('/app', close)}
      aria-current={current === 'check' ? 'page' : undefined}
      className={`inline-flex items-center rounded-full bg-slate-50 text-sm font-semibold text-navy transition-colors hover:bg-navy-100 motion-reduce:transition-none ${TAP_TARGET} ${RING_ON_DARK} ${extra}`}
    >
      Check a trip
    </a>
  );

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-[0_1px_0_rgba(248,250,252,0.08)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="/"
          onClick={linkHandler('/', close)}
          aria-current={current === 'home' ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-lg text-slate-50 ${RING_ON_DARK}`}
        >
          <LogoMark className="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight">PointCompass</span>
        </a>

        <nav aria-label="About PointCompass" className="hidden flex-1 items-center gap-1 lg:flex">
          {LEARN_LINKS.map(({ href, label }) => (
            <a key={href} href={href} onClick={linkHandler(href)} className={learnLink}>
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <nav aria-label="Your tools" className="hidden items-center gap-0.5 rounded-full bg-slate-50/10 p-1 ring-1 ring-slate-50/10 md:flex">
            {toolLinks.map(({ href, label, page, icon, count }) => {
              const active = current === page;
              return (
                <a
                  key={href}
                  href={href}
                  onClick={linkHandler(href)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none ${RING_ON_DARK} ${
                    active ? 'bg-slate-50/20 text-slate-50' : 'text-slate-50/85 hover:bg-slate-50/10 hover:text-slate-50'
                  }`}
                >
                  {icon}
                  {label}
                  <Count n={count} />
                </a>
              );
            })}
          </nav>
          {checkTrip('ml-1 hidden px-5 md:inline-flex')}

          <div className="flex items-center gap-2 lg:hidden">
            {checkTrip('px-4 md:hidden')}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className={`flex items-center justify-center rounded-lg text-slate-50 ${TAP_TARGET} ${RING_ON_DARK}`}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <nav id="site-menu" aria-label="Main" className="border-t border-slate-50/10 px-4 pb-4 pt-3 lg:hidden">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-slate-50/45 md:hidden">Your tools</p>
          <div className="mt-2 grid grid-cols-2 gap-2 md:hidden">
            {toolLinks.map(({ href, label, page, icon, count }) => (
              <a
                key={href}
                href={href}
                onClick={linkHandler(href, close)}
                aria-current={current === page ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-2xl px-3.5 text-sm font-medium ${TAP_TARGET} ${RING_ON_DARK} ${
                  current === page ? 'bg-slate-50 text-navy' : 'bg-slate-50/10 text-slate-50'
                }`}
              >
                {icon}
                <span className="flex-1">{label}</span>
                <Count n={count} onLight={current === page} />
              </a>
            ))}
          </div>
          <p className="mt-4 px-1 text-[11px] font-medium uppercase tracking-wider text-slate-50/45 md:mt-0">About</p>
          {LEARN_LINKS.map(({ href, label }) => (
            <a key={href} href={href} onClick={linkHandler(href, close)} className={`${learnLink} ${TAP_TARGET} flex items-center`}>
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
