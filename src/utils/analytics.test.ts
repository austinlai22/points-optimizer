import { describe, expect, it } from 'vitest';
import { visitSource } from './analytics';

const HOST = 'pointcompass.vercel.app';

describe('where a visit came from', () => {
  it("uses a link's utm_source tag first, cleaned to one word", () => {
    expect(visitSource('?utm_source=Reddit&utm_campaign=x', 'https://www.google.com/', HOST)).toBe('reddit');
    expect(visitSource('?utm_source=QR code!', '', HOST)).toBe('qrcode');
  });

  it('otherwise names the kind of site, never the page', () => {
    expect(visitSource('', '', HOST)).toBe('direct');
    expect(visitSource('', `https://${HOST}/trips`, HOST)).toBe('direct');
    expect(visitSource('', 'https://www.google.co.uk/', HOST)).toBe('search');
    expect(visitSource('', 'https://duckduckgo.com/', HOST)).toBe('search');
    expect(visitSource('', 'https://old.reddit.com/r/churning/comments/abc', HOST)).toBe('reddit');
    expect(visitSource('', 'https://t.co/xyz', HOST)).toBe('x');
    expect(visitSource('', 'https://www.linkedin.com/feed/', HOST)).toBe('linkedin');
    expect(visitSource('', 'https://claude.ai/chat/123', HOST)).toBe('ai');
    expect(visitSource('', 'https://gemini.google.com/app', HOST)).toBe('ai');
    expect(visitSource('', 'https://someblog.example/post', HOST)).toBe('other');
    expect(visitSource('', 'not a url', HOST)).toBe('direct');
  });
});
