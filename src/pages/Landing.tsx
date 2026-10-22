import type { ReactNode } from 'react';
import cardsData from '../data/cards.json';
import transferPartnersData from '../data/transferPartners.json';
import boostData from '../data/chase-points-boost.json';
import verdictConfig from '../data/verdict-config.json';
import { describeRunway, evaluateVerdict, formatCents, verdictHeadline } from '../lib/verdict';
import { linkHandler } from '../lib/router';
import { FOCUS_RING, HERO_SURFACE, LABEL, LABEL_ON_DARK, TAP_TARGET } from '../styles/constants';
import { formatPoints, formatUSD } from '../utils/format';
import { CARD_TERMS_VERIFIED_ON, formatVerifiedOn, oldestVerifiedOn } from '../utils/freshness';
import type { CardConfig, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

// The worked example is run through the real engine rather than typed in, so
// the landing page can never show a recommendation the app itself wouldn't
// give. Every input is invented and labelled as such.
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

const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-full bg-navy px-7 text-sm font-semibold text-slate-50 shadow-control transition-colors hover:bg-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex items-center justify-center rounded-full border border-navy/20 bg-white px-7 text-sm font-semibold text-navy-950/80 transition-colors hover:border-navy/40 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`;

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy/[0.08] text-navy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

function Section({
  id,
  title,
  intro,
  tone = 'light',
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  tone?: 'light' | 'white';
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`scroll-mt-20 ${tone === 'white' ? 'bg-white' : 'bg-slate-50'}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 max-w-2xl">
          <h2 id={`${id}-heading`} className="font-display text-3xl font-medium tracking-tight text-navy-950 sm:text-4xl">
            {title}
          </h2>
          {intro && <p className="mt-3 text-base leading-relaxed text-navy-950/65">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Add your cards',
    body: 'Select the cards you hold and enter the points balance on each.',
  },
  {
    title: 'Describe your cash position',
    body: 'Enter the cash you could spend on travel, what remains after bills each month, and your usual monthly spending.',
  },
  {
    title: 'Review the recommendation',
    body: 'Enter the trip price to see the recommended option, the value per point, and what each choice leaves in your savings.',
  },
];

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Accounts for your cash',
    body: 'A good redemption is less useful if paying cash would leave you short for the month. The recommendation considers your points and your savings together.',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M16 15h2" />
      </>
    ),
  },
  {
    title: 'Recommends cash when it should',
    body: 'If your points are worth more on another trip, PointCompass says so and suggests keeping them.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    title: 'A breakeven for Chase Travel',
    body: 'Points Boost offers change often. PointCompass calculates the highest Chase Travel price worth accepting, so you can compare it with the offer in front of you.',
    icon: (
      <>
        <path d="M4 19h16" />
        <path d="M6 15l4-4 3 3 5-6" />
      </>
    ),
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Can PointCompass see Chase Points Boost offers?',
    a: 'No. Offers change often and are only visible inside Chase Travel, which PointCompass never accesses. Instead it calculates your breakeven: the highest points price at which Chase Travel would be your best option. Enter the price Chase Travel shows and the recommendation will check it exactly.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. PointCompass is a calculator, and every assumption it makes is shown with the result. Prices, award charts and card terms change, so please confirm them before booking.',
  },
  {
    q: 'What information do you keep?',
    a: (
      <>
        On the website, nothing you enter leaves your browser. The WhatsApp pilot needs to remember
        your answers between messages, so it stores them under a scrambled version of your number
        until you send RESET. The{' '}
        <a href="/privacy" onClick={linkHandler('/privacy')} className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}>
          privacy page
        </a>{' '}
        has the details.
      </>
    ),
  },
  {
    q: 'Which cards are supported?',
    a: 'Cards from Chase, Capital One, American Express, Citi, Bank of America and Bilt, together with 36 airline and hotel programs they transfer to.',
  },
  {
    q: 'Do I need to connect a bank account?',
    a: 'No. You enter three figures about your cash yourself. PointCompass never asks for bank logins.',
  },
];

