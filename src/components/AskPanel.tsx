import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AiError, chatStep } from '../lib/ai/client';
import type { ChatMessage } from '../lib/ai/protocol';
import { runTool, type ToolContext } from '../lib/ai/tools';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';

// "Ask PointCompass": a conversation where Google Gemini does the talking and
// PointCompass's own calculations do the deciding. The model asks for tools;
// they run here in the browser with the person's cards and balances, and only
// their results go back. Nothing is kept once the panel is closed and the
// page is left.

const TOOL_LABELS: Record<string, string> = {
  check_trip: 'Checked a trip with PointCompass',
  fill_trip_form: 'Filled in the trip form',
  current_trip: 'Looked at the trip in the form',
  list_saved_trips: 'Looked at your saved trips',
  plan_points: 'Planned your points across saved trips',
  list_transfer_partners: 'Looked up transfer partners',
  cents_per_point: 'Worked out a value per point',
};

const MAX_TOOL_STEPS = 6;

interface Shown {
  kind: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
}

export function AskPanel({
  open,
  onClose,
  question,
  toolContext,
}: {
  open: boolean;
  onClose: () => void;
  // A question to ask as soon as the panel opens, e.g. from "Explain this".
  question: { text: string; id: number } | null;
  toolContext: () => ToolContext;
}) {
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [shown, setShown] = useState<Shown[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askedRef = useRef<number | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [shown]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    let messages: ChatMessage[] = [...transcript, { role: 'user', text: text.trim() }];
    setShown((s) => [...s, { kind: 'user', text: text.trim() }]);
    try {
      for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
        const reply = await chatStep(messages);
        if (reply.type === 'answer') {
          messages = [...messages, { role: 'model', text: JSON.stringify(reply) }];
          setShown((s) => [...s, { kind: 'assistant', text: reply.text }]);
          break;
        }
        if (step === MAX_TOOL_STEPS) {
          setShown((s) => [...s, { kind: 'error', text: "The assistant couldn't finish that. Try asking more simply." }]);
          break;
        }
        const result = runTool(reply.tool, reply.args, toolContext());
        messages = [
          ...messages,
          { role: 'model', text: JSON.stringify(reply) },
          { role: 'user', text: `TOOL_RESULT ${reply.tool}: ${JSON.stringify(result)}` },
        ];
        setShown((s) => [...s, { kind: 'tool', text: TOOL_LABELS[reply.tool] ?? reply.tool }]);
      }
      setTranscript(messages);
    } catch (e) {
      setShown((s) => [...s, { kind: 'error', text: e instanceof AiError ? e.message : 'Something went wrong. Try again.' }]);
      // Keep what was asked so far, minus the failed turn.
      setTranscript(transcript);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open && question && askedRef.current !== question.id) {
      askedRef.current = question.id;
      void ask(question.text);
    }
    // ask is stable enough for this: it only runs once per question id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft;
    setDraft('');
    void ask(text);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="ask-heading" className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-navy/10 px-5 py-4">
          <h2 id="ask-heading" className="font-display text-lg font-semibold text-navy-950">
            Ask PointCompass
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`flex items-center justify-center rounded-full text-navy-950/50 hover:bg-navy/5 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
          {shown.length === 0 && (
            <div className="space-y-2 text-sm text-navy-950/60">
              <p>Ask about this trip, your saved trips or your points. For example:</p>
              {['Should I use points for this trip?', 'Which of my saved trips should I spend points on?', 'Set up a $900 trip for 60k United miles plus $85'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void ask(q)}
                  className={`block w-full rounded-2xl border border-navy/10 px-3 py-2 text-left text-navy-950/80 hover:border-navy/30 ${FOCUS_RING}`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {shown.map((m, i) =>
            m.kind === 'user' ? (
              <p key={i} className="ml-8 rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-slate-50">
                {m.text}
              </p>
            ) : m.kind === 'assistant' ? (
              <p key={i} className="mr-8 whitespace-pre-line rounded-2xl rounded-bl-md bg-navy-100 px-4 py-2.5 text-sm text-navy-950">
                {m.text}
              </p>
            ) : m.kind === 'tool' ? (
              <p key={i} className="flex items-center gap-2 text-xs text-navy-950/50">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden="true" />
                {m.text}
              </p>
            ) : (
              <p key={i} role="alert" className="text-sm text-amber">
                {m.text}
              </p>
            ),
          )}
          {busy && <p className="text-xs text-navy-950/45">Thinking…</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="border-t border-navy/10 px-5 py-4">
          <label htmlFor="ask-input" className="sr-only">
            Your question
          </label>
          <div className="flex gap-2">
            <textarea
              id="ask-input"
              ref={inputRef}
              rows={2}
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask a question"
              className={`min-w-0 flex-1 resize-none rounded-xl border border-navy/15 bg-slate-50 px-3.5 py-2.5 text-sm text-navy-950 placeholder:text-navy-950/35 ${FOCUS_RING}`}
            />
            <button type="submit" disabled={busy || !draft.trim()} className={`self-end rounded-full bg-navy px-4 text-sm font-semibold text-slate-50 disabled:opacity-40 ${TAP_TARGET} ${FOCUS_RING}`}>
              Ask
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-navy-950/45">
            Answers by Google Gemini, using PointCompass's own calculations. It sees your questions,
            your trips and PointCompass's results, never your balances or cash amounts. Not
            financial advice.
          </p>
        </form>
      </section>
    </div>
  );
}
