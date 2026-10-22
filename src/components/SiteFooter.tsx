import { linkHandler } from '../lib/router';
import { FOCUS_RING } from '../styles/constants';

const LINK = `rounded underline decoration-navy/20 underline-offset-2 hover:text-navy-950/70 ${FOCUS_RING}`;

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-6 pt-4 sm:pb-2">
      <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-navy-950/40">
        PointCompass is an independent estimation tool and is not affiliated with, endorsed by, or
        sponsored by Chase, Capital One, American Express, Citi, Bank of America, Bilt, or any
        airline or hotel program named here. Figures are estimates based on this app's own
        assumptions, not financial advice. Verify prices and current terms before booking. What
        you type on the web stays in your browser; see{' '}
        <a href="/privacy" onClick={linkHandler('/privacy')} className={LINK}>
          Privacy
        </a>{' '}
        for the WhatsApp pilot and the anonymous counts we keep.
      </p>
      <p className="mt-3 text-center text-xs text-navy-950/40">
        <a href="/" onClick={linkHandler('/')} className={LINK}>
          Home
        </a>
        {' · '}
        <a href="/app" onClick={linkHandler('/app')} className={LINK}>
          Check a trip
        </a>
        {' · '}
        <a href="/privacy" onClick={linkHandler('/privacy')} className={LINK}>
          Privacy
        </a>
        {' · '}
        <a href="https://github.com/austinlai22/points-optimizer" className={LINK}>
          Source
        </a>
      </p>
    </footer>
  );
}
