import { HttpError } from "../http/HttpError.ts";
import { cache, isCacheReady } from "../infra/redis.ts";
import type { Role } from "../domain.ts";
import * as eventRepo from "./repository.ts";
import type { EventCreateInput, EventUpdateInput } from "./repository.ts";

// ---------------------------------------------------------------------------
// Cache-aside read/write for events.
//
// Two key families, matching the Session 5 contract:
//   event:{id}            -> single event, TTL 60s + jitter
//   events:list:{v}:{q}   -> a paginated/filtered list page, keyed by a list
//                            version `v` plus a hash `q` of the query params
//   events:list:v         -> version counter; ONE incr on any write invalidates
//                            every previously-cached list page (they fall out
//                            of the keyspace as the version advances)
//
// Every cache access fails OPEN: a missing/unreachable Redis (e.g. the
// Postgres-only integration tests) degrades to a direct DB read instead of
// erroring. We never cache a 404, and writes INVALIDATE (delete + bump version)
// rather than rewrite — see the exit-ticket answer in PR_BODY.md.
// ---------------------------------------------------------------------------

const EVENT_KEY_PREFIX = "event:";
const LIST_KEY_PREFIX = "events:list:";
const LIST_VERSION_KEY = "events:list:v";

// Cache metrics (homework task #2). Module-level counters incremented on every
// read-path call; logged as structured JSON every 100 lookups AND every 60s
// (the latter started explicitly from server.ts so the test process, which
// only imports app, never spins up the timer).
let hits = 0;
let misses = 0;

function logMetrics(): void {
  const total = hits + misses;
  const ratio = total === 0 ? 0 : hits / total;
  console.log(
    JSON.stringify({
      cache: "events",
      hits,
      misses,
      ratio: Number(ratio.toFixed(3)),
    }),
  );
}

function recordHit(): void {
  hits++;
  if ((hits + misses) % 100 === 0) logMetrics();
}

function recordMiss(): void {
  misses++;
  if ((hits + misses) % 100 === 0) logMetrics();
}

// Started from server.ts only — keeps the integration tests (import app, not
// server) from hanging on a live timer.
export function startCacheMetrics(intervalMs = 60_000): void {
  const timer = setInterval(() => logMetrics(), intervalMs);
  // Don't let the metrics timer keep a process (or the test runner) alive.
  timer.unref?.();
}

// --- Cache stampede protection (homework stretch goal #8) -----------------
// When a hot key expires, many concurrent requests can all miss and stampede
// the database. We coalesce concurrent misses for the same cache key into a
// single in-flight fetch: the first request runs the DB query; every other
// concurrent request for that key awaits the SAME promise. N concurrent misses
// therefore produce exactly ONE database hit. The map entry is removed once the
// promise settles (resolve or reject), so there is no leak and the next wave
// re-fetches from the DB.
const inflight = new Map<string, Promise<unknown>>();

function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn();
  inflight.set(key, p);
  p.then(
    () => inflight.delete(key),
    () => inflight.delete(key),
  );
  return p;
}

function eventKey(id: string): string {
  return `${EVENT_KEY_PREFIX}${id}`;
}

// Deterministic signature of the list query so distinct pages/filters map to
// distinct cache keys (and identical requests share a key).
// Latest list version (from the counter). Falls back to "0" when Redis is
// unavailable so the cache read still fails open to the DB.
let listVersion = "0";

function listKey(query: {
  page?: number;
  limit?: number;
  venue?: string;
  from?: string;
  to?: string;
}): string {
  const { page = 1, limit = 20, venue, from, to } = query;
  const q = [
    `p${page}`,
    `l${limit}`,
    `v${venue ?? ""}`,
    `f${from ?? ""}`,
    `t${to ?? ""}`,
  ].join(":");
  return `${LIST_KEY_PREFIX}${listVersion}:${q}`;
}

async function refreshListVersion(): Promise<void> {
  try {
    if (isCacheReady()) {
      listVersion = (await cache.get(LIST_VERSION_KEY)) ?? "0";
    }
  } catch {
    // ignore — fail open
  }
}

