// The one place server state lives: anonymous
// event counts. An interface so tests run against memory and production runs
// against Upstash Redis (free tier, added to the Vercel project from the
// Marketplace), without either knowing which it has.
export interface Store {
  get(key: string): Promise<string | null>;
  // Returns false when nx is set and the key already existed.
  set(key: string, value: string, opts?: { ttlSeconds?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  hincrby(key: string, field: string, by: number): Promise<void>;
  hgetall(key: string): Promise<Record<string, number>>;
  // HyperLogLog: counts distinct members without storing them.
  pfadd(key: string, member: string): Promise<void>;
  pfcount(key: string): Promise<number>;
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
    async set(key, value, { ttlSeconds, nx } = {}) {
      const command: Command = ['SET', key, value];
      if (ttlSeconds) command.push('EX', ttlSeconds);
      if (nx) command.push('NX');
      return (await run<string | null>(command)) === 'OK';
    },
    async del(key) {
      await run(['DEL', key]);
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
    async pfadd(key, member) {
      await run(['PFADD', key, member]);
    },
    pfcount: (key) => run<number>(['PFCOUNT', key]),
  };
}

// Vercel's Upstash integration names its variables KV_REST_API_*; a database
// created on upstash.com directly uses UPSTASH_REDIS_REST_*. Accept either.
export function storeFromEnv(env: Record<string, string | undefined>): Store | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? createUpstashStore(url, token) : null;
}

// For tests. TTLs are recorded but never expire anything.
export function createMemoryStore(): Store & { dump(): Map<string, unknown> } {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, number>>();
  const sets = new Map<string, Set<string>>();

  return {
    async get(key) {
      return strings.get(key) ?? null;
    },
    async set(key, value, { nx } = {}) {
      if (nx && strings.has(key)) return false;
      strings.set(key, value);
      return true;
    },
    async del(key) {
      strings.delete(key);
      hashes.delete(key);
      sets.delete(key);
    },
    async hincrby(key, field, by) {
      const hash = hashes.get(key) ?? new Map<string, number>();
      hash.set(field, (hash.get(field) ?? 0) + by);
      hashes.set(key, hash);
    },
    async hgetall(key) {
      return Object.fromEntries(hashes.get(key) ?? []);
    },
    async pfadd(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async pfcount(key) {
      return sets.get(key)?.size ?? 0;
    },
    dump() {
      return new Map<string, unknown>([...strings, ...hashes, ...sets]);
    },
  };
}
