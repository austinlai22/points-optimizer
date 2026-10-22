import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../store';
import type { OutMessage } from './conversation';
import { createWhatsAppHandler } from './handler';
import { hashPhone, isValidSignature } from './signature';

const SECRET = 'test-app-secret';
const PHONE = '15551234567';

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function setup() {
  const store = createMemoryStore();
  const sent: { to: string; message: OutMessage }[] = [];
  const handler = createWhatsAppHandler({
    verifyToken: 'verify-me',
    appSecret: SECRET,
    store,
    appUrl: 'https://pointcompass.example',
    send: async (to, message) => {
      sent.push({ to, message });
    },
  });
  let nextId = 0;
  // Sends one text message from PHONE through the real handler, signed.
  async function say(text: string, interactive?: { id: string; title: string }) {
    const message = interactive
      ? { id: `m${nextId++}`, from: PHONE, type: 'interactive', interactive: { type: 'button_reply', button_reply: interactive } }
      : { id: `m${nextId++}`, from: PHONE, type: 'text', text: { body: text } };
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [message] } }] }] });
    const before = sent.length;
    const response = await handler.fetch(
      new Request('https://x/api/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': sign(body) } }),
    );
    expect(response.status).toBe(200);
    return sent.slice(before).map((s) => (s.message.kind === 'text' ? s.message.body : s.message.body));
  }
  return { store, sent, handler, say };
}

describe('webhook security', () => {
  // Spec case 10.
  it('rejects a POST with an invalid signature, and does nothing with it', async () => {
    const { handler, sent, store } = setup();
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: 'x', from: PHONE, type: 'text', text: { body: 'NYC $900' } }] } }] }],
    });
    for (const header of [sign(body, 'wrong-secret'), 'sha256=deadbeef', '', sign(`${body} `)]) {
      const response = await handler.fetch(
        new Request('https://x/api/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': header } }),
      );
      expect(response.status).toBe(401);
    }
    expect(sent).toEqual([]);
    expect(store.dump().size).toBe(0);
  });

  it('accepts a correctly signed body', () => {
    expect(isValidSignature('{"a":1}', sign('{"a":1}'), SECRET)).toBe(true);
    expect(isValidSignature('{"a":1}', sign('{"a":1}'), '')).toBe(false);
  });

  it('completes the verification handshake only with the right token', async () => {
    const { handler } = setup();
    const good = await handler.fetch(
      new Request('https://x/api?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42'),
    );
    expect(good.status).toBe(200);
    expect(await good.text()).toBe('42');
    const bad = await handler.fetch(
      new Request('https://x/api?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=42'),
    );
    expect(bad.status).toBe(403);
  });
});

describe('conversation end to end', () => {
  it('asks only for what is missing, one at a time, then gives a verdict', async () => {
    const { say } = setup();
    expect(await say('NYC to Lisbon in May, $900, worth using points?')).toEqual([
      expect.stringMatching(/^Which points do you have/),
    ]);
    expect(await say('Chase 120k, Amex 40k')).toEqual([expect.stringMatching(/^Which Chase card/)]);
    expect(await say('Sapphire Reserve', { id: 'reserve', title: 'Sapphire Reserve' })).toEqual([
      expect.stringMatching(/before June 23, 2025/),
    ]);
    expect(await say('No, after', { id: 'no', title: 'No, after' })).toEqual([
      expect.stringMatching(/cash could you spend/),
    ]);
    expect(await say('$4,000')).toEqual([expect.stringMatching(/left over each month/)]);
    expect(await say('-150')).toEqual([expect.stringMatching(/spend in a typical month/)]);

    const [verdict] = await say('2.5k');
    const lines = verdict.split('\n');
    expect(lines.length).toBeLessThanOrEqual(6);
    expect(lines[0]).toMatch(/^\*.+\*$/);
    expect(verdict).toMatch(/If Chase Travel shows this trip at or below/);
    expect(verdict).toContain('https://pointcompass.example/app?price=900');
    expect(verdict).toMatch(/not financial advice/);
  });

  it('reuses saved numbers for the next trip', async () => {
    const { say } = setup();
    await say('$900 to Lisbon');
    await say('Capital One 50k');
    await say('5000');
    await say('300');
    await say('2000');
    const [reply] = await say('Tokyo in March, $1,400');
    expect(reply).toMatch(/^Using your saved details\. Reply UPDATE to change them\./);
    expect(reply).toContain('price=1400');
  });

  it('checks a pasted Chase Travel price against the breakeven', async () => {
    const { say } = setup();
    await say('$1000 trip');
    await say('Chase 200k');
    await say('Sapphire Preferred', { id: 'preferred', title: 'Sapphire Preferred' });
    await say('10000');
    await say('500');
    await say('2000');
    const [reply] = await say('Chase Travel shows 55k points');
    expect(reply).toMatch(/^\*Book in Chase Travel\*/);
  });

  it('re-asks a question it could not read', async () => {
    const { say } = setup();
    await say('$900 flight');
    expect(await say('lots')).toEqual(['Sorry, I could not read that answer.', expect.stringMatching(/^Which points/)]);
  });

  it('UPDATE asks for the numbers again', async () => {
    const { say } = setup();
    await say('$900 flight');
    await say('none');
    await say('5000');
    await say('0');
    await say('2000');
    expect(await say('UPDATE')).toEqual([
      'Updating your details.',
      expect.stringMatching(/^Which points/),
    ]);
  });

  it('RESET really deletes everything stored', async () => {
    const { say, store } = setup();
    await say('$900 flight');
    await say('Chase 50k');
    const key = `wa:state:${hashPhone(PHONE, SECRET)}`;
    expect(await store.get(key)).not.toBeNull();

    expect(await say('reset')).toEqual([expect.stringMatching(/deleted everything/)]);
    expect(await store.get(key)).toBeNull();
    // The next message starts from scratch.
    expect(await say('$500 hotel')).toEqual([expect.stringMatching(/^Which points/)]);
  });

  it('never stores the phone number or the trip description', async () => {
    const { say, store } = setup();
    await say('NYC to Lisbon in May, $900');
    const dumped = JSON.stringify([...store.dump()]);
    expect(dumped).not.toContain(PHONE);
    expect(dumped).not.toContain('Lisbon');
  });

  it('answers a retried delivery only once', async () => {
    const { handler, sent } = setup();
    const message = { id: 'same', from: PHONE, type: 'text', text: { body: 'HELP' } };
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [message] } }] }] });
    for (let i = 0; i < 2; i++) {
      await handler.fetch(
        new Request('https://x/api/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': sign(body) } }),
      );
    }
    expect(sent).toHaveLength(1);
  });

  it('counts the pilot events without any personal data', async () => {
    const { say, store } = setup();
    await say('$900 flight');
    await say('none');
    await say('5000');
    await say('0');
    await say('2000');
    const counts = await store.hgetall('stats:events');
    expect(counts['whatsapp_conversation_started:whatsapp']).toBe(1);
    expect(counts['verdict_shown:whatsapp:PAY_CASH']).toBe(1);
    expect(await store.pfcount('stats:users:whatsapp')).toBe(1);
  });
});