// One INCR on any write invalidates every cached list page.
async function bumpListVersion(): Promise<void> {
  try {
    if (isCacheReady()) {
      await cache.incr(LIST_VERSION_KEY);
    }
  } catch {
    // ignore — invalidation is best-effort when the cache is down
  }
}

function listCacheTtl(): number {
  // 60s base + up to 15s jitter to avoid a thundering-herd expiry.
  return 60 + Math.floor(Math.random() * 15);
}

export async function createEvent(input: EventCreateInput) {
  const event = await eventRepo.create(input);
  await bumpListVersion();
  return event;
}

export async function listEvents(query: {
  page?: number;
  limit?: number;
  venue?: string;
  from?: string;
  to?: string;
}): Promise<{ data: unknown[]; page: number; limit: number; total: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  await refreshListVersion();
  const key = listKey(query);

  // Read path: cache-aside.
  try {
    if (isCacheReady()) {
      const cached = await cache.get(key);
      if (cached) {
        recordHit();
        return JSON.parse(cached) as {
          data: unknown[];
          page: number;
          limit: number;
          total: number;
        };
      }
    }
  } catch {
    // fall through to DB on any cache error
  }
  recordMiss();

  // Cache stampede protection (#8): concurrent misses for the same list key
  // coalesce into ONE database fetch instead of N.
  return coalesce(key, async () => {
    const { data, total } = await eventRepo.list(page, limit, {
      venue: query.venue,
      from: query.from,
      to: query.to,
    });

    try {
      if (isCacheReady()) {
        await cache.set(
          key,
          JSON.stringify({ data, page, limit, total }),
          { EX: listCacheTtl() },
        );
      }
    } catch {
      // best-effort write — a miss on next read just re-fetches
    }

    return { data, page, limit, total };
  });
}

export async function getEventById(id: string) {
  const key = eventKey(id);

  // Read path: cache-aside.
  try {
    if (isCacheReady()) {
      const cached = await cache.get(key);
      if (cached) {
        recordHit();
        return JSON.parse(cached);
      }
    }
  } catch {
    // fall through to DB on any cache error
  }
  recordMiss();

  // Cache stampede protection (#8): concurrent misses for the same event:{id}
  // coalesce into ONE database fetch instead of N.
  return coalesce(key, async () => {
    const event = await eventRepo.getById(id);
    if (!event) {
      throw new HttpError(404, "Event not found");
    }

    try {
      if (isCacheReady()) {
        await cache.set(key, JSON.stringify(event), { EX: listCacheTtl() });
      }
    } catch {
      // best-effort
    }

    return event;
  });
}

export async function updateEvent(
  id: string,
  input: EventUpdateInput,
  actor: { sub: string; role: Role },
) {
  const event = await getEventById(id);
  assertCanModify(event, actor);

  // Delete-on-write: invalidate the single-event cache entry. The list version
  // is bumped so every cached list page is also invalidated.
  await invalidateEvent(id);
  return eventRepo.update(id, input);
}

export async function deleteEvent(
  id: string,
  actor: { sub: string; role: Role },
) {
  const event = await getEventById(id);
  assertCanModify(event, actor);

  await invalidateEvent(id);
  return eventRepo.remove(id);
}

// Invalidate a single event's cache entry and bump the list version.
async function invalidateEvent(id: string): Promise<void> {
  try {
    if (isCacheReady()) {
      await cache.del(eventKey(id));
      await cache.incr(LIST_VERSION_KEY);
    }
  } catch {
    // best-effort
  }
}

// BOLA guard: only the organizer who owns the event (or an ADMIN) may modify
// or delete it. Anyone else gets a generic 403.
function assertCanModify(
  event: { id: string; organizerId: string },
  actor: { sub: string; role: Role },
): void {
  if (actor.role !== "ADMIN" && event.organizerId !== actor.sub) {
    throw new HttpError(403, "You do not have permission to modify this event");
  }
}
