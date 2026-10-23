import { linkHandler } from '../lib/router';
import { LogoMark } from './LogoMark';

const RING_ON_DARK =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950';

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/app', label: 'Check a trip' },
      { href: '/portfolio', label: 'Portfolio' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#faq', label: 'FAQ' },
      { href: '/#numbers', label: 'The numbers' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: 'https://github.com/austinlai22/points-optimizer', label: 'Source code', external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8" />
              <span className="font-display text-base font-semibold">PointCompass</span>
            </p>
            <p className="mt-3 max-w-xs text-sm text-slate-50/55">
              A free tool for deciding whether to pay cash or use points for a trip.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-50/40">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map(({ href, label, external }) => (
                  <li key={href}>
                    <a
                      href={href}
                      onClick={external ? undefined : linkHandler(href)}
                      className={`rounded text-sm text-slate-50/70 hover:text-slate-50 ${RING_ON_DARK}`}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 border-t border-slate-50/10 pt-6 text-xs leading-relaxed text-slate-50/40">
          PointCompass is an independent tool. It is not affiliated with, endorsed by or sponsored by
          Chase, Capital One, American Express, Citi, Bank of America, Bilt, or any airline or hotel
          program it mentions. Figures are estimates based on the assumptions described in the app
          and are not financial advice. Please confirm prices and current terms before booking.
          Information you enter on this website stays in your browser.
        </p>
      </div>
    </footer>
  );
}