function ExampleOption({
  label,
  value,
  detail,
  recommended,
}: {
  label: string;
  value: string;
  detail: string;
  recommended?: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl border p-5 ${
        recommended ? 'border-teal/50 bg-white shadow-card' : 'border-navy/10 bg-white'
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-5 rounded-full bg-teal px-3 py-0.5 text-xs font-semibold text-slate-50">
          Recommended
        </span>
      )}
      <p className={LABEL}>{label}</p>
      <p className="mt-2 font-mono text-2xl text-navy-950">{value}</p>
      <p className="mt-1 text-sm text-navy-950/55">{detail}</p>
    </div>
  );
}

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-navy-100 to-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <p className="inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-navy-950/60 ring-1 ring-navy/10">
              Free to use · No account · No bank login
            </p>
            <h1 className="mt-5 font-display text-4xl font-medium tracking-tight text-navy-950 sm:text-5xl lg:text-6xl">
              Points or cash? Know before you book.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-950/65">
              PointCompass weighs your credit card points against your cash position and recommends
              whether to pay cash, transfer points, book through Chase Travel, or wait.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/app" onClick={linkHandler('/app')} className={PRIMARY_BUTTON}>
                Check a trip
              </a>
              {WHATSAPP_HREF ? (
                <a href={WHATSAPP_HREF} className={SECONDARY_BUTTON}>
                  Use it on WhatsApp
                </a>
              ) : (
                <a href="/#how" onClick={linkHandler('/#how')} className={SECONDARY_BUTTON}>
                  See how it works
                </a>
              )}
            </div>
            <p className="mt-4 text-sm text-navy-950/50">
              {WHATSAPP_HREF
                ? 'The WhatsApp version is a pilot with a small number of testers.'
                : 'A WhatsApp version is in a small invite-only pilot.'}
            </p>
          </div>

          {/* A real recommendation, shown the way the app shows it. */}
          <figure aria-label="Example recommendation" className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-navy/[0.04]" aria-hidden="true" />
            <div className={`${HERO_SURFACE} p-6 sm:p-7`}>
              <p className={LABEL_ON_DARK}>Example recommendation</p>
              <p className="mt-1 font-display text-3xl font-medium text-slate-50">{verdictHeadline(example)}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-50/75">{example.reason}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50/[0.06] px-4 py-3">
                  <p className={LABEL_ON_DARK}>Points value</p>
                  <p className="mt-1 font-mono text-lg text-slate-50">{formatCents(exampleTransfer.cppCents!)} per point</p>
                </div>
                <div className="rounded-2xl bg-slate-50/[0.06] px-4 py-3">
                  <p className={LABEL_ON_DARK}>If you pay cash</p>
                  <p className="mt-1 font-mono text-lg text-slate-50">{describeRunway(example.runway.payCash)}</p>
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      <Section
        id="how"
        tone="white"
        title="How it works"
        intro="Three short steps. Your figures stay in your browser and no bank connection is required."
      >
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map(({ title, body }, i) => (
            <li key={title} className="rounded-3xl border border-navy/10 bg-slate-50 p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy font-mono text-sm text-slate-50">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-medium text-navy-950">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-950/60">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="example"
        title="One trip, three ways to pay"
        intro={
          <>
            {EXAMPLE.trip}. The traveller holds a Sapphire Reserve with{' '}
            {formatPoints(EXAMPLE.chasePoints)} Chase points, has {formatUSD(EXAMPLE.cash.available)}{' '}
            available for travel, and spends {formatUSD(EXAMPLE.cash.monthlySpend)} in a typical month.
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 pt-3 sm:grid-cols-3">
          <ExampleOption
            label="Pay cash"
            value={formatUSD(EXAMPLE.cashPrice)}
            detail={`Leaves ${describeRunway(example.runway.payCash)}`}
            recommended={example.verdict === 'PAY_CASH'}
          />
          <ExampleOption
            label="Chase Travel"
            value={`${formatPoints(exampleChase.pointsUsed)} pts`}
            detail={`${formatCents(exampleChase.cppCents!)} per point, before any Points Boost offer`}
            recommended={example.verdict === 'BOOK_CHASE_TRAVEL'}
          />
          <ExampleOption
            label="Transfer to United"
            value={`${formatPoints(exampleTransfer.pointsUsed)} pts + ${formatUSD(EXAMPLE.awardTaxes)}`}
            detail={`${formatCents(exampleTransfer.cppCents!)} per point after taxes`}
            recommended={example.verdict === 'TRANSFER_POINTS'}
          />
        </div>
        {example.chaseTravel && (
          <div className="mt-6 rounded-3xl border border-navy/10 bg-white p-5 sm:p-6">
            <p className={LABEL}>Chase Travel breakeven</p>
            <p className="mt-2 text-navy-950/80">{example.chaseTravel.sentence}</p>
          </div>
        )}
        <p className="mt-5 text-sm text-navy-950/50">
          Illustrative example. The prices and balances are invented and were calculated with the
          live tool in {formatVerifiedOn(EXAMPLE.asOf)}. They are not current fares or award prices.
        </p>
      </Section>

      <Section id="different" tone="white" title="Why PointCompass">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {FEATURES.map(({ title, body, icon }) => (
            <div key={title} className="rounded-3xl border border-navy/10 bg-slate-50 p-6">
              <Icon>{icon}</Icon>
              <h3 className="mt-4 font-display text-lg font-medium text-navy-950">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-950/60">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Frequently asked questions">
        <div className="divide-y divide-navy/10 overflow-hidden rounded-3xl border border-navy/10 bg-white">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary
                className={`flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-medium text-navy-950 sm:px-6 ${FOCUS_RING}`}
              >
                {q}
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/[0.06] text-navy transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-navy-950/65 sm:px-6">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section
        id="numbers"
        tone="white"
        title="About the numbers"
        intro="Where each figure comes from, and which ones are estimates."
      >
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[
            [
              'Chase Points Boost and the Reserve legacy rate',
              `Taken only from Chase's own pages. Each rule is stored with its link, Chase's exact wording and the date it was checked, most recently ${formatVerifiedOn(boostData.non_boost_rate.verified_on)}.`,
            ],
            [
              'Transfer ratios and card terms',
              `Each ratio is linked to its source: Capital One's published list, and recent public guides for issuers that only show their lists to signed-in cardholders. Ratios were last checked in ${ratiosCheckedOn ? formatVerifiedOn(ratiosCheckedOn) : 'an unrecorded month'} and card terms in ${formatVerifiedOn(CARD_TERMS_VERIFIED_ON)}. The test suite fails if any of them goes six months without a check.`,
            ],
            [
              'Estimates',
              `"Potential transfer value" is this app's own estimate. Cash counts as stretched if paying would leave less than ${verdictConfig.strain.min_months_of_buffer} month of your usual spending, or would take a large share of your savings while your spending exceeds your income. Both are rules of thumb, not published figures.`,
            ],
            [
              'Prices',
              'PointCompass never looks up fares or award availability. It works only with the prices you enter.',
            ],
          ].map(([term, detail]) => (
            <div key={term} className="rounded-3xl border border-navy/10 bg-slate-50 p-6">
              <dt className="font-display text-base font-medium text-navy-950">{term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-navy-950/60">{detail}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Closing call to action */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
          <div className={`${HERO_SURFACE} flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10`}>
            <div>
              <h2 className="font-display text-2xl font-medium text-slate-50 sm:text-3xl">Check your next trip</h2>
              <p className="mt-2 max-w-lg text-slate-50/70">
                Enter the trip and your cash position to see what PointCompass recommends.
              </p>
            </div>
            <a
              href="/app"
              onClick={linkHandler('/app')}
              className={`inline-flex shrink-0 items-center rounded-full bg-slate-50 px-7 text-sm font-semibold text-navy transition-colors hover:bg-navy-100 motion-reduce:transition-none ${TAP_TARGET} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy`}
            >
              Check a trip
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
