import { isEmptyTrip, PARSE_INSTRUCTIONS, sanitizeParsedTrip, type AiReply, type ChatMessage, type ParsedTrip } from './protocol';
import { readTrip } from './readTrip';

// The browser's side of the AI features: Chrome's on-device model where it's
// ready, PointCompass's Gemini endpoint otherwise, and for reading a trip, a
// plain text reader when neither is available.

let enabledPromise: Promise<boolean> | null = null;

// Whether the server's assistant is set up (has a Gemini key). Asked once.
export function serverAiEnabled(): Promise<boolean> {
  enabledPromise ??= fetch('/api/ai')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((b: { enabled?: boolean }) => b.enabled === true)
    .catch(() => false);
  return enabledPromise;
}

// For tests: decide the answer without asking the server.
export function setServerAiEnabled(enabled: boolean) {
  enabledPromise = Promise.resolve(enabled);
}

export class AiError extends Error {}

async function post<T>(body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new AiError("The assistant couldn't be reached. Check your connection and try again.");
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new AiError(data.error ?? 'The assistant is unavailable right now.');
  return data;
}

// Chrome's built-in model (Gemini Nano), used only when it's already on the
// device: never starts its multi-gigabyte download on someone's behalf.
interface OnDeviceModel {
  availability(options?: unknown): Promise<string>;
  create(options?: unknown): Promise<{ prompt(input: string, options?: unknown): Promise<string>; destroy?: () => void }>;
}

function onDeviceModel(): OnDeviceModel | null {
  const g = globalThis as unknown as { LanguageModel?: OnDeviceModel };
  return g.LanguageModel ?? null;
}

const NUMBER_OR_NULL = { type: ['number', 'null'] };
const TRIP_SCHEMA = {
  type: 'object',
  properties: {
    trip_cash_price_usd: NUMBER_OR_NULL,
    program: { type: ['string', 'null'] },
    award_points: NUMBER_OR_NULL,
    award_taxes_usd: NUMBER_OR_NULL,
    partner_points_held: NUMBER_OR_NULL,
    chase_travel_points: NUMBER_OR_NULL,
  },
};

async function readOnDevice(text: string): Promise<ParsedTrip | null> {
  const model = onDeviceModel();
  if (!model) return null;
  try {
    const status = await model.availability();
    if (status !== 'available' && status !== 'readily') return null;
    const session = await model.create({ initialPrompts: [{ role: 'system', content: PARSE_INSTRUCTIONS }] });
    try {
      const out = await session.prompt(text, { responseConstraint: TRIP_SCHEMA });
      return sanitizeParsedTrip(JSON.parse(out));
    } finally {
      session.destroy?.();
    }
  } catch {
    return null;
  }
}

export type ReadVia = 'device' | 'gemini' | 'rules';

// Reads a trip from someone's own words: on the device if possible, then
// Gemini, then the plain reader. Says which, so the page can tell them.
export async function readTripText(text: string): Promise<{ trip: ParsedTrip; via: ReadVia }> {
  const onDevice = await readOnDevice(text);
  if (onDevice && !isEmptyTrip(onDevice)) return { trip: onDevice, via: 'device' };
  if (await serverAiEnabled()) {
    try {
      const { trip } = await post<{ trip: unknown }>({ mode: 'parse', text });
      const parsed = sanitizeParsedTrip(trip);
      if (!isEmptyTrip(parsed)) return { trip: parsed, via: 'gemini' };
    } catch {
      // Fall through to the plain reader.
    }
  }
  return { trip: readTrip(text), via: 'rules' };
}

// One step of a conversation: the model either asks for a tool or answers.
export async function chatStep(messages: ChatMessage[]): Promise<AiReply> {
  const { reply } = await post<{ reply: AiReply }>({ mode: 'chat', messages });
  return reply;
}
