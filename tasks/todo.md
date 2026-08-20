# Session 3 — Postgres + transactional bookings

Plan (first commit of the PR). Each item is checked off as it lands.

## Goal`
Move the Session 2 in-memory Eventify API onto Postgres via Prisma 7, and make
booking creation race-safe with a single serializable transaction. Controllers
stay thin — all business logic lives in the service / transaction layer.

## Task 0 — Repository plumbing (prereq for everything)
- [ ] Add deps: `prisma` (dev), `@prisma/adapter-pg` (runtime), `tsx` + `dotenv` (dev).
- [ ] `prisma/schema.prisma`: `BookingStatus` enum, `User`, `Event`, `Booking`
      with `@@unique([userId, eventId])` and an `@@index([eventId, status])`.
- [ ] `prisma.config.ts`: `defineConfig`, schema path, seed registration,
      loads `.env` (Prisma 7 does NOT auto-load it).
- [ ] `src/config.ts`: `envSchema` (DATABASE_URL, PORT, NODE_ENV) — never read
      `process.env` directly in app code.
- [ ] `src/db.ts`: `PrismaClient` + `@prisma/adapter-pg` adapter, `log: ['query']`
      for the index proof.
- [ ] `docker-compose.yml` (postgres:17) + `.env.example` (DATABASE_URL).

## Task 1 — /events on Postgres (full CRUD, pagination + filtering)
- [ ] `src/events/repository.ts`: Prisma-backed repository (create, list with
      `?page/?limit/?venue/?from/?to`, getById, update, delete). Domain `Date`
      ⇄ `string` mapping at the boundary.
- [ ] `src/events/service.ts`: delegate to repository; keep the
      `{ data, page, limit, total }` envelope signature.
- [ ] `src/events/schema.ts`: `createEventSchema` + `updateEventSchema`.
- [ ] `src/events/controller.ts` + `routes.ts`: POST, GET /:id, PATCH, DELETE.
- [ ] No in-memory store remains; controllers unchanged in spirit (thin).

## Task 2 — Transactional bookings
- [ ] `src/bookings/create-booking.skeleton.ts`: fill the 3 `TODO(student)`
      sections — capacity check (CONFIRMED only), rebooking flip, create — plus
      `P2002` → 409 mapping, inside `prisma.$transaction` with `Serializable`
      isolation. Retry loop for `P2034` (stretch).
- [ ] Fold the finished function into `src/bookings/service.ts`; controller
      calls it with `{ userId, eventId }`.
- [ ] `getBookingById` / `cancelBooking` (soft) moved to Prisma.
- [ ] Proof: `docker compose up -d` → `migrate dev` → `db seed` → `dev` →
      `node scripts/parallel-bookings.ts`; tally = 5×201, 15×409, never >5.

## Task 3 — Seed script
- [ ] `prisma/seed.ts`: idempotent `upsert` — 3+ users (one ORGANIZER, one
      ADMIN), 5 events, some bookings, **plus** 20 distinct users and one
      capacity-5 event (ids match `scripts/fixtures/parallel-users.json`).

## Task 2 proof — concurrency script
- [ ] `scripts/parallel-bookings.ts`: 20 concurrent POSTs as 20 users, status
      tally, exit non-zero on oversell.
- [ ] `scripts/fixtures/parallel-users.json`: baseUrl, eventId, capacity, 20 users.

## Task 4 — Prove an index
- [ ] Enable `log: ['query']` (done in db.ts).
- [ ] `EXPLAIN ANALYZE` the per-event capacity-count query before/after adding
      `@@index([eventId, status])`; capture both plans; write 2 sentences of my
      own interpretation in the PR body.

## Deliverables
- [ ] `README.md` updated with fresh-clone run steps.
- [ ] `PR_BODY.md`: run instructions, task-4 before/after plans + 2 sentences,
      exit-ticket answer (1 sentence).

## Verification gate
- [ ] `npm run typecheck` and `npm run lint` pass.
- [ ] Fresh clone: `docker compose up -d` → `npx prisma migrate dev` →
      `npx prisma db seed` → `npm run dev` → `node scripts/parallel-bookings.ts`.

---

# Session 4 — Auth, Authorization, BOLA & Refresh-Token Rotation

Plan (this assignment). Each item is checked off as it lands.

## Goal
Add authentication (access JWT + opaque refresh tokens), role-based
authorization, object-level (BOLA) ownership checks, and refresh-token
rotation with reuse detection to the Postgres Eventify API.

## Task 1 — Setup
- [x] `prisma/schema.prisma`: paste `RefreshToken` model from the Session 4
      starter and add the `refreshTokens RefreshToken[]` back-relation on `User`.
- [x] `prisma/migrations/<ts>_add-refresh-token/migration.sql`: the 1 table +
      3 indexes + 2 FKs DDL (matches the starter migration.sql).
- [x] `npm run prisma:generate` so the generated client exposes `refreshToken`.
- [x] `src/config.ts`: extend `envSchema` with `JWT_ACCESS_SECRET` +
      `WEB_ORIGIN`; export `config` (never read `process.env` directly).
- [x] `.env.example`: document `JWT_ACCESS_SECRET` + `WEB_ORIGIN`.
- [x] `package.json`: add `jsonwebtoken` (+ `@types/jsonwebtoken`) and
      `supertest` (+ `@types/supertest`) deps; wire a `test` script.

## Task 2 — Auth core (`src/auth/`)
- [x] `tokens.ts`: HS256-pinned sign/verify, Zod-validated claims (no casts),
      `sha256` hashing, opaque `randomBytes(32)` refresh token generation.
- [x] `types.ts`: `AuthUser`/`AccessTokenClaims` + Express `Request.user`
      augmentation.
- [x] `schema.ts`: `loginSchema` (email + password), re-export claims schema.
- [x] `service.ts`: `login()` issues access JWT (15m) + refresh token (7d,
      sha256 stored, cookie set). `rotateRefresh()` does atomic rotation +
      reuse detection + STRETCH family revocation.
- [x] `controller.ts`: `loginHandler`, `refreshHandler` (httpOnly/Secure/
      SameSite=strict cookie scoped to `/v1/auth/refresh`).
- [x] `routes.ts`: `POST /v1/auth/login`, `POST /v1/auth/refresh`.
- [x] `middleware.ts`: `requireAuth`, `requireRole` (modern Express 5 idioms —
      throw `HttpError`, no `next(err)` wrappers).

## Task 3 — Route protection + BOLA
- [x] `POST /v1/events`: `requireAuth + (ORGANIZER|ADMIN)`; ATTENDEE → 403.
- [x] `POST /v1/bookings`: `requireAuth` (any authenticated user); userId from
      JWT, not body.
- [x] `GET /v1/events`: stays public.
- [x] `PATCH/DELETE /v1/events/:id`: `event.organizerId === token.sub`, ADMIN
      bypass; mismatch → 403.
- [x] `DELETE /v1/bookings/:id`: `booking.userId === token.sub`, ADMIN bypass;
      mismatch → 403.
- [x] Wire `/v1/auth` router into `src/server.ts`.

## Task 4 — Verification
- [x] `src/auth/auth.test.ts` (Supertest): public access, 401 unauthenticated,
      403 BOLA between two seeded organizers, successful token rotation.
- [x] `npm run typecheck` and `npm run lint` pass.
