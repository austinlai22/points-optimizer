import { useState, type ReactNode } from 'react';
import reportConfig from '../data/report-config.json';
import { Toggle } from '../components/Toggle';
import { isOptedOut, setOptedOut } from '../utils/analytics';
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
  const [counting, setCounting] = useState(() => !isOptedOut());
  const changeCounting = (on: boolean) => {
    setOptedOut(!on);
    setCounting(on);
  };

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
          PointCompass keeps what you enter in your own browser. Sharing a Chase Travel price is
          optional and anonymous, usage is counted without anything you type, and you will never
          be asked for bank logins.
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

        <Block title="Chase Travel price reports (optional)">
          <p>
            After a recommendation you can check the points price Chase Travel shows for your trip.
            The check works entirely in your browser. Sharing that price is separate, off by
            default, and only happens if you tick the box and press "Share price".
          </p>
          <p>A shared report contains only:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the date it was shared (no time)</li>
            <li>your Chase card type, and whether it was a flight or a hotel</li>
            <li>the 3-letter airport or city codes, the travel month and, for flights, the cabin if you give it</li>
            <li>the cash price, the Chase Travel points price, and whether a Points Boost offer was shown</li>
            <li>the value per point, worked out from those two prices</li>
          </ul>
          <p>
            It never contains your balances, cash figures, spending, IP address, browser details,
            or anything that links one report to another or to you. Reports are deleted
            automatically after {reportConfig.retention_months} months, and none are published.
          </p>
        </Block>

        <Block title="Anonymous usage counts">
          <p>
            To learn whether PointCompass is useful, it counts page views (through Vercel Web
            Analytics), recommendations shown and which kind they were, Chase Travel price checks,
            shared price reports, and calls from AI assistants using the agent tool. None of these
            include anything you typed.
          </p>
          <p>
            Recommendations also carry a random identifier your browser creates, so we can count how
            many different people use the site each week and how many come back. The list of days
            each identifier was seen is deleted after 120 days, and daily totals after about 13
            months. Nothing is counted if your browser sends a Do Not Track signal.
          </p>
          <div className="rounded-2xl bg-slate-50 p-4">
            <Toggle id="usage-counts" checked={counting} onChange={changeCounting} label="Count my visits anonymously" />
            <p className="mt-1 text-xs text-navy-950/55">
              {counting
                ? 'On. Turning this off stops this browser sending any usage counts.'
                : 'Off. This browser sends no usage counts.'}
            </p>
          </div>
        </Block>

        <Block title="AI assistants (agent tool)">
          <p>
            If you add PointCompass to an AI assistant, the assistant sends it trip prices and
            balances to work out a recommendation. Nothing it sends is stored: each request is
            answered and forgotten. Only a count of how often each tool is used is kept, with no
            identifier.
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
            time, for a limited period. Usage counts and shared price reports are kept in an Upstash
            Redis database.
          </p>
        </Block>

        <p className="pt-2 text-xs text-navy-950/45">Last updated October 2026.</p>
      </div>
    </>
  );
}
