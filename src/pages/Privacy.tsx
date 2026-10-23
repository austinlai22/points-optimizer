import type { ReactNode } from 'react';
import { PageIntro } from '../components/PageShell';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-navy/10 bg-white p-6 sm:p-7">
      <h2 className="font-display text-xl font-medium text-navy-950">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-navy-950/70">{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <>
      <PageIntro
        title="Privacy"
        visual={
          <div className="relative flex h-44 w-72 items-center justify-center">
            <div className="absolute h-40 w-40 rounded-full bg-navy/[0.06]" />
            <div className="absolute h-28 w-28 rounded-full bg-navy/[0.08]" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-navy-950 to-navy text-slate-50 shadow-card">
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
          </div>
        }
      >
        <p>
          PointCompass keeps what you enter in your own browser. It counts a few anonymous events
          to learn whether it is useful, and you will never be asked for bank logins.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-10 sm:px-6">
        <Block title="On the website">
          <p>
            Your cards, balances, trip prices and cash figures are saved in your browser's local
            storage so they are still there when you return. They are not sent to PointCompass. To
            delete them, clear your browser's site data for pointcompass.vercel.app.
          </p>
          <p>
            Trip links you copy contain the trip's price and award details. They never contain your
            balances or cash figures.
          </p>
        </Block>

        <Block title="Anonymous usage counts">
          <p>
            To learn whether the pilot is useful, the website counts two events: a recommendation
            being shown (and which kind it was), and a Chase Travel price being entered. Each count
            includes a random identifier created by your browser, which allows an estimate of how
            many different people use the site. No prices, balances, cash figures or other inputs
            are included. If your browser sends a Do Not Track signal, nothing is counted.
          </p>
        </Block>

        <Block title="Demo bank (Plaid test environment)">
          <p>
            Where it is enabled, "Use a demo bank" fetches invented balances from Plaid's test
            environment. It never connects to a real bank, and nothing it returns is stored.
          </p>
        </Block>

        <Block title="Hosting">
          <p>
            The website runs on Vercel, which keeps standard request logs, such as IP address and
            time, for a limited period. Usage counts are kept in an Upstash Redis database.
          </p>
        </Block>

        <p className="pt-2 text-xs text-navy-950/45">Last updated October 2026.</p>
      </div>
    </>
  );
}
