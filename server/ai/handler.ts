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
  // Tried in order: when one is busy or down, the next answers.
  models: string[];
  secret: string;
  // A ceiling on calls per UTC day across everyone, to stay inside the free
  // tier's quota.
  dailyLimit: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  // How long to wait for one model before trying the next. Reading a trip
  // gets half: the page can read it without AI if need be.
  timeoutMs?: number;
}

// The model that has answered well so far first, then an older light one,
// then a fuller one. Each has its own free-tier quota.
export const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

// "a, b" from an env var, or the default chain.
export function modelsFrom(value: string | undefined): string[] {
  const list = (value ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

// How long a model is passed over after it fails, in seconds.
const COOLDOWN = { busy: 60, failed: 30, missing: 600 } as const;
type CallError = keyof typeof COOLDOWN;
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

// The first complete {...} in some text, minding braces inside strings.
function firstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// A model's JSON reply. Some wrap it in a code fence or add a sentence around
// it despite being asked not to, and some ask for two tools at once, as a
// list or one object after another. The first object is used: the browser
// asks again for the next step.
function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  for (const candidate of [trimmed, firstObject(trimmed)]) {
    if (candidate === null) continue;
    try {
      const value = JSON.parse(candidate);
      return Array.isArray(value) ? (value[0] ?? null) : value;
    } catch {
      // Try the next reading.
    }
  }
  return null;
}

export function createAiHandler(deps: AiDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  // Kept for as long as the function stays warm, which is enough to skip a
  // model that just failed without a store round trip on every call.
  const coolingUntil = new Map<string, number>();
  // Models that turned down a thinking setting: asked without one from then on.
  const noThinking = new Set<string>();

  type Result = { error: CallError } | { value: unknown };

  async function callGemini(model: string, instructions: string, contents: { role: string; parts: { text: string }[] }[], thinking: 'MINIMAL' | 'LOW', timeoutMs: number): Promise<Result> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(deps.apiKey!)}`;
    const send = () =>
      fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: instructions }] },
          contents,
          // Little thinking: reading a trip or picking a tool doesn't need
          // much, and it's most of the wait. The token limit leaves room for
          // what thinking there is, since a reply cut off can't be read.
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
            ...(noThinking.has(model) ? {} : { thinkingConfig: { thinkingLevel: thinking } }),
          },
        }),
      });
    let response: Response;
    try {
      response = await send();
      if (response.status === 400 && !noThinking.has(model) && /thinking/i.test(await response.clone().text())) {
        noThinking.add(model);
        response = await send();
      }
    } catch {
      // Timed out or couldn't connect.
      return { error: 'failed' };
    }
    if (response.status === 429) return { error: 'busy' };
    if (response.status === 404) return { error: 'missing' };
    if (!response.ok) return { error: response.status === 503 ? 'busy' : 'failed' };
    const body = (await response.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] } | null;
    const text =
      body?.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('') ?? '';
    return { value: parseJson(text) };
  }

  // Models not resting after a failure, in order; resting ones after them,
  // in case nothing else is left.
  function modelOrder(): string[] {
    const t = now().getTime();
    const ready = deps.models.filter((m) => (coolingUntil.get(m) ?? 0) <= t);
    return [...ready, ...deps.models.filter((m) => !ready.includes(m))];
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

      // Each model in turn until one answers. A reply that can't be read
      // gets one more try, from the same model; a busy or failed model is
      // rested and the next one asked.
      const thinking = reading ? 'MINIMAL' : 'LOW';
      const order = modelOrder();
      let lastError: CallError | null = null;
      let unreadable = 0;
      for (let i = 0; i < order.length; ) {
        const result = await callGemini(order[i], instructions, contents, thinking, (deps.timeoutMs ?? 20_000) / (reading ? 2 : 1));
        if ('error' in result) {
          coolingUntil.set(order[i], now().getTime() + COOLDOWN[result.error] * 1000);
          lastError = result.error;
          i++;
          continue;
        }
        if (reading) return json({ trip: sanitizeParsedTrip(result.value) });
        const reply = parseAiReply(result.value);
        if (reply) return json({ reply });
        if (++unreadable >= 2) break;
      }
      if (unreadable) return json({ error: "The assistant's reply couldn't be read. Try asking again." }, 502);
      return lastError === 'busy'
        ? json({ error: 'The assistant is busy right now. Try again in a minute, or use the form.' }, 429)
        : json({ error: 'The assistant is unavailable right now. The form still works.' }, 502);
    },
  };
}
