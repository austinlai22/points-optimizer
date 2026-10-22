import type { ReactNode } from 'react';
import { PageIntro } from '../components/PageShell';
import { FOCUS_RING } from '../styles/constants';

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
          The website keeps what you enter in your own browser. The WhatsApp pilot needs to
          remember your answers, so it stores as little as possible, and RESET deletes it. You will
          never be asked for bank logins.
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

        <Block title="On WhatsApp (pilot)">
          <p>
            Messages pass through Meta's WhatsApp Business platform and are covered by{' '}
            <a
              href="https://www.whatsapp.com/legal/privacy-policy"
              className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}
            >
              WhatsApp's privacy policy
            </a>
            .
          </p>
          <p>
            So that you are not asked the same questions each time, PointCompass stores your points
            balance for each bank, your Chase card type (and whether you opened a Sapphire Reserve
            before June 23, 2025), your three cash figures, and the price of your last trip. It does
            not store your trip description or your phone number. Records are filed under a
            one-way scrambled version of the number.
          </p>
          <p>
            Stored details are deleted automatically 90 days after your last message. Send{' '}
            <strong>RESET</strong> at any time to delete them immediately.
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
            time, for a limited period. Stored WhatsApp details and usage counts are kept in an
            Upstash Redis database.
          </p>
        </Block>

        <p className="pt-2 text-xs text-navy-950/45">Last updated October 2026.</p>
      </div>
    </>
  );
}
