import {
  CHAT_INSTRUCTIONS,
  LIMITS,
  PARSE_INSTRUCTIONS,
  parseAiReply,
  sanitizeParsedTrip,
  type ChatMessage,
} from '../../src/lib/ai/protocol';
import { recordEvent, utcDate } from '../analytics';
import { allow } from '../ratelimit';
import type { Store } from '../store';

// POST /api/ai: PointCompass's own use of Google Gemini, and nothing else.
// The instructions live here, so a caller can only send a trip description
// or a conversation, never its own prompt. Tools run in the browser, so what
// arrives is the person's words and tool results, never balances or cash.
// Nothing sent is stored or logged.
//
// GET /api/ai says whether it's set up, so the page can hide the assistant.

export interface AiDeps {
  store: Store | null;
  apiKey: string | undefined;
  model: string;
  secret: string;
  // A ceiling on calls per UTC day across everyone, to stay inside the free
  // tier's quota.
  dailyLimit: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const CALLS_PER_HOUR = 60;
const MAX_BODY = 80_000;
// Browsers send Origin; a page on another site is turned away.
const ALLOWED_ORIGINS = new Set(['https://pointcompass.vercel.app', 'http://localhost:5173', 'http://localhost:4173']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function validMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.messages) return null;
  let total = 0;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (typeof m !== 'object' || m === null) return null;
    const { role, text } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'model') || typeof text !== 'string' || !text.trim() || text.length > LIMITS.messageChars) return null;
    total += text.length;
    out.push({ role, text });
  }
  if (total > LIMITS.totalChars || out[out.length - 1].role !== 'user') return null;
  return out;
}

// A model's JSON reply. Some wrap it in a code fence or add a sentence around
// it despite being asked not to, so the first object found is used.
function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  for (const candidate of [trimmed, trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)]) {
    try {
      const value = JSON.parse(candidate);
      // A one-item list holding the object is read as the object.
      return Array.isArray(value) && value.length === 1 ? value[0] : value;
    } catch {
      // Try the next reading.
    }
  }
  return null;
}

export function createAiHandler(deps: AiDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  async function callGemini(instructions: string, contents: { role: string; parts: { text: string }[] }[]) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(deps.model)}:generateContent?key=${encodeURIComponent(deps.apiKey!)}`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instructions }] },
        contents,
        // Room for the model's own reasoning as well as the reply: newer
        // Gemini models count it against this limit, and a reply cut off
        // mid-way can't be read.
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
      }),
    });
    if (response.status === 429) return { error: 'busy' as const };
    if (!response.ok) return { error: 'failed' as const };
    const body = (await response.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { value: parseJson(text) };
  }

  return {
    async fetch(request: Request): Promise<Response> {
      const enabled = Boolean(deps.apiKey);
      if (request.method === 'GET') return json({ enabled });
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

      const origin = request.headers.get('origin');
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response('Forbidden', { status: 403 });
      if (!enabled) return json({ error: 'The assistant is not set up.' }, 503);

      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: 'Too large.' }, 413);
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: 'Bad request.' }, 400);
      }

      const mode = body.mode;
      const reading = mode === 'parse';
      let contents: { role: string; parts: { text: string }[] }[];
      let instructions: string;
      if (mode === 'parse') {
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > LIMITS.parseChars) return json({ error: 'Bad request.' }, 400);
        instructions = PARSE_INSTRUCTIONS;
        contents = [{ role: 'user', parts: [{ text: body.text }] }];
      } else if (mode === 'chat') {
        const messages = validMessages(body.messages);
        if (!messages) return json({ error: 'Bad request.' }, 400);
        instructions = CHAT_INSTRUCTIONS;
        contents = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      } else {
        return json({ error: 'Bad request.' }, 400);
      }

      if (deps.store) {
        if (!(await allow(deps.store, 'ai', request, { limit: CALLS_PER_HOUR, windowSeconds: 3600, secret: deps.secret, now: now() }))) {
          return json({ error: "You've reached this hour's limit for the assistant. The form still works." }, 429);
        }
        const today = await deps.store.incr(`ai:day:${utcDate(now())}`, 2 * 24 * 3600);
        if (today > deps.dailyLimit) return json({ error: "The assistant has reached today's limit. The form still works." }, 429);
        await recordEvent(deps.store, { name: 'ai_call', mode }, null, now());
      }

      // One more try when the reply can't be read, which happens now and
      // then; a busy or failed call isn't retried, to stay inside the quota.
      let reply: ReturnType<typeof parseAiReply> = null;
      for (let attempt = 0; attempt < 2 && !reply; attempt++) {
        const result = await callGemini(instructions, contents);
        if ('error' in result) {
          return result.error === 'busy'
            ? json({ error: 'The assistant is busy right now. Try again in a minute, or use the form.' }, 429)
            : json({ error: 'The assistant is unavailable right now. The form still works.' }, 502);
        }
        if (reading) return json({ trip: sanitizeParsedTrip(result.value) });
        reply = parseAiReply(result.value);
      }
      return reply ? json({ reply }) : json({ error: "The assistant's reply couldn't be read. Try asking again." }, 502);
    },
  };
}
