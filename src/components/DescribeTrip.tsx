import { useState, type FormEvent } from 'react';
import { readTripText, type ReadVia } from '../lib/ai/client';
import { isEmptyTrip, type ParsedTrip } from '../lib/ai/protocol';
import { partnerName } from '../lib/trips';
import { FIELD, FOCUS_RING, LABEL, TAP_TARGET } from '../styles/constants';

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
  const [status, setStatus] = useState<{ kind: 'idle' | 'reading' | 'done' | 'empty'; note?: string }>({ kind: 'idle' });

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
    setStatus({ kind: 'done', note: `Filled in below. ${note} Check the figures.` });
  };

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl border border-navy/10 bg-white p-4">
      <label htmlFor="describe-trip" className={`mb-1.5 block ${LABEL}`}>
        Describe your trip <span className="normal-case text-navy-950/40">(optional)</span>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="describe-trip"
          value={text}
          maxLength={600}
          onChange={(e) => setText(e.target.value)}
          placeholder="$900 cash or 60k United miles + $85"
          className={`${FIELD} min-w-0 flex-1 font-sans ${TAP_TARGET} ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={!text.trim() || status.kind === 'reading'}
          className={`shrink-0 rounded-full bg-navy px-5 text-sm font-semibold text-slate-50 hover:bg-navy-950 disabled:opacity-40 ${TAP_TARGET} ${FOCUS_RING}`}
        >
          {status.kind === 'reading' ? 'Reading…' : 'Fill in'}
        </button>
      </div>
      <p className="mt-2 text-xs text-navy-950/50" role="status">
        {status.note ?? 'Uses the AI in your browser when it has one, otherwise Google Gemini. Only what you type here is sent, never your balances or cash.'}
      </p>
    </form>
  );
}
