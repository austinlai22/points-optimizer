// The one place server state lives: anonymous usage counts and opt-in price
// reports. An interface so tests run against memory and production runs
// against Upstash Redis (free tier, added to the Vercel project from the
// Marketplace), without either knowing which it has.
export interface Store {
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
  // Returns false when nx is set and the key already existed.
  set(key: string, value: string, opts?: { ttlSeconds?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  // Increments and returns the new value; the TTL is set when the key is new.
  incr(key: string, ttlSeconds: number): Promise<number>;
  hincrby(key: string, field: string, by: number): Promise<void>;
  hgetall(key: string): Promise<Record<string, number>>;
  sadd(key: string, member: string): Promise<void>;
  scard(key: string): Promise<number>;
  // HyperLogLog: counts distinct members without storing them. Several keys
  // count the distinct members across all of them.
  pfadd(key: string, member: string): Promise<void>;
  pfcount(...keys: string[]): Promise<number>;
  // Every key matching a pattern like "report:*".
  keys(pattern: string): Promise<string[]>;
}

type Command = (string | number)[];

// Upstash's REST API: POST a Redis command as a JSON array. Plain fetch, so
// there's no client library to bundle.
export function createUpstashStore(url: string, token: string): Store {
  async function run<T>(command: Command): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    const body = (await response.json()) as { result?: T; error?: string };
    if (!response.ok || body.error) {
      throw new Error(`Redis ${command[0]} failed: ${body.error ?? response.status}`);
    }
    return body.result as T;
  }

  return {
    get: (key) => run<string | null>(['GET', key]),
    mget: (keys) => (keys.length ? run<(string | null)[]>(['MGET', ...keys]) : Promise.resolve([])),
    async set(key, value, { ttlSeconds, nx } = {}) {
      const command: Command = ['SET', key, value];
      if (ttlSeconds) command.push('EX', ttlSeconds);
      if (nx) command.push('NX');
      return (await run<string | null>(command)) === 'OK';
    },
    async del(key) {
      await run(['DEL', key]);
    },
    async expire(key, ttlSeconds) {
      await run(['EXPIRE', key, ttlSeconds]);
    },
    async incr(key, ttlSeconds) {
      const value = await run<number>(['INCR', key]);
      if (value === 1) await run(['EXPIRE', key, ttlSeconds]);
      return value;
    },
    async hincrby(key, field, by) {
      await run(['HINCRBY', key, field, by]);
    },
    async hgetall(key) {
      // Redis returns a flat [field, value, field, value, ...] list.
      const flat = (await run<string[] | null>(['HGETALL', key])) ?? [];
      const out: Record<string, number> = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]);
      return out;
    },
    async sadd(key, member) {
      await run(['SADD', key, member]);
    },
    scard: (key) => run<number>(['SCARD', key]),
    async pfadd(key, member) {
      await run(['PFADD', key, member]);
    },
    pfcount: (...keys) => run<number>(['PFCOUNT', ...keys]),
    async keys(pattern) {
      // SCAN rather than KEYS, so a large database is walked in pages.
      const found: string[] = [];
      let cursor = '0';
      do {
        const [next, batch] = await run<[string, string[]]>(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 500]);
        found.push(...batch);
        cursor = next;
      } while (cursor !== '0');
      return found;
    },
  };
}

// Vercel's Upstash integration names its variables KV_REST_API_*; a database
// created on upstash.com directly uses UPSTASH_REDIS_REST_*. Accept either.
export function storeFromEnv(env: Record<string, string | undefined>): Store | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? createUpstashStore(url, token) : null;
}

// For tests. TTLs are recorded, so tests can check them, but never expire.
export function createMemoryStore(): Store & { dump(): Map<string, unknown>; ttl(key: string): number | undefined } {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, number>>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();
  const glob = (pattern: string) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

  return {
    async get(key) {
      return strings.get(key) ?? null;
    },
    async mget(keys) {
      return keys.map((k) => strings.get(k) ?? null);
    },
    async set(key, value, { ttlSeconds, nx } = {}) {
      if (nx && strings.has(key)) return false;
      strings.set(key, value);
      if (ttlSeconds) ttls.set(key, ttlSeconds);
      return true;
    },
    async del(key) {
      strings.delete(key);
      hashes.delete(key);
      sets.delete(key);
      ttls.delete(key);
    },
    async expire(key, ttlSeconds) {
      ttls.set(key, ttlSeconds);
    },
    async incr(key, ttlSeconds) {
      const value = Number(strings.get(key) ?? 0) + 1;
      strings.set(key, String(value));
      if (value === 1) ttls.set(key, ttlSeconds);
      return value;
    },
    async hincrby(key, field, by) {
      const hash = hashes.get(key) ?? new Map<string, number>();
      hash.set(field, (hash.get(field) ?? 0) + by);
      hashes.set(key, hash);
    },
    async hgetall(key) {
      return Object.fromEntries(hashes.get(key) ?? []);
    },
    async sadd(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async scard(key) {
      return sets.get(key)?.size ?? 0;
    },
    async pfadd(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async pfcount(...keys) {
      const union = new Set<string>();
      for (const key of keys) for (const m of sets.get(key) ?? []) union.add(m);
      return union.size;
    },
    async keys(pattern) {
      const re = glob(pattern);
      return [...strings.keys(), ...hashes.keys(), ...sets.keys()].filter((k) => re.test(k));
    },
    dump() {
      return new Map<string, unknown>([...strings, ...hashes, ...sets]);
    },
    ttl(key) {
      return ttls.get(key);
    },
  };
}
