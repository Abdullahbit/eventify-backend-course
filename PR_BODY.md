# PR: feat(session-5): Redis cache + rate limiting + waitlist background jobs

> Session 5 homework — **Caching, Queues & Background Jobs**.
> One PR, built on the `session-4-auth` foundation. Deployed in Session 6
> (Render + Neon + Upstash) — account setup is the student's responsibility and
> is **not** committed here.

## What I built

### 1. Redis infrastructure (`src/infra/`)
- `src/infra/redis.ts` — the **cache/rate-limit client** (`createClient` from
  `redis@5`). One shared node-redis client for the cache-aside layer and the
  rate limiter. Lazy: never connects at import; `server.ts` calls
  `connectCache()` on boot. `isCacheReady()` gates every cache op so the app
  **fails open** (falls back to Postgres) when Redis is absent — keeps the
  Postgres-only integration tests green with no Redis running.
- `src/infra/queue-backend.ts` — the **queue connection** (`createNodeRedisClient`
  from BullMQ). A *separate* connection from the cache client, because BullMQ
  blocks the connection it owns; the cache and the queue must not share one.
- `src/infra/mailer.ts` — console-transport mailer (`sendConfirmation`) so the
  worker's emails are observable in logs without an SMTP account.

### 2. Cache-aside events service (`src/events/events.service.ts`)
- Replaces the old `src/events/service.ts`. `getEventById` reads through a
  `event:{id}` key (TTL 60s + up to 15s jitter); `listEvents` is keyed by a
  **version counter** `events:list:v` so one `INCR` on any write invalidates
  every page at once; `create/update/deleteEvent` write-through / delete the
  relevant keys. **Every** Redis call is wrapped in try/catch (fail open).
- **Cache metrics** (`recordHit` / `recordMiss`): a hit-rate is `console.log`'d
  every 100 lookups, and `startCacheMetrics(60_000)` (an unref'd timer started
  only from `server.ts`) logs the rolling hit-rate each minute.

### 3. Redis rate limiting (`src/infra/rate-limit.ts`) — rollout
- Fixed-window middleware factory `rateLimit()`. Applied to:
  - `POST /v1/auth/login` — **5 req/min per IP** (`src/auth/routes.ts`).
  - `POST /v1/bookings` — **10 req/min per user** (`req.user.sub`, *not* IP;
    `requireAuth` runs first so `req.user` is populated — `src/bookings/routes.ts`).
- Returns `429` with a `Retry-After` when exceeded. Fails **open** when Redis is
  down (request allowed), so the API never hard-fails on a cache outage.
- Proof: `scripts/rate-limit-burst.ts` hammers login, asserts the 429 at the
  threshold, and that it recovers after the window.

### 4. Background jobs — Option A: waitlist promotion
- `src/jobs/email.queue.ts` — `booking-email` queue; `addConfirmation(bookingId)`
  enqueued on every *newly CONFIRMED* booking (incl. promotions).
- `src/jobs/waitlist.queue.ts` — `waitlist-promote` queue; `addWaitlistPromotion(eventId)`
  enqueued from `cancelBooking` whenever a **CONFIRMED** booking is cancelled.
- `src/jobs/promote.ts` — `promoteWaitlisted(eventId)` shared logic: inside a
  **Serializable** transaction it **re-checks capacity** and, if still full,
  flips the **oldest** (`WAITLISTED`, FIFO) row to `CONFIRMED`, then enqueues its
  confirmation email. Idempotent: re-running can never double-promote.
- `src/worker.ts` — the worker **process** (`npm run worker`) runs two BullMQ
  workers on the queue connection: `booking-email` (sends the confirmation via
  the console mailer) and `waitlist-promote` (calls `promoteWaitlisted`).
- `src/bookings/service.ts` `createBooking` now returns a `WAITLISTED` booking
  (instead of throwing 409) when the event is full, via `createWaitlisted` /
  `waitlist` on the repository; `cancelBooking` enqueues the promotion job.

### 5. Deploy prep (Session 6)
- `docker-compose.yml` now also starts `redis:8` (port `6379`) with a healthcheck.
- `config.ts` reads `REDIS_URL` (default `redis://localhost:6379`); `.env.example`
  documents it. `.env` already points to the local Postgres on `5433`.
