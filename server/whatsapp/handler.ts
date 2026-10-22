import { recordEvent } from '../analytics';
import type { Store } from '../store';
import { handleMessage, type ConversationState, type Inbound, type OutMessage } from './conversation';
import { hashPhone, isValidSignature } from './signature';

export interface WhatsAppDeps {
  verifyToken: string;
  appSecret: string;
  store: Store | null;
  appUrl: string;
  send: (to: string, message: OutMessage) => Promise<void>;
  // Vercel's waitUntil: keeps work running after the response is sent, so
  // Meta gets its 200 straight away. Without it the work is awaited inline.
  waitUntil?: (promise: Promise<unknown>) => void;
}

// Kept 90 days after the last message, then Redis drops it on its own.
const STATE_TTL_SECONDS = 90 * 24 * 60 * 60;
// Meta retries a delivery it isn't sure about; a message id seen in the last
// day has already been answered.
const SEEN_TTL_SECONDS = 24 * 60 * 60;

interface WebhookMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface WebhookBody {
  entry?: { changes?: { value?: { messages?: WebhookMessage[] } }[] }[];
}

function toInbound(message: WebhookMessage): Inbound | null {
  if (message.type === 'text' && message.text) return { text: message.text.body };
  const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
  if (message.type === 'interactive' && reply) return { text: reply.title, replyId: reply.id };
  return null;
}

function readState(raw: string | null): ConversationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConversationState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

async function processMessage(deps: WhatsAppDeps, message: WebhookMessage): Promise<void> {
  const { store, send } = deps;
  const inbound = toInbound(message);
  if (!inbound) {
    await send(message.from, { kind: 'text', body: 'I can only read text for now. Reply HELP for how this works.' });
    return;
  }
  if (!store) {
    await send(message.from, {
      kind: 'text',
      body: "PointCompass's WhatsApp pilot isn't switched on yet. Try the web app: " + `${deps.appUrl}/app`,
    });
    return;
  }

  const firstDelivery = await store.set(`wa:seen:${message.id}`, '1', { ttlSeconds: SEEN_TTL_SECONDS, nx: true });
  if (!firstDelivery) return;

  const userId = hashPhone(message.from, deps.appSecret);
  const key = `wa:state:${userId}`;
  const turn = handleMessage(readState(await store.get(key)), inbound, { appUrl: deps.appUrl });

  if (turn.state === null) await store.del(key);
  else await store.set(key, JSON.stringify(turn.state), { ttlSeconds: STATE_TTL_SECONDS });

  await Promise.all(turn.events.map((event) => recordEvent(store, event, 'whatsapp', userId)));
  // In order: a question must never arrive before the line introducing it.
  for (const reply of turn.replies) await send(message.from, reply);
}

export function createWhatsAppHandler(deps: WhatsAppDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'GET') {
        // Meta's one-time subscription handshake.
        const params = new URL(request.url).searchParams;
        const ok =
          params.get('hub.mode') === 'subscribe' &&
          deps.verifyToken.length > 0 &&
          params.get('hub.verify_token') === deps.verifyToken;
        return ok
          ? new Response(params.get('hub.challenge') ?? '', { status: 200 })
          : new Response('Forbidden', { status: 403 });
      }

      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

      const raw = await request.text();
      if (!isValidSignature(raw, request.headers.get('x-hub-signature-256'), deps.appSecret)) {
        return new Response('Invalid signature', { status: 401 });
      }

      let body: WebhookBody;
      try {
        body = JSON.parse(raw) as WebhookBody;
      } catch {
        return new Response('Bad request', { status: 400 });
      }

      // Delivery receipts ("sent", "read") arrive here too, with no messages.
      const messages = (body.entry ?? []).flatMap((entry) =>
        (entry.changes ?? []).flatMap((change) => change.value?.messages ?? []),
      );
      const work = Promise.all(
        messages.map((message) =>
          processMessage(deps, message).catch((error: unknown) => {
            // Never log the message or the number, only that it failed.
            console.error(`WhatsApp message ${message.id} failed:`, error instanceof Error ? error.message : error);
          }),
        ),
      );

      if (deps.waitUntil) deps.waitUntil(work);
      else await work;
      return new Response('OK', { status: 200 });
    },
  };
}
