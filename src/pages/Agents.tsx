import { useState, type ReactNode } from 'react';
import { PageIntro } from '../components/PageShell';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';

const CONNECTOR_URL = 'https://pointcompass.vercel.app/api/mcp';
const CLAUDE_HELP = 'https://support.claude.com/en/articles/11175166';

const TOOLS: { name: string; does: string }[] = [
  { name: 'recommend_payment', does: 'Recommends paying cash, transferring, booking in Chase Travel or another portal, or waiting, for one trip, with the reasons and assumptions the website shows.' },
  { name: 'list_transfer_partners', does: "Lists a bank's airline and hotel partners and ratios, including card-specific exceptions." },
  { name: 'compute_cents_per_point', does: 'Works out the value per point of a redemption from its cash price, points price and taxes.' },
  { name: 'chase_travel_breakeven', does: 'Gives the highest Chase Travel points price worth accepting for a target value per point.' },
  { name: 'points_boost_rules', does: "States Chase's own Points Boost and legacy-rate rules for a Chase card." },
];

const EXAMPLES = [
  'Using PointCompass, should I pay $900 cash for a flight to Lisbon or use my 150,000 Chase points? United wants 60,000 miles plus $90.',
  'Which airlines can I transfer Amex points to, and at what ratio?',
  'Chase Travel shows 70,000 points for a $1,000 hotel. Is that worth it on a Sapphire Reserve?',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-navy/10 bg-white p-6 sm:p-7">
      <h2 className="font-display text-xl font-medium text-navy-950">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-navy-950/70">{children}</div>
    </section>
  );
}

export function Agents() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONNECTOR_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the URL is on screen to copy by hand.
    }
  };

  return (
    <>
      <PageIntro title="PointCompass for AI assistants">
        <p>
          Add PointCompass to Claude as a connector, and Claude can check points-or-cash decisions
          with the same engine and sourced data as this website.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-10 sm:px-6">
        <Section title="Connector address">
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm text-navy-950 ring-1 ring-navy/10">{CONNECTOR_URL}</code>
            <button
              type="button"
              onClick={copy}
              className={`rounded-full border border-navy/20 px-4 text-sm font-medium text-navy-950/70 hover:border-navy/40 ${TAP_TARGET} ${FOCUS_RING}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p>
            In Claude, add a custom connector with this address. No sign-in is needed. Claude's help
            page explains where the setting is on each plan:{' '}
            <a href={CLAUDE_HELP} className={`rounded font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}>
              Getting started with custom connectors
            </a>
            .
          </p>
        </Section>

        <Section title="What it can do">
          <ul className="space-y-3">
            {TOOLS.map(({ name, does }) => (
              <li key={name}>
                <code className="font-mono text-[13px] text-navy-950">{name}</code>
                <p className="mt-0.5">{does}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Try asking">
          <ul className="list-disc space-y-2 pl-5">
            {EXAMPLES.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </Section>

        <Section title="Limits">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              It does not look up live fares, hotel rates, award availability or Points Boost offers.
              It works only with the prices given to it.
            </li>
            <li>
              Every fact it returns comes with its source and the date it was checked. Estimates,
              such as "potential transfer value", are labelled as estimates.
            </li>
            <li>
              It is read-only and stores nothing about you or your conversation. It counts how often
              each tool is used, without any identifier, and limits how many requests one sender can
              make in an hour.
            </li>
            <li>Its answers are estimates, not financial advice. Please confirm prices before booking.</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
