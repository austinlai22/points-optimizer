import { useMemo, useState } from 'react';
import cardsData from '../data/cards.json';
import { formatCents, verdictHeadline } from '../lib/verdict';
import { describePointsOption, type TripContext, type TripInputs, type TripVerdict } from '../lib/trips';
import { isNoWhatIf, runWhatIf, type WhatIf } from '../lib/whatIf';
import type { CardConfig, Issuer } from '../types';
import { FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';
import { ISSUER_LABELS, ISSUER_ORDER } from '../utils/issuers';

const cards = cardsData as CardConfig[];

// "What if I had other cards or more points?": this trip through the same
// engine with made-up cards and balances. Only for looking: Portfolio stays
// as it is, and nothing here is kept.
export function WhatIfPanel({ trip, ctx }: { trip: TripInputs; ctx: TripContext }) {
  const ownedIds = useMemo(() => ctx.ownedCards.map((c) => c.id), [ctx.ownedCards]);
  const [held, setHeld] = useState<Set<string>>(() => new Set(ownedIds));
  const [extra, setExtra] = useState<Partial<Record<Issuer, string>>>({});

  const whatIf: WhatIf = {
    addCards: [...held].filter((id) => !ownedIds.includes(id)),
    removeCards: ownedIds.filter((id) => !held.has(id)),
    extraPoints: Object.fromEntries(
      Object.entries(extra)
        .map(([bank, v]) => [bank, Math.round(Number(v))])
        .filter(([, n]) => Number.isFinite(n) && n !== 0),
    ),
  };
  const empty = isNoWhatIf(whatIf);
  const result = empty ? null : runWhatIf(trip, ctx, whatIf);
  const banks = ISSUER_ORDER.filter((issuer) => cards.some((c) => c.issuer === issuer && held.has(c.id)));

  const toggle = (id: string) =>
    setHeld((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const reset = () => {
    setHeld(new Set(ownedIds));
    setExtra({});
  };

  return (
    <details className="group mt-5 rounded-3xl border border-navy/10 bg-white">
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl px-5 py-4 ${FOCUS_RING}`}>
        <span>
          <span className="block font-display text-base font-medium text-navy-950">What if…</span>
          <span className="block text-sm text-navy-950/55">Try this trip with other cards or more points. Your Portfolio isn't changed.</span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-navy-950/50 transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <div className="space-y-5 border-t border-navy/10 px-5 py-4">
        <fieldset>
          <legend className={`mb-2 ${LABEL}`}>Cards held</legend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {ISSUER_ORDER.flatMap((issuer) => cards.filter((c) => c.issuer === issuer)).map((c) => (
              <label key={c.id} className="flex min-h-9 items-center gap-2.5 text-sm text-navy-950/80">
                <input type="checkbox" checked={held.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-navy" />
                <span>
                  {c.name}
                  {!ownedIds.includes(c.id) && held.has(c.id) && <span className="ml-1.5 text-xs text-navy-950/45">(added)</span>}
                  {ownedIds.includes(c.id) && !held.has(c.id) && <span className="ml-1.5 text-xs text-navy-950/45">(taken away)</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {banks.length > 0 && (
          <fieldset>
            <legend className={`mb-2 ${LABEL}`}>More points (or fewer, with a minus)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {banks.map((bank) => (
                <label key={bank} className="block text-sm text-navy-950/70">
                  <span className="mb-1 block">{ISSUER_LABELS[bank]} points</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1000}
                    value={extra[bank] ?? ''}
                    placeholder="0"
                    onChange={(e) => setExtra((x) => ({ ...x, [bank]: e.target.value }))}
                    className={`${FIELD} h-11 ${FOCUS_RING}`}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {result ? (
          <div className="rounded-2xl bg-navy-100 px-4 py-3 text-sm" aria-live="polite">
            <p className={LABEL}>{result.changed ? 'The answer changes' : 'Same answer as now'}</p>
            <Outcome label="Now" verdict={result.now} />
            <Outcome label="What if" verdict={result.whatIf} strong />
            {result.notes.map((n) => (
              <p key={n} className="mt-2 text-xs text-amber">
                {n}
              </p>
            ))}
            <button type="button" onClick={reset} className={`mt-2 rounded-full px-3 text-sm font-semibold text-navy-950/60 hover:bg-navy/5 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
              Reset
            </button>
          </div>
        ) : (
          <p className="text-sm text-navy-950/50">Tick or untick cards, or add points, to see what changes.</p>
        )}
      </div>
    </details>
  );
}

function Outcome({ label, verdict, strong = false }: { label: string; verdict: TripVerdict | null; strong?: boolean }) {
  const best = verdict?.bestOption ?? null;
  const way = best ? describePointsOption(best) : null;
  return (
    <p className={`mt-1.5 ${strong ? 'text-navy-950' : 'text-navy-950/60'}`}>
      <span className="font-semibold">{label}:</span> {verdict ? verdictHeadline(verdict) : 'No recommendation'}
      {way && (
        <span className="text-navy-950/60">
          {' '}
          · {way.title}
          {best!.cppCents !== null && <span className="font-mono"> {formatCents(best!.cppCents)}/pt</span>}
        </span>
      )}
    </p>
  );
}
