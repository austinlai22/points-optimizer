import { useState, type FormEvent } from 'react';
import { readTripText, type ReadVia } from '../lib/ai/client';
import { isEmptyTrip, type ParsedTrip } from '../lib/ai/protocol';
import { readingChecks, type ReadingChecks } from '../lib/ai/checks';
import { partnerName } from '../lib/trips';
import { FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';

const VIA_NOTE: Record<ReadVia, string> = {
  device: 'Read by the AI in your browser, on your device.',
  gemini: 'Read by Google Gemini.',
  rules: 'Read without AI.',
};

// "SFO to Lisbon in May, $900 or 60k United miles + $85" → the trip form.
// Only what's typed here is read; nothing else from the page goes with it.
export function DescribeTrip({
  reachablePrograms,
  onFill,
}: {
  reachablePrograms: Set<string>;
  onFill: (trip: ParsedTrip) => void;
}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'reading' | 'done' | 'empty'; note?: string; checks?: ReadingChecks }>({ kind: 'idle' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setStatus({ kind: 'reading' });
    const { trip, via } = await readTripText(text.trim());
    if (isEmptyTrip(trip)) {
      setStatus({ kind: 'empty', note: "Couldn't find a price in that. Try something like “$900 cash or 60k United miles + $85”." });
      return;
    }
    // A program none of the held cards reach can't be chosen in the form.
    let note = VIA_NOTE[via];
    if (trip.program && !reachablePrograms.has(trip.program)) {
      note += ` None of your cards in Portfolio transfer to ${partnerName(trip.program)}, so that award was left out.`;
      trip.program = null;
      trip.award_points = null;
      trip.award_taxes_usd = null;
      trip.partner_points_held = null;
    }
    onFill(trip);
    const checks = readingChecks(trip);
    setStatus({ kind: 'done', note: `Filled in below. ${note}${checks.warnings.length ? '' : ' Check the figures.'}`, checks });
  };

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl border border-navy/10 bg-white p-4">
      <label htmlFor="describe-trip" className={`mb-1.5 block ${LABEL}`}>
        Describe your trip <span className="normal-case text-navy-950/40">(optional)</span>
      </label>
      <textarea
        id="describe-trip"
        value={text}
        maxLength={600}
        rows={2}
        onChange={(e) => {
          setText(e.target.value);
          // Grow with the text, so the whole description stays in view.
          e.target.style.height = 'auto';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="SFO to Lisbon in May: $900 cash, or 60k United miles + $85 in taxes"
        className={`block min-h-[4.5rem] w-full resize-none overflow-hidden rounded-xl border border-navy/15 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-navy-950 placeholder:text-navy-950/35 transition-colors hover:border-navy/30 motion-reduce:transition-none ${FOCUS_RING}`}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={!text.trim() || status.kind === 'reading'}
          className={`rounded-full bg-navy px-5 text-sm font-semibold text-slate-50 hover:bg-navy-950 disabled:opacity-40 ${TAP_TARGET} ${FOCUS_RING}`}
        >
          {status.kind === 'reading' ? 'Reading…' : 'Fill in'}
        </button>
      </div>
      <p className="mt-2 text-xs text-navy-950/50" role="status">
        {status.note ?? 'Uses the AI in your browser when it has one, otherwise Google Gemini. Only what you type here is sent, never your balances or cash.'}
      </p>
      {status.checks && status.checks.read.length > 0 && (
        <p className="mt-1.5 text-xs text-navy-950/70">
          <span className="font-semibold">Read:</span> {status.checks.read.join(' · ')}
        </p>
      )}
      {status.checks && status.checks.warnings.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-xs text-amber" aria-label="Worth checking">
          {status.checks.warnings.map((w) => (
            <li key={w} className="flex gap-1.5">
              <span aria-hidden="true">!</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
