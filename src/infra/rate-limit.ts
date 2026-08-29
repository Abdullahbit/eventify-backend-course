// Fixed-window rate limiter backed by the shared cache Redis client.
//
// Key shape (from the Session 5 contract): rl:{ip}:{path}:{win}
//   - `win` is the fixed window (e.g. the current minute), so the counter
//     resets at each window boundary.
//   - `ip` for strict per-IP limits (login); for per-user limits we pass the
//     authenticated `req.user.sub` instead of the IP.
//
// FAIL-OPEN: if Redis is unreachable (or the cache client isn't ready), the
// limiter logs a warning and lets the request through rather than throwing.
// Availability over strictness during a cache outage — the API stays up, and
// the integration tests (Postgres-only, no Redis) are unaffected.
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../http/HttpError.ts";
import { cache, isCacheReady } from "./redis.ts";

export interface RateLimitOptions {
  // Max requests allowed within `windowMs`.
  max: number;
  // Window length in milliseconds.
  windowMs: number;
  // Stable identity for the limit (e.g. req.ip, or the authenticated user id).
  keyOf: (req: Request) => string;
  // Human-readable route label, used in the cache key + logs.
  label: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { max, windowMs, keyOf, label } = options;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // No Redis -> fail open (see header comment).
    if (!isCacheReady()) {
      return next();
    }

    const identity = keyOf(req);
    if (!identity) {
      // Shouldn't happen (middleware order guarantees auth before per-user
      // limits), but fail open rather than 500.
      return next();
    }

    const window = Math.floor(Date.now() / windowMs);
    const key = `rl:${identity}:${label}:${window}`;

    try {
      const count = await cache.incr(key);
      // Set the expiry only on the first hit so the window slides on a fixed
      // boundary rather than being continuously extended.
      if (count === 1) {
        await cache.expire(key, windowSec, "NX");
      }

      if (count > max) {
        const retryAfter = windowSec - (Math.floor(Date.now() / 1000) % windowSec);
        next(
          new HttpError(429, "Too many requests, please slow down", {
            retryAfterSec: Math.max(retryAfter, 1),
          }),
        );
        return;
      }

      next();
    } catch (err) {
      // Redis blip -> fail open, don't take the endpoint down.
      console.error("[rate-limit] redis error, allowing request:", (err as Error).message);
      next();
    }
  };
}