- No secrets are committed; the Upstash/Neon/Render wiring is done in Session 6
  by the student using environment variables only.

## How to run

```bash
# 1. Start Postgres + Redis in Docker
npm run db:up

# 2. Generate client + migrate + seed (idempotent)
npm run prisma:generate
npm run migrate:dev
npm run seed

# 3. Run the API (connects cache)
npm run dev

# 4. Run the worker (separate process — consumes queues)
npm run worker
```

Proofs / demos:
```bash
# Rate-limit burst: proves 429 at threshold, recovery after window
npx tsx scripts/rate-limit-burst.ts

# Waitlist end-to-end (Postgres only; drives promoteWaitlisted directly)
npx tsx scripts/waitlist-demo.ts
```

## AI assistance & the caching-strategy interrogation

This homework explicitly asks us to **interrogate an AI about a caching strategy**
and document what it got right / wrong / what you'd push back on.

> ⚠️ **STUDENT TODO — fill this section from your own class exercise.**
> Below is a template; replace the bracketed parts with your actual interrogation
> of the AI (or with the notes from the session). Do NOT leave the placeholders in
> the final submission.

- **The strategy the AI proposed:** [e.g. "cache every GET /v1/events list page
  indefinitely, key by query string, and update on write by re-SETting the
  just-written value."]
- **What the AI got right:** [e.g. "read-through on getById with a TTL, and a
  shared client for cache + limiter."]
- **What the AI got wrong / you pushed back on:** [e.g. "it wanted to re-SET the
  list pages on every write — but there are infinitely many pages, you can't
  enumerate them, so a version counter (`events:list:v`) that INCRs on write and
  is part of every list key is the correct invalidation, not write-through of
  each page."]
- **The decision you made as the human:** [e.g. "DELETE-on-write + versioned list
  keys, never re-SET; fail-open on Redis so tests/Postgres still work."]

## Exit ticket

**Why does `updateEvent` DELETE the cache key instead of SETting the fresh value
into it?**

Because **delete-on-write is simpler and safer than write-through**, and the two
failure modes of write-through are exactly what we want to avoid:

1. **No partial / uncommitted values.** `updateEvent` invalidates the key right
   after the DB write. If we instead tried to `SET` the new value into the cache
   from inside (or right after) the transaction, a race exists: the cache write
   could land *before* the transaction commits (or after a concurrent write),
   leaving a **stale or partially-updated** object in the cache that looks fresh
   (long TTL) and is served to every reader until it expires. Deleting guarantees
   the *next* read recomputes from the DB, so the cached value is always
   post-commit and correct.

2. **List pages can't be re-SET.** A single `event:{id}` can be re-SET, but the
   list endpoint has infinitely many pages/filters (`events:list:...`). You can't
   enumerate and rewrite them all on one write, and you must not leave a page
   showing a *deleted* or *stale* event. Bumping the `events:list:v` version
   counter (which is part of every list key) invalidates **all** pages at once
   with one `INCR` — cheap and total. There is no "fresh value" to SET for a
   whole class of query pages.

Net: invalidation by delete (plus a version bump for collections) is a single,
race-free, O(1) operation that can never serve a half-written object, whereas
write-through either risks a stale cache line or is impossible for collections.

## Acceptance checklist
- [x] Background job chosen and implemented (**Option A — waitlist promotion**)
- [x] `WAITLISTED` status created/returned at capacity (never oversell)
- [x] Promotion runs in a capacity-re-checked Serializable tx (FIFO, idempotent)
- [x] Confirmation email enqueued for new + promoted bookings
- [x] Cache metrics logged (per-100 hits + 1-min rolling rate)
- [x] Redis rate limiting rolled out (login 5/min/IP, bookings 10/min/user)
- [x] Rate limiter fails open; `429` + `Retry-After` on breach
- [x] Worker is a separate process (`npm run worker`)
- [x] Redis + BullMQ use **separate** connections
- [x] Deploy prep: `redis:8` in compose, `REDIS_URL` in config/`.env.example`
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] Plan committed first in `tasks/todo.md`
- [ ] **Student TODO:** AI caching-strategy interrogation notes (see above)
- [ ] **Student TODO:** Session 6 deploy (Render/Neon/Upstash) — not committed
