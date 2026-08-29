# Eventify

The event booking API you build across this course. This template ships the
project skeleton - strict TypeScript config, ESLint, editor settings - so
Session 1 starts at the interesting part: writing the server.

## Prerequisites

Check these off before Session 1 (they match the course pre-work email):

- [ ] **Node 24 LTS** - check with `node --version` (must print `v24.x`).
      Node 20 is EOL and Node 22 will not run this course's TypeScript setup.
- [ ] **npm 11** - ships with Node 24; check with `npm --version`.
- [ ] **Git** installed and a **GitHub account** you can push to.
- [ ] **VS Code** with the **GitHub Copilot** extension (free tier is fine).
      Students: start GitHub Education verification now - Copilot Pro is free
      for verified students, but approval takes days.

## Setup

```bash
# 1. Create YOUR repo from this template on GitHub ("Use this template"),
#    name it eventify, then clone it:
git clone https://github.com/<your-username>/eventify.git
cd eventify

# 2. Install dev tooling (TypeScript, ESLint):
npm install

# 3. Create your local env file (never committed):
cp .env.example .env
```

There is no server yet - you write `src/server.ts` in Session 1's project
block. Once it exists, the scripts below are your daily loop.

## Scripts

**`npm run dev`** - runs `node --watch --env-file=.env src/server.ts`.
Node 24 runs TypeScript directly by stripping types and restarts on save - no
nodemon, no tsx, no build step.

**`npm run typecheck`** - runs `tsc --noEmit`.
Node strips types without checking them, so a green `dev` proves nothing -
this is the real gate; run it before every commit.

**`npm run lint`** - runs ESLint (flat config, typescript-eslint) over the
project. Preconfigured from day one; CI starts enforcing it in Session 6.

## Session 3 — Postgres, transactions & concurrency

Session 3 swaps the in-memory stores for **PostgreSQL** via **Prisma 7** and
adds a race-safe, transactional booking flow. Everything runs locally against
a Docker Postgres.

### 1. Start Postgres (Docker)

```bash
npm run db:up          # docker compose up -d  (postgres:17, db=eventify, port 5432)
```

The connection string lives in `.env` (`DATABASE_URL=postgresql://eventify:eventify@localhost:5432/eventify?schema=public`).

### 2. Generate the Prisma client & create the schema

```bash
npm run prisma:generate   # prisma generate  (writes src/generated/prisma)
npm run migrate:dev       # prisma migrate dev  (creates the migration + applies it)
```

> Prisma 7 does NOT auto-load `.env`; `prisma.config.ts` imports `dotenv/config`
> explicitly so `DATABASE_URL` is available to the CLI.

### 3. Seed the database (idempotent)

```bash
npm run seed             # tsx prisma/seed.ts
```

Creates 3 base users + 20 parallel-test users, 5 events (one with capacity 5
for the concurrency test), and a couple of sample bookings. Safe to re-run
(`upsert` everywhere).

### 4. Run the API

```bash
npm run dev              # node --watch --env-file=.env src/server.ts  (port 3000)
```

Endpoints (all under `/v1`):
- `GET    /v1/events?page=&limit=&venue=&from=&to=` — paginated, filtered (Postgres).
- `POST   /v1/events` — create event (body: `title, description, venue?, startsAt, capacity, priceCents?, organizerId`).
- `GET/PUT/DELETE /v1/events/:id`.
- `POST   /v1/bookings` — create booking (body: `userId, eventId`).
- `GET/DELETE /v1/bookings/:id` — fetch / cancel (cancel flips status to `CANCELLED`).

### 5. Concurrency proof

After seeding, run the parallel script which fires **20 simultaneous** `POST /v1/bookings`
for the capacity-5 event as 20 distinct users:

```bash
node scripts/parallel-bookings.ts
```

It prints a status tally and exits non-zero only on **oversell** (more than
`capacity` `201`s). With the Serializable transaction + unique `(userId, eventId)`
constraint, you should see exactly **5× `201`** and 15× `409` (capacity), never
more than 5 confirmed.

## Homework is submitted as a Pull Request

Every session's homework lands as **one PR** to your own `eventify` repo:

1. Branch from `main` (e.g. `session-1`), commit in logical steps.
2. Open a PR whose description covers: what you built, how to run it, and
   which parts were AI-assisted plus how you verified them. A classmate
   should be able to run your server from the description alone.
3. Merge only when `npm run typecheck` and `npm run lint` pass.

**The ownership rule:** AI writes with you, but you own every line you ship.
At the start of each session one function from someone's PR is picked at
random and its author walks the class through it, line by line. Any function
in your PR can be that function.
