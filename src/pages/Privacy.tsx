import { SiteFooter } from '../components/SiteFooter';
import { linkHandler } from '../lib/router';
import { FOCUS_RING } from '../styles/constants';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-medium text-navy-950">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-navy-950/70">{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto max-w-3xl px-4 pt-6">
        <a href="/" onClick={linkHandler('/')} className={`rounded font-display text-xl font-semibold tracking-tight text-navy-950 ${FOCUS_RING}`}>
          PointCompass
        </a>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-medium tracking-tight text-navy-950">Privacy</h1>
        <p className="mt-3 text-navy-950/65">
          Short version: the website keeps your numbers in your own browser. The WhatsApp pilot
          has to remember your answers, so it stores the minimum, and RESET deletes it. Nobody is
          ever asked for bank logins.
        </p>

        <Block title="On the website">
          <p>
            Everything you type (cards, balances, trip prices, your cash cushion) is saved in
            your browser's local storage so it's still there next visit. It isn't sent to us. Clear
            your browser's site data for pointcompass.vercel.app to delete it.
          </p>
          <p>
            Trip links you copy contain the trip's price and award details, never your balances or
            cash figures.
          </p>
        </Block>

        <Block title="Anonymous usage counts">
          <p>
            To learn whether the pilot is useful, the site counts a few events: a verdict was shown
            (and which kind: pay cash, transfer, and so on) and a Chase Travel price was pasted.
            Each count carries a random id your browser makes up, so we can estimate how many
            different people use it. No prices, balances, cash figures or anything else you type
            are included. If your browser sends Do Not Track, nothing is counted.
          </p>
        </Block>

        <Block title="On WhatsApp (pilot)">
          <p>
            Messages pass through Meta's WhatsApp Business platform, under{' '}
            <a href="https://www.whatsapp.com/legal/privacy-policy" className={`underline ${FOCUS_RING}`}>
              WhatsApp's privacy policy
            </a>
            .
          </p>
          <p>
            So it doesn't have to ask everything again, PointCompass stores: your points balance
            per bank, your Chase card type (and whether you opened a Sapphire Reserve before June
            23, 2025), your three cash numbers, and the last trip's price. It does not store your
            trip description or your phone number: records are keyed to a one-way scrambled
            version of the number.
          </p>
          <p>
            It's deleted automatically 90 days after your last message. Text{' '}
            <strong>RESET</strong> at any time to delete it immediately.
          </p>
        </Block>

        <Block title="Demo bank (Plaid sandbox)">
          <p>
            Where it's switched on, "Use a demo bank" fetches made-up balances from Plaid's test
            environment. It never connects to a real bank, and nothing from it is stored.
          </p>
        </Block>

        <Block title="Hosting">
          <p>
            The site runs on Vercel, whose servers keep standard request logs (such as IP address
            and time) for a limited period. Stored data lives in an Upstash Redis database.
          </p>
        </Block>

        <p className="mt-10 text-xs text-navy-950/45">Last updated October 2026.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
