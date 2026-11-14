import "server-only";
import { env } from "@/lib/env";

const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

/**
 * Reuses an expensive read for a few seconds per server instance, and shares it between requests
 * arriving at once, so popular pages cost one query rather than one per visitor.
 */
export function cachedRead<T>(key: string, load: () => Promise<T>, ttlSeconds = env.READ_CACHE_SECONDS): Promise<T> {
  if (ttlSeconds <= 0) return load();
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = load().catch((err) => {
    entries.delete(key);
    throw err;
  });
  entries.set(key, { expires: now + ttlSeconds * 1000, value });
  return value;
}
