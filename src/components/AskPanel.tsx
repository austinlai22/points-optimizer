import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AiError, chatStep } from '../lib/ai/client';
import type { ChatMessage } from '../lib/ai/protocol';
import { runTool, type Proposal, type ToolContext } from '../lib/ai/tools';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';

// "Ask PointCompass": a conversation where Google Gemini does the talking and
// PointCompass's own calculations do the deciding. The model asks for tools;
// they run here in the browser with the person's cards and balances, and only
// their results go back. Nothing is kept once the panel is closed and the
// page is left.

const TOOL_LABELS: Record<string, string> = {
  check_trip: 'Checked a trip with PointCompass',
  propose_trip: 'Suggested a trip for the form',
  propose_save_trip: 'Suggested saving a trip',
  propose_compare: 'Suggested a comparison',
  current_trip: 'Looked at the trip in the form',
  list_saved_trips: 'Looked at your saved trips',
  plan_points: 'Planned your points across saved trips',
  what_if: 'Tried a what-if with other cards or points',
  list_transfer_partners: 'Looked up transfer partners',
  cents_per_point: 'Worked out a value per point',
};

const MAX_TOOL_STEPS = 6;

type Shown =
  | { kind: 'user' | 'tool' | 'error'; text: string }
  | { kind: 'assistant'; text: string; options?: string[] }
  | { kind: 'proposal'; proposal: Proposal; state: 'open' | 'applied' | 'dismissed'; problem?: string };

const APPLY_LABEL: Record<Proposal['kind'], { action: string; done: string }> = {
  trip: { action: 'Apply', done: 'Filled in the form' },
  save: { action: 'Save', done: 'Saved to My trips' },
  compare: { action: 'Compare', done: 'Added to the comparison in My trips' },
};

export function AskPanel({
  open,
  onClose,
  question,
  toolContext,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  // A question to ask as soon as the panel opens, e.g. from "Explain this".
  question: { text: string; id: number } | null;
  toolContext: () => ToolContext;
  // Makes a suggested change. Returns a problem to show, or null when done.
  onApply: (p: Proposal) => string | null;
}) {
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [shown, setShown] = useState<Shown[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askedRef = useRef<number | null>(null);
  // What the person did with suggestions since their last message, so the
  // assistant knows without being told twice.
  const decisionsRef = useRef<string[]>([]);

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
    const pending = decisionsRef.current;
    const decisions = pending.length ? `(Since your last reply they ${pending.join('; ')}.)\n` : '';
    decisionsRef.current = [];
    let messages: ChatMessage[] = [...transcript, { role: 'user', text: decisions + text.trim() }];
    setShown((s) => [...s, { kind: 'user', text: text.trim() }]);
    const proposals: Proposal[] = [];
    try {
      for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
        const reply = await chatStep(messages);
        if (reply.type === 'answer') {
          messages = [...messages, { role: 'model', text: JSON.stringify(reply) }];
          setShown((s) => [
            ...s,
            { kind: 'assistant', text: reply.text, options: reply.options },
            ...proposals.map((proposal): Shown => ({ kind: 'proposal', proposal, state: 'open' })),
          ]);
          break;
        }
        if (step === MAX_TOOL_STEPS) {
          setShown((s) => [...s, { kind: 'error', text: "The assistant couldn't finish that. Try asking more simply." }]);
          // An unfinished turn isn't kept, so the conversation stays whole.
          messages = transcript;
          decisionsRef.current = [...pending, ...decisionsRef.current];
          break;
        }
        const result = runTool(reply.tool, reply.args, { ...toolContext(), proposals });
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
      // Keep what was asked so far, minus the failed turn, and what was
      // applied or dismissed, to tell the assistant next time.
      setTranscript(transcript);
      decisionsRef.current = [...pending, ...decisionsRef.current];
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

  const decide = (index: number, apply: boolean) => {
    const item = shown[index];
    if (item?.kind !== 'proposal' || item.state !== 'open') return;
    const problem = apply ? onApply(item.proposal) : null;
    if (!problem) decisionsRef.current.push(`${apply ? 'applied' : 'dismissed'} “${item.proposal.summary}”`);
    setShown((s) => s.map((m, i) => (i === index && m.kind === 'proposal' ? { ...m, state: problem ? 'open' : apply ? 'applied' : 'dismissed', problem: problem ?? undefined } : m)));
  };

  // The latest answer's quick replies, while nothing but its suggestion cards
  // has come after it.
  let lastAnswer: Shown | null = null;
  for (let i = shown.length - 1; i >= 0; i--) {
    if (shown[i].kind === 'proposal') continue;
    lastAnswer = shown[i];
    break;
  }
  const quickReplies = !busy && lastAnswer?.kind === 'assistant' ? (lastAnswer.options ?? []) : [];

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
              {['Should I use points for this trip?', 'Which of my saved trips should I spend points on?', 'What if I had 20,000 more Chase points?', 'Set up a $900 trip for 60k United miles plus $85'].map((q) => (
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
            ) : m.kind === 'proposal' ? (
              <div key={i} role="group" aria-label="Suggested change" className="mr-8 rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm">
                <p className="font-semibold text-navy-950">{m.proposal.summary}</p>
                <p className="mt-1 text-xs text-navy-950/55">Based on what you told me: “{m.proposal.basedOn}”</p>
                {m.problem && (
                  <p role="alert" className="mt-2 text-xs text-amber">
                    {m.problem}
                  </p>
                )}
                {m.state === 'open' ? (
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" onClick={() => decide(i, true)} className={`rounded-full bg-navy px-4 text-sm font-semibold text-slate-50 hover:bg-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
                      {APPLY_LABEL[m.proposal.kind].action}
                    </button>
                    <button type="button" onClick={() => decide(i, false)} className={`rounded-full px-4 text-sm font-semibold text-navy-950/60 hover:bg-navy/5 hover:text-navy-950 ${TAP_TARGET} ${FOCUS_RING}`}>
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-navy-950/60">{m.state === 'applied' ? APPLY_LABEL[m.proposal.kind].done : 'Dismissed'}</p>
                )}
              </div>
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
          {quickReplies.length > 0 && (
            <div className="mr-8 flex flex-wrap gap-2" aria-label="Quick replies">
              {quickReplies.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => void ask(o)}
                  className={`rounded-full border border-navy/20 px-3.5 text-sm text-navy-950 hover:border-navy/40 hover:bg-navy/5 ${TAP_TARGET} ${FOCUS_RING}`}
                >
                  {o}
                </button>
              ))}
            </div>
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
