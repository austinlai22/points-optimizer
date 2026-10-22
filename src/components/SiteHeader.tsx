import { useEffect, useState } from 'react';
import { linkHandler } from '../lib/router';
import { TAP_TARGET } from '../styles/constants';

export type PageName = 'home' | 'portfolio' | 'check' | 'privacy';

// Focus ring that stays visible on the navy banner.
const RING_ON_DARK =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy';

const SECTION_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#numbers', label: 'The numbers' },
];

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.14" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M19.8 12.2 17.4 17.4 12.2 19.8 14.6 14.6Z" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export function SiteHeader({ current }: { current: PageName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navLink = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${RING_ON_DARK} ${
      active ? 'text-slate-50' : 'text-slate-50/70 hover:text-slate-50'
    }`;

  const links = [
    ...SECTION_LINKS.map((l) => ({ ...l, active: false })),
    { href: '/portfolio', label: 'Portfolio', active: current === 'portfolio' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-[0_1px_0_rgba(248,250,252,0.08)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="/"
          onClick={linkHandler('/', close)}
          aria-current={current === 'home' ? 'page' : undefined}
          className={`flex items-center gap-2.5 rounded-lg text-slate-50 ${RING_ON_DARK}`}
        >
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight">PointCompass</span>
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, active }) => (
            <a
              key={href}
              href={href}
              onClick={linkHandler(href)}
              aria-current={active ? 'page' : undefined}
              className={navLink(active)}
            >
              {label}
            </a>
          ))}
          <a
            href="/app"
            onClick={linkHandler('/app')}
            aria-current={current === 'check' ? 'page' : undefined}
            className={`ml-3 inline-flex items-center rounded-full bg-slate-50 px-5 text-sm font-semibold text-navy transition-colors hover:bg-navy-100 motion-reduce:transition-none ${TAP_TARGET} ${RING_ON_DARK}`}
          >
            Check a trip
          </a>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <a
            href="/app"
            onClick={linkHandler('/app', close)}
            aria-current={current === 'check' ? 'page' : undefined}
            className={`inline-flex items-center rounded-full bg-slate-50 px-4 text-sm font-semibold text-navy ${TAP_TARGET} ${RING_ON_DARK}`}
          >
            Check a trip
          </a>
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

      {menuOpen && (
        <nav id="site-menu" aria-label="Main" className="border-t border-slate-50/10 px-4 pb-4 pt-2 md:hidden">
          {links.map(({ href, label, active }) => (
            <a
              key={href}
              href={href}
              onClick={linkHandler(href, close)}
              aria-current={active ? 'page' : undefined}
              className={`block ${navLink(active)} ${TAP_TARGET} flex items-center`}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
