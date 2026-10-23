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
import { CardArt } from '../components/visuals/CardArt';
import { BreakevenScale, RunwayMeter, ValueBars } from '../components/visuals/Charts';
import { PhoneFrame } from '../components/visuals/PhoneFrame';
import { Reveal } from '../components/visuals/Reveal';
import { LogoMark } from '../components/LogoMark';
import type { CardConfig, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

// The worked example is run through the real engine rather than typed in, so
// the landing page can never show a recommendation the app itself wouldn't
// give. Every input is invented and labelled as such.
const EXAMPLE = {
  route: 'New York to Lisbon',
  when: 'May, round trip',
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
const exampleBars = [
  { label: 'Chase Travel', cents: exampleChase.cppCents, highlight: example.verdict === 'BOOK_CHASE_TRAVEL' },
  { label: 'Transfer to United', cents: exampleTransfer.cppCents, highlight: example.verdict === 'TRANSFER_POINTS' },
];

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
const WHATSAPP_HREF = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent('NYC to Lisbon in May, $900, worth using points?')}`
  : null;

const ratiosCheckedOn = oldestVerifiedOn(
  transferPartners.map((p) => p.verifiedOn).filter((d): d is string => Boolean(d)),
);
const partnerNames = transferPartners.map((p) => p.name).sort((a, b) => a.localeCompare(b));

const PRIMARY_BUTTON = `inline-flex items-center justify-center rounded-full bg-navy px-7 text-sm font-semibold text-slate-50 shadow-control transition-colors hover:bg-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex items-center justify-center rounded-full border border-navy/20 bg-white px-7 text-sm font-semibold text-navy-950/80 transition-colors hover:border-navy/40 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`;
const TILE = 'rounded-[2rem] border border-navy/10 bg-white';

function SectionHeading({ id, eyebrow, title, intro }: { id: string; eyebrow?: string; title: string; intro?: ReactNode }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-semibold text-navy/70">{eyebrow}</p>}
      <h2 id={`${id}-heading`} className="mt-2 font-display text-3xl font-semibold tracking-tight text-navy-950 sm:text-5xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-navy-950/60">{intro}</p>}
    </div>
  );
}

function Section({ id, tone = 'light', children }: { id: string; tone?: 'light' | 'white'; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`scroll-mt-20 ${tone === 'white' ? 'bg-white' : 'bg-slate-50'}`}>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">{children}</div>
    </section>
  );
}

// What the phone in the hero shows: the trip screen, as the app renders it.
function HeroScreen() {
  return (
    <div className="space-y-3 px-4 pb-6 pt-1 text-left">
      <div>
        <p className="text-[11px] font-medium text-navy-950/45">Check a trip</p>
        <p className="font-display text-lg font-semibold leading-tight text-navy-950">{EXAMPLE.route}</p>
        <p className="text-xs text-navy-950/55">
          {EXAMPLE.when} · {formatUSD(EXAMPLE.cashPrice)}
        </p>
      </div>
      <div className={`${HERO_SURFACE} rounded-2xl p-4`}>
        <p className={LABEL_ON_DARK}>Recommendation</p>
        <p className="mt-0.5 font-display text-xl font-semibold text-slate-50">{verdictHeadline(example)}</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-50/70">
          {formatPoints(exampleTransfer.pointsUsed)} Chase points to United MileagePlus
        </p>
      </div>
      <div className="rounded-2xl border border-navy/10 bg-white p-3.5">
        <ValueBars rows={exampleBars} benchmarkCents={exampleTransfer.benchmarkCents} />
      </div>
      <div className="rounded-2xl border border-navy/10 bg-white p-3.5">
        <RunwayMeter payCash={example.runway.payCash} usePoints={example.runway.usePoints} />
      </div>
    </div>
  );
}

function FloatingNote({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`absolute hidden rounded-2xl bg-white/90 px-4 py-3 shadow-card ring-1 ring-navy/10 backdrop-blur sm:block ${className}`}>
      <p className={LABEL}>{label}</p>
      <p className="mt-0.5 font-mono text-sm text-navy-950">{value}</p>
    </div>
  );
}

const STEPS: { title: string; body: string; visual: ReactNode }[] = [
  {
    title: 'Add your cards',
    body: 'Select your cards and balances once. PointCompass works out what every point is worth.',
    visual: (
      <div className="relative h-28 w-48">
        <CardArt cardId="venturex" issuer="capitalOne" compact className="absolute left-0 top-4 w-32 -rotate-12" />
        <CardArt cardId="amexgold" issuer="amex" compact className="absolute left-8 top-1 w-32 -rotate-3" />
        <CardArt cardId="csr" issuer="chase" className="absolute left-16 top-3 w-32 rotate-6" />
      </div>
    ),
  },
  {
    title: 'Add your cash position',
    body: 'Three figures let PointCompass protect the savings you need for the month ahead.',
    visual: (
      <div className="w-56 rounded-2xl bg-white p-4 shadow-card">
        <RunwayMeter payCash={example.runway.payCash} />
      </div>
    ),
  },
  {
    title: 'Get your answer',
    body: 'Enter the trip price and receive one clear recommendation, with the numbers behind it.',
    visual: (
      <div className={`${HERO_SURFACE} flex w-56 items-center gap-3 rounded-2xl p-4`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal text-slate-50">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div>
          <p className={LABEL_ON_DARK}>Recommendation</p>
          <p className="font-display text-base font-semibold text-slate-50">{verdictHeadline(example)}</p>
        </div>
      </div>
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

const NUMBERS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Chase rules, from Chase',
    body: `Points Boost and the Reserve legacy rate are taken only from Chase's own pages, each stored with its link, Chase's wording and the date it was checked, most recently ${formatVerifiedOn(boostData.non_boost_rate.verified_on)}.`,
    icon: <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />,
  },
  {
    title: 'Sourced and dated',
    body: `Every transfer ratio and card is linked to its source. Ratios were last checked in ${ratiosCheckedOn ? formatVerifiedOn(ratiosCheckedOn) : 'an unrecorded month'} and card terms in ${formatVerifiedOn(CARD_TERMS_VERIFIED_ON)}. Tests fail if anything goes six months unchecked.`,
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>
    ),
  },
  {
    title: 'Estimates are labelled',
    body: `"Potential transfer value" is this app's own estimate. Cash counts as stretched below ${verdictConfig.strain.min_months_of_buffer} month of spending, a rule of thumb rather than a published figure.`,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
  },
  {
    title: 'Your prices only',
    body: 'PointCompass never looks up fares or award availability. It works only with the prices you enter.',
    icon: (
      <>
        <path d="M20 12l-8 8-8-8 8-8h8z" />
        <circle cx="15.5" cy="8.5" r="1.25" />
      </>
    ),
  },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,#dfe8f3,#f8fafc_60%)]">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="inline-flex rounded-full bg-white/80 px-3.5 py-1 text-xs font-medium text-navy-950/60 ring-1 ring-navy/10">
            Free to use · No account · No bank login
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-semibold tracking-tight text-navy-950 sm:text-6xl lg:text-7xl">
            Points or cash? Know before you book.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-navy-950/60 sm:text-xl">
            Enter a trip and PointCompass tells you the best way to pay for it, based on what your
            points are worth and how much cash you can spare.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
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
          <p className="mt-4 text-sm text-navy-950/45">
            {WHATSAPP_HREF
              ? 'The WhatsApp version is a pilot with a small number of testers.'
              : 'A WhatsApp version is in a small invite-only pilot.'}
          </p>

          {/* A product shot: the app's own output on a phone, with two cards. */}
          <figure aria-label="Example recommendation on the PointCompass app" className="relative mx-auto mt-16 flex max-w-4xl justify-center">
            <div aria-hidden="true" className="absolute inset-x-0 top-24 -z-0 mx-auto h-72 max-w-2xl rounded-full bg-navy/10 blur-3xl" />
            <CardArt cardId="csr" issuer="chase" className="absolute left-[2%] top-28 hidden w-56 -rotate-[14deg] sm:block lg:left-[6%] lg:w-64" />
            <CardArt cardId="venturex" issuer="capitalOne" className="absolute right-[2%] top-48 hidden w-56 rotate-[12deg] sm:block lg:right-[6%] lg:w-64" />
            <FloatingNote label="If you pay cash" value={describeRunway(example.runway.payCash)} className="bottom-24 left-[4%] text-left lg:left-[12%]" />
            <FloatingNote label="Value per point" value={`${formatCents(exampleTransfer.cppCents!)} vs. ${formatCents(exampleTransfer.benchmarkCents)} usual`} className="right-[4%] top-12 text-left lg:right-[12%]" />
            <PhoneFrame className="relative z-10 w-[290px]">
              <HeroScreen />
            </PhoneFrame>
          </figure>
        </div>
      </section>

      {/* Supported banks */}
      <section aria-label="Supported banks" className="border-y border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-8 sm:px-6">
          <span className="text-sm text-navy-950/45">Works with points from</span>
          {['Chase', 'Capital One', 'American Express', 'Citi', 'Bank of America', 'Bilt'].map((name) => (
            <span key={name} className="font-display text-lg font-semibold text-navy-950/35">
              {name}
            </span>
          ))}
        </div>
      </section>

      <Section id="how">
        <SectionHeading
          id="how"
          eyebrow="How it works"
          title="From trip to answer in three steps."
          intro="Your figures stay in your browser, and no bank connection is required."
        />
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map(({ title, body, visual }, i) => (
            <Reveal key={title} delay={i * 80}>
              <li className={`${TILE} h-full overflow-hidden`}>
                <div className="flex h-48 items-center justify-center bg-gradient-to-b from-navy-100 to-slate-50">{visual}</div>
                <div className="p-6">
                  <p className="font-mono text-sm text-navy/60">Step {i + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-navy-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-950/60">{body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section id="example" tone="white">
        <SectionHeading
          id="example"
          eyebrow="An example"
          title="One trip. One clear answer."
          intro={
            <>
              {EXAMPLE.route}, {EXAMPLE.when}. The traveller holds a Sapphire Reserve with{' '}
              {formatPoints(EXAMPLE.chasePoints)} points, has {formatUSD(EXAMPLE.cash.available)}{' '}
              available for travel, and spends {formatUSD(EXAMPLE.cash.monthlySpend)} in a typical month.
            </>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {[
                {
                  label: 'Pay cash',
                  value: formatUSD(EXAMPLE.cashPrice),
                  detail: `Leaves ${describeRunway(example.runway.payCash)}`,
                  chosen: example.verdict === 'PAY_CASH',
                  art: (
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/[0.08] font-mono text-lg text-navy">$</span>
                  ),
                },
                {
                  label: 'Chase Travel',
                  value: `${formatPoints(exampleChase.pointsUsed)} pts`,
                  detail: `${formatCents(exampleChase.cppCents!)} per point, before any Points Boost offer`,
                  chosen: example.verdict === 'BOOK_CHASE_TRAVEL',
                  art: <CardArt cardId="csr" issuer="chase" compact className="w-16" />,
                },
                {
                  label: 'Transfer to United',
                  value: `${formatPoints(exampleTransfer.pointsUsed)} pts + ${formatUSD(EXAMPLE.awardTaxes)}`,
                  detail: `${formatCents(exampleTransfer.cppCents!)} per point after taxes`,
                  chosen: example.verdict === 'TRANSFER_POINTS',
                  art: (
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/[0.08] text-navy">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2.5 13.5l7-2 4.5-7.5h2l-2.5 7 5-1.5 1.5-2h1.5l-1 4 1 4h-1.5l-1.5-2-5-1.5 2.5 7h-2l-4.5-7.5-7-2z" />
                      </svg>
                    </span>
                  ),
                },
              ].map(({ label, value, detail, chosen, art }) => (
                <div
                  key={label}
                  className={`flex flex-wrap items-center gap-4 rounded-3xl border p-5 sm:flex-nowrap ${chosen ? 'border-teal/50 bg-teal/[0.04] shadow-card' : 'border-navy/10 bg-slate-50'}`}
                >
                  {art}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-navy-950">{label}</p>
                      {chosen && (
                        <span className="rounded-full bg-teal px-2.5 py-0.5 text-[11px] font-semibold text-slate-50">Recommended</span>
                      )}
                    </div>
                    <p className="text-sm text-navy-950/55">{detail}</p>
                  </div>
                  <p className="w-full shrink-0 font-mono text-base text-navy-950 sm:w-auto sm:text-lg">{value}</p>
                </div>
              ))}
            </div>

            <div className={`${HERO_SURFACE} p-6 sm:p-8`}>
              <p className={LABEL_ON_DARK}>Recommendation</p>
              <p className="mt-1 font-display text-3xl font-semibold text-slate-50">{verdictHeadline(example)}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-50/70">{example.reason}</p>
              <div className="mt-6">
                <ValueBars rows={exampleBars} benchmarkCents={exampleTransfer.benchmarkCents} tone="dark" />
              </div>
              {example.chaseTravel && (
                <div className="mt-6 border-t border-slate-50/10 pt-5">
                  <p className={LABEL_ON_DARK}>Chase Travel breakeven</p>
                  <BreakevenScale
                    breakevenPoints={example.chaseTravel.breakevenPoints}
                    standardPoints={example.chaseTravel.nonBoostPoints}
                    tone="dark"
                  />
                  <p className="text-sm text-slate-50/75">{example.chaseTravel.sentence}</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
        <p className="mt-6 text-center text-sm text-navy-950/45">
          Illustrative example. The prices and balances are invented and were calculated with the
          live tool in {formatVerifiedOn(EXAMPLE.asOf)}. They are not current fares or award prices.
        </p>
      </Section>

      <Section id="different">
        <SectionHeading
          id="different"
          eyebrow="Why PointCompass"
          title="Spend points when they are worth it. Keep cash when you need it."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <div className={`${TILE} grid h-full gap-6 p-7 sm:grid-cols-2 sm:p-8`}>
              <div>
                <h3 className="font-display text-2xl font-semibold text-navy-950">Protects your cash cushion</h3>
                <p className="mt-3 text-sm leading-relaxed text-navy-950/60">
                  If paying cash would leave you short for the month, PointCompass looks for a
                  points option that holds its value, or suggests waiting.
                </p>
              </div>
              <div className="self-center rounded-2xl bg-slate-50 p-5">
                <RunwayMeter payCash={example.runway.payCash} usePoints={example.runway.usePoints} />
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className={`${TILE} flex h-full flex-col p-7 sm:p-8`}>
              <h3 className="font-display text-2xl font-semibold text-navy-950">Saves your points for better trips</h3>
              <p className="mt-3 text-sm leading-relaxed text-navy-950/60">
                When a redemption is poor value, PointCompass recommends paying cash and keeping your
                points for a trip where they are worth more.
              </p>
              <div className="mt-auto pt-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 font-display text-lg font-semibold text-slate-50">
                  <span className="font-mono text-base text-slate-50/60">$</span> Pay cash
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className={`${TILE} flex h-full flex-col p-7 sm:p-8`}>
              <h3 className="font-display text-2xl font-semibold text-navy-950">Tells you which Chase Travel price to accept</h3>
              <p className="mt-3 text-sm leading-relaxed text-navy-950/60">
                Points Boost offers change often. PointCompass gives you the highest price worth
                accepting, so you can decide in seconds.
              </p>
              {example.chaseTravel && (
                <div className="mt-auto pt-4">
                  <BreakevenScale breakevenPoints={example.chaseTravel.breakevenPoints} standardPoints={example.chaseTravel.nonBoostPoints} />
                </div>
              )}
            </div>
          </Reveal>
          <Reveal className="lg:col-span-2" delay={80}>
            <div className={`${TILE} h-full p-7 sm:p-8`}>
              <h3 className="font-display text-2xl font-semibold text-navy-950">Covers {transferPartners.length} airline and hotel programs</h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-navy-950/60">
                Every transfer route from six banks, each at its published ratio, so the best option
                is never missed.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {partnerNames.slice(0, 16).map((name) => (
                  <span key={name} className="rounded-full border border-navy/10 bg-slate-50 px-3 py-1 text-xs text-navy-950/65">
                    {name}
                  </span>
                ))}
                <span className="rounded-full bg-navy px-3 py-1 text-xs text-slate-50">
                  and {partnerNames.length - 16} more
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section id="faq" tone="white">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div>
            <p className="text-sm font-semibold text-navy/70">FAQ</p>
            <h2 id="faq-heading" className="mt-2 font-display text-3xl font-semibold tracking-tight text-navy-950 sm:text-5xl">
              Frequently asked questions
            </h2>
            <div className="mt-8 hidden text-navy/15 lg:block" aria-hidden="true">
              <LogoMark tone="mono" className="h-44 w-44" />
            </div>
          </div>
          <div className="divide-y divide-navy/10 overflow-hidden rounded-3xl border border-navy/10 bg-slate-50">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className={`flex cursor-pointer items-center justify-between gap-4 px-6 py-5 font-medium text-navy-950 ${FOCUS_RING}`}>
                  {q}
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-navy shadow-sm transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className="px-6 pb-6 text-sm leading-relaxed text-navy-950/65">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      <Section id="numbers">
        <SectionHeading
          id="numbers"
          eyebrow="About the numbers"
          title="Where every figure comes from."
          intro="And which ones are estimates."
        />
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {NUMBERS.map(({ title, body, icon }, i) => (
            <Reveal key={title} delay={(i % 2) * 80}>
              <div className={`${TILE} flex h-full gap-5 p-7`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy/[0.07] text-navy">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {icon}
                  </svg>
                </span>
                <div>
                  <dt className="font-display text-lg font-semibold text-navy-950">{title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-navy-950/60">{body}</dd>
                </div>
              </div>
            </Reveal>
          ))}
        </dl>
      </Section>

      {/* Closing call to action */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className={`${HERO_SURFACE} relative overflow-hidden p-8 sm:p-12`}>
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-6 hidden w-80 sm:block">
              <CardArt cardId="csp" issuer="chase" className="absolute right-20 top-10 w-60 rotate-[18deg] opacity-90" />
              <CardArt cardId="amexplatinum" issuer="amex" className="absolute right-0 top-28 w-60 rotate-[6deg] opacity-90" />
            </div>
            <div className="relative max-w-lg">
              <h2 className="font-display text-3xl font-semibold text-slate-50 sm:text-4xl">Get an answer for your next trip.</h2>
              <p className="mt-3 text-slate-50/70">
                Enter the trip and your cash position. No account or bank login needed.
              </p>
              <a
                href="/app"
                onClick={linkHandler('/app')}
                className={`mt-7 inline-flex items-center rounded-full bg-slate-50 px-7 text-sm font-semibold text-navy transition-colors hover:bg-navy-100 motion-reduce:transition-none ${TAP_TARGET} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy`}
              >
                Check a trip
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
