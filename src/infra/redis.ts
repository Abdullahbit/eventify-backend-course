// Shared node-redis client used for BOTH cache reads/writes AND the
// fixed-window rate limiter. This is deliberately a SEPARATE connection from
// the BullMQ queue connection in ./queue-backend.ts — BullMQ blocks its client
// for stream commands (e.g. XREAD) and must never share a socket with ad-hoc
// cache/limiter traffic.
//
// The client is created LAZILY: we do NOT call connect() at import time, so
// merely importing this module (e.g. from the Postgres-only integration tests,
// which have no Redis) never opens a socket or hangs. server.ts calls
// connectCache() at startup. Every cache/limiter consumer fails OPEN when the
// client is not ready or errors, so a missing/unreachable Redis never takes
// the API down.
import { createClient } from "redis";
import { env } from "../config.ts";

export function sanitizeRedisUrl(url: string | undefined): string {
  if (!url) return "redis://localhost:6379";
  const cleaned = url.trim().replace(/^['"]|['"]$/g, "");
  const match = cleaned.match(/(rediss?:\/\/[^\s]+)/);
  if (match && typeof match[1] === "string") {
    return match[1];
  }
  if (!cleaned.startsWith("redis://") && !cleaned.startsWith("rediss://")) {
    console.warn(`[redis] Invalid REDIS_URL protocol "${cleaned}". Expected rediss:// or redis://. Falling back to default.`);
    return "redis://localhost:6379";
  }
  return cleaned;
}

export const cache = createClient({ url: sanitizeRedisUrl(env.REDIS_URL) });

// True only once the connection is established. Consumers use this to decide
// whether to attempt a cache/limiter operation or short-circuit to fail-open.
export function isCacheReady(): boolean {
  return cache.isReady;
}

// Called exactly once from server.ts before the HTTP server listens. Attaches
// an error handler so a backend blip logs instead of crashing the process
// (node-redis throws on unhandled 'error' events).
export async function connectCache(): Promise<void> {
  if (cache.isReady) return;
  cache.on("error", (err) => {
    console.error("[redis-cache] connection error:", err.message);
  });
  await cache.connect();
}

export async function closeCacheConnection(): Promise<void> {
  try {
    cache.disconnect().catch(() => {});
    cache.destroy();
  } catch {
    // ignore
  }
}
