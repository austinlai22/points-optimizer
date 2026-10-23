import { createHmac } from 'node:crypto';
import type { Store } from './store';

// Per-sender rate limiting that never stores an IP address. The address is
// turned into a one-way key, salted with a secret and the date so the same
// address gives a different key each day, and the key expires after the
// window. Nothing in it can be turned back into the address.

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function rateLimitKey(scope: string, address: string, secret: string, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  const digest = createHmac('sha256', secret).update(`${day}|${address}`).digest('hex').slice(0, 32);
  return `rl:${scope}:${digest}`;
}

// True when this sender is still within `limit` requests per window.
export async function allow(
  store: Store,
  scope: string,
  request: Request,
  { limit, windowSeconds, secret, now = new Date() }: { limit: number; windowSeconds: number; secret: string; now?: Date },
): Promise<boolean> {
  const count = await store.incr(rateLimitKey(scope, clientAddress(request), secret, now), windowSeconds);
  return count <= limit;
}
