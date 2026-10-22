import cardsData from '../data/cards.json';
import transferPartnersData from '../data/transferPartners.json';
import boostData from '../data/chase-points-boost.json';
import verdictConfig from '../data/verdict-config.json';
import { SiteFooter } from '../components/SiteFooter';
import { describeRunway, evaluateVerdict, formatCents, verdictHeadline } from '../lib/verdict';
import { linkHandler } from '../lib/router';
import { CARD_SURFACE, FOCUS_RING, HERO_SURFACE, LABEL, LABEL_ON_DARK, TAP_TARGET } from '../styles/constants';
import { formatPoints, formatUSD } from '../utils/format';
import { CARD_TERMS_VERIFIED_ON, formatVerifiedOn, oldestVerifiedOn } from '../utils/freshness';
import type { CardConfig, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

// The worked example is run through the real engine, not typed in, so the
// landing page can never show a verdict the app itself wouldn't give. Every
// input is made up and labelled as such.
const EXAMPLE = {
  trip: 'New York to Lisbon in May, round trip',
  cashPrice: 900,
  chasePoints: 150_000,
  awardPoints: 60_000,
  awardTaxes: 90,
  cash: { available: 6_000, monthlyLeftover: 300, monthlySpend: 2_500 },
  asOf: '2026-10-22',
};

const example = evaluateVerdict({
  tripCashPrice: EXAMPLE.cashPrice,
  awardTaxes: EXAMPLE.awardTaxes,
  ownedCards: cards.filter((c) => c.id === 'csr'),
  balances: { csr: EXAMPLE.chasePoints },
  transferPartners,
  award: { partnerId: 'united', pointsRequired: EXAMPLE.awardPoints },
  chase: { cardType: 'reserve', reserveAppliedBeforeCutoff: false },
  cash: EXAMPLE.cash,
  today: EXAMPLE.asOf,
});
const exampleTransfer = example.options.find((o) => o.kind === 'transfer')!;
const exampleChase = example.options.find((o) => o.kind === 'chaseTravel')!;

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
const WHATSAPP_HREF = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent('NYC to Lisbon in May, $900, worth using points?')}`
  : null;

const ratiosCheckedOn = oldestVerifiedOn(
  transferPartners.map((p) => p.verifiedOn).filter((d): d is string => Boolean(d)),
);

const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-full bg-navy px-6 text-sm font-medium text-slate-50 shadow-control transition-colors hover:bg-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex items-center justify-center rounded-full border border-navy/20 px-6 text-sm font-medium text-navy-950/80 transition-colors hover:border-navy/40 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <h2 id={`${id}-heading`} className="mb-6 font-display text-2xl font-medium tracking-tight text-navy-950 sm:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExampleRow({ label, value, detail, chosen }: { label: string; value: string; detail: string; chosen?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${chosen ? 'border-teal/40 bg-teal/5' : 'border-navy/10 bg-slate-50'}`}>
      <p className={LABEL}>{label}</p>
      <p className="mt-1 font-mono text-lg text-navy-950">{value}</p>
      <p className="mt-0.5 text-xs text-navy-950/55">{detail}</p>
    </div>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do you see Chase's Points Boost offers?",
    a: "No. Boost offers rotate and live inside Chase Travel, which PointCompass never logs in to. Instead it works out your breakeven: the most points a Chase Travel price can be and still be your best move. Paste the price Chase shows you and the verdict checks it exactly.",
  },
  {
    q: 'Is this financial advice?',
    a: "No. It's a calculator with its assumptions shown. Prices, award charts and card terms change; check them before you book.",
  },
  {
    q: 'What data do you keep?',
    a: (
      <>
        On the web, nothing you type leaves your browser. The WhatsApp pilot has to remember your
        answers between messages, so it stores them, keyed to a scrambled version of your number,
        until you text RESET. Details on the{' '}
        <a href="/privacy" onClick={linkHandler('/privacy')} className={`underline ${FOCUS_RING}`}>
          privacy page
        </a>
        .
      </>
    ),
  },
  {
    q: 'Which cards does it cover?',
    a: 'Chase, Capital One, American Express, Citi, Bank of America and Bilt, with 36 airline and hotel transfer partners.',
  },
  {
    q: 'Do I need to connect my bank?',
    a: 'No. You type in three numbers about your cash. No bank login, ever.',
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6">
        <a href="/" onClick={linkHandler('/')} className={`rounded font-display text-xl font-semibold tracking-tight text-navy-950 ${FOCUS_RING}`}>
          PointCompass
        </a>
        <nav aria-label="Page sections" className="hidden gap-5 text-sm text-navy-950/60 sm:flex">
          <a href="#how" className={`rounded hover:text-navy-950 ${FOCUS_RING}`}>How it works</a>
          <a href="#faq" className={`rounded hover:text-navy-950 ${FOCUS_RING}`}>FAQ</a>
          <a href="#numbers" className={`rounded hover:text-navy-950 ${FOCUS_RING}`}>The numbers</a>
        </nav>
      </header>

      <main>
        {/* 1. Hero */}
        <section className="mx-auto max-w-5xl px-4 pb-8 pt-14 sm:pt-24">
          <h1 className="max-w-3xl font-display text-4xl font-medium tracking-tight text-navy-950 sm:text-6xl">
            Points or cash? Know before you book.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-navy-950/65">
            PointCompass looks at your points <em>and</em> your cash cushion, then tells you
            whether to pay cash, transfer, book in Chase Travel, or wait. Including when paying
            cash is the smarter move.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/app" onClick={linkHandler('/app')} className={PRIMARY_BUTTON}>
              Check a trip
            </a>
            {WHATSAPP_HREF ? (
              <a href={WHATSAPP_HREF} className={SECONDARY_BUTTON}>
                Text it on WhatsApp
              </a>
            ) : (
              <span className={`${SECONDARY_BUTTON} cursor-default`}>WhatsApp: invite-only pilot</span>
            )}
          </div>
          <p className="mt-3 text-xs text-navy-950/45">
            The WhatsApp version is a small pilot on a test number, open to a handful of people.
          </p>
        </section>

        {/* 2. One worked example */}
        <Section id="example" title="One trip, three ways to pay">
          <div className={`${CARD_SURFACE} p-5 sm:p-6`}>
            <p className="text-sm text-navy-950/60">
              {EXAMPLE.trip}. A Sapphire Reserve holder with {formatPoints(EXAMPLE.chasePoints)}{' '}
              Chase points, {formatUSD(EXAMPLE.cash.available)} they could spend on travel, and{' '}
              {formatUSD(EXAMPLE.cash.monthlySpend)} of monthly spending.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ExampleRow
                label="Pay cash"
                value={formatUSD(EXAMPLE.cashPrice)}
                detail={`Leaves ${describeRunway(example.runway.payCash)}`}
              />
              <ExampleRow
                label="Chase Travel"
                value={`${formatPoints(exampleChase.pointsUsed)} pts`}
                detail={`${formatCents(exampleChase.cppCents!)} a point, before any Points Boost`}
              />
              <ExampleRow
                label="Transfer to United"
                value={`${formatPoints(exampleTransfer.pointsUsed)} pts + ${formatUSD(EXAMPLE.awardTaxes)}`}
                detail={`${formatCents(exampleTransfer.cppCents!)} a point after taxes`}
                chosen={example.verdict === 'TRANSFER_POINTS'}
              />
            </div>
            <div className={`${HERO_SURFACE} mt-5 p-5`}>
              <p className={LABEL_ON_DARK}>Verdict</p>
              <p className="mt-1 font-display text-2xl font-medium text-slate-50">{verdictHeadline(example)}</p>
              <p className="mt-1 text-slate-50/75">{example.reason}</p>
              {example.chaseTravel && (
                <p className="mt-3 text-sm text-slate-50/85">{example.chaseTravel.sentence}</p>
              )}
            </div>
            <p className="mt-4 text-xs text-navy-950/45">
              Illustrative: made-up prices and balances, run through the real calculator as of{' '}
              {formatVerifiedOn(EXAMPLE.asOf)}. Not a live fare or award price.
            </p>
          </div>
        </Section>

        {/* 3. How it works */}
        <Section id="how" title="How it works">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ['Tell us your points', 'Which cards you hold and roughly how many points are on each.'],
              ['Tell us your cash cushion', "What you could spend on travel, what's left each month, and what you usually spend."],
              ['Get a verdict', 'Pay cash, use points, or wait, with the reason and the numbers behind it.'],
            ].map(([title, body], i) => (
              <li key={title} className={`${CARD_SURFACE} p-5`}>
                <p className="font-mono text-sm text-teal">{i + 1}</p>
                <p className="mt-1 font-display text-lg font-medium text-navy-950">{title}</p>
                <p className="mt-1 text-sm text-navy-950/60">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-navy-950/55">No bank login required.</p>
        </Section>

        {/* 4. What makes it different */}
        <Section id="different" title="What's different">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ['It knows about your cash', "A great redemption isn't great if paying cash would leave you short next month. The verdict weighs both."],
              ['It says "pay cash" out loud', "When your points are worth more somewhere else, it tells you to keep them. That's a real answer, not a failure."],
              ['Points Boost breakeven', 'You get the exact Chase Travel price that beats your other options, instead of guessing whether a Boost offer is good.'],
            ].map(([title, body]) => (
              <div key={title} className={`${CARD_SURFACE} p-5`}>
                <p className="font-display text-lg font-medium text-navy-950">{title}</p>
                <p className="mt-1 text-sm text-navy-950/60">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. FAQ */}
        <Section id="faq" title="Questions and catches">
          <div className="divide-y divide-navy/10 border-y border-navy/10">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-1">
                <summary className={`flex cursor-pointer items-center justify-between gap-4 rounded py-3 font-medium text-navy-950 ${FOCUS_RING}`}>
                  {q}
                  <span aria-hidden="true" className="text-navy-950/40 transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-navy-950/65">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* 6. About the numbers */}
        <Section id="numbers" title="About the numbers">
          <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-navy-950/65">
            <li>
              <span className="font-medium text-navy-950/80">Chase Points Boost and the Reserve legacy rate</span>{' '}
              come only from Chase's own pages, each rule stored with its link, Chase's exact
              wording, and the date it was checked (last: {formatVerifiedOn(boostData.non_boost_rate.verified_on)}).
            </li>
            <li>
              <span className="font-medium text-navy-950/80">Transfer ratios</span> were last
              checked {ratiosCheckedOn ? formatVerifiedOn(ratiosCheckedOn) : 'at an unrecorded date'},
              each with its source: Capital One's own list, and recent public guides for issuers
              that only show theirs to signed-in cardholders;{' '}
              <span className="font-medium text-navy-950/80">card terms</span> in{' '}
              {formatVerifiedOn(CARD_TERMS_VERIFIED_ON)}. The test suite fails if any of it goes
              six months unchecked.
            </li>
            <li>
              <span className="font-medium text-navy-950/80">Estimates, labelled as such:</span>{' '}
              "potential transfer value" is this app's own estimate, and "strained" cash is a rule
              of thumb (under {verdictConfig.strain.min_months_of_buffer} month of spending left
              after paying, or a big share of your cash while you're spending more than you earn).
            </li>
            <li>
              <span className="font-medium text-navy-950/80">Prices are yours.</span> PointCompass
              never fetches fares or award space. It works with the prices you enter.
            </li>
          </ul>
          <p className="mt-6">
            <a href="/app" onClick={linkHandler('/app')} className={PRIMARY_BUTTON}>
              Check a trip
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
