/**
 * An in-memory token bucket per key. Each server instance keeps its own, so across many instances
 * this is approximate, which is the point: it costs no database call, so it can sit in front of every
 * dynamic request and absorb floods cheaply. Exact, shared limits are in src/server/services/limits.ts.
 */
export function createThrottle({
  capacity,
  refillPerSecond,
  maxKeys = 10_000,
}: {
  capacity: number;
  refillPerSecond: number;
  maxKeys?: number;
}) {
  const buckets = new Map<string, { tokens: number; updatedAt: number }>();

  return function take(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const bucket = buckets.get(key);
    const elapsed = bucket ? Math.max(0, now - bucket.updatedAt) / 1000 : 0;
    const tokens = Math.min(capacity, (bucket?.tokens ?? capacity) + elapsed * refillPerSecond);

    // Re-inserting keeps the Map in least-recently-used order, so the oldest key is first.
    buckets.delete(key);
    if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);

    if (tokens < 1) {
      buckets.set(key, { tokens, updatedAt: now });
      return { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / refillPerSecond) };
    }
    buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
