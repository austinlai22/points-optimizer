import { createHmac, timingSafeEqual } from 'node:crypto';

// Meta signs every webhook POST: X-Hub-Signature-256 is "sha256=" followed by
// the hex HMAC-SHA256 of the raw request body, keyed with the app secret.
// Anything that doesn't match is rejected before its body is even parsed.
export function isValidSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=') || !appSecret) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  // timingSafeEqual throws on unequal lengths, and a wrong-length signature
  // is simply invalid.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// A stable, non-reversible key for a phone number, so stored state and the
// unique-user count never hold the number itself.
export function hashPhone(phone: string, secret: string): string {
  return createHmac('sha256', secret).update(`phone:${phone}`).digest('hex');
}
