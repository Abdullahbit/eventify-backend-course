-- =============================================================================
-- Session 3 — SQL sandbox seed
--
-- Creates and seeds the `sandbox` database used in the hands-on SQL, indexes
-- and EXPLAIN blocks: snake_case tables, ~2,000 users, ~200 events, ~10k+
-- bookings. This is a SEPARATE database from `eventify` (where Prisma
-- migrates its own quoted "User"/"Event"/"Booking" tables) — same Postgres
-- instance, two databases. Say that out loud in class.
--
-- How it runs: mounted into /docker-entrypoint-initdb.d/ by the Session 3
-- docker-compose file, so it executes automatically the FIRST time the
-- postgres volume is initialized. To re-seed from scratch:
--   docker compose down -v && docker compose up -d
--
-- Manual run (must be psql — the file uses the \connect meta-command):
--   docker compose exec postgres psql -U eventify -d eventify \
--     -f /docker-entrypoint-initdb.d/10-sandbox-seed.sql
--   (drop the sandbox database first if it exists: DROP DATABASE sandbox;)
--
-- Deliberate teaching choices baked into the data — do not "fix" them:
--   * ~20 events have zero bookings          -> motivates LEFT JOIN vs INNER
--   * two events are genuinely oversold      -> the GROUP BY/HAVING demo returns rows
--   * one event is titled exactly 'TS Conf'  -> the two-terminal transaction demo
--   * NO index on bookings.user_id           -> the Seq Scan -> Index Scan flip
--     is created live in class; the UNIQUE constraint is ordered
--     (event_id, user_id) so its index cannot serve a user_id lookup
--     (leading-column rule — mention it when someone asks)
--   * timestamps are realistic-ish, not causally perfect; it is a sandbox
-- =============================================================================

CREATE DATABASE sandbox;

\connect sandbox;

-- Reproducible randomness: everyone's sandbox looks (roughly) the same.
SELECT setseed(0.2026);

-- -----------------------------------------------------------------------------
-- Schema — mirrors the Eventify domain model in snake_case.
-- Constraints are business rules the database enforces even against buggy code.
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- PG 18: native, time-sortable
  email         text NOT NULL UNIQUE,               -- UNIQUE => index for free
  password_hash text NOT NULL,                      -- fake values below; sandbox only
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'ATTENDEE'
                CONSTRAINT users_role_check
                CHECK (role IN ('ATTENDEE', 'ORGANIZER', 'ADMIN')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text NOT NULL,
  venue        text NOT NULL,
  starts_at    timestamptz NOT NULL,
  capacity     integer NOT NULL CHECK (capacity >= 0),
  price_cents  integer NOT NULL CHECK (price_cents >= 0),  -- never Float for money
  organizer_id uuid NOT NULL REFERENCES users (id),        -- User 1-N Event
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  event_id   uuid NOT NULL REFERENCES events (id),
  status     text NOT NULL DEFAULT 'CONFIRMED'
             CONSTRAINT bookings_status_check
             CHECK (status IN ('CONFIRMED', 'CANCELLED', 'WAITLISTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One booking per user per event. Same rule as Prisma's
  -- @@unique([userId, eventId]); columns deliberately ordered
  -- (event_id, user_id) here so the backing index does NOT cover
  -- `WHERE user_id = ...` — that keeps the EXPLAIN demo honest.
  CONSTRAINT bookings_user_event_uniq UNIQUE (event_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Seed: users (~2,000). Rows 1-2 are ADMINs, 3-42 are ORGANIZERs (40 of them),
-- the rest ATTENDEEs. Names cycle through 16x16 combinations, so duplicate
-- names exist — that is realistic, and it is why we key on ids, not names.
-- -----------------------------------------------------------------------------

INSERT INTO users (email, password_hash, name, role, created_at)
SELECT
  'user' || i || '@example.com',
  '$argon2id$sandbox-not-a-real-hash$' || md5(i::text),
  (ARRAY['Ada','Grace','Linus','Barbara','Alan','Margaret','Edsger','Radia',
         'Dennis','Frances','Ken','Katherine','Brian','Annie','Guido','Anita'])[1 + (i % 16)]
    || ' ' ||
  (ARRAY['Lovelace','Hopper','Torvalds','Liskov','Turing','Hamilton','Dijkstra','Perlman',
         'Ritchie','Allen','Thompson','Johnson','Kernighan','Easley','Rossum','Borg'])[1 + ((i / 16) % 16)],
  CASE
    WHEN i <= 2  THEN 'ADMIN'
    WHEN i <= 42 THEN 'ORGANIZER'
    ELSE 'ATTENDEE'
  END,
  now() - (random() * interval '365 days')
FROM generate_series(1, 2000) AS i;

-- -----------------------------------------------------------------------------
-- Seed: events (200). Each ORGANIZER gets ~5 events. starts_at spans roughly
-- 30 days in the past to ~120 days in the future (some events already happened).
-- Event #1 is titled exactly 'TS Conf' for the transaction demo.
-- -----------------------------------------------------------------------------

WITH organizers AS (
  SELECT id, row_number() OVER (ORDER BY email) AS rn
  FROM users
  WHERE role = 'ORGANIZER'
)
INSERT INTO events (title, description, venue, starts_at, capacity, price_cents, organizer_id, created_at)
SELECT
  CASE
    WHEN i = 1 THEN 'TS Conf'
    ELSE (ARRAY['Node Summit','TypeScript Days','GraphQL Meetup','Postgres Party',
                'DevOps Camp','Frontend Fest','API World','Cloud Native Night',
                'Testing Guild','Indie Hackers Demo'])[1 + (i % 10)] || ' #' || (i / 10 + 1)
  END,
  'Talks, workshops and a hallway track. Auto-seeded sandbox event #' || i || '.',
  (ARRAY['Main Hall A','Riverside Loft','The Warehouse','Tech Campus Auditorium',
         'Harbor View Center','Old Town Theater','Innovation Hub','Rooftop Studio'])[1 + (i % 8)],
  now() + ((i % 150) - 30) * interval '1 day' + (i % 12) * interval '2 hours',
  (ARRAY[20, 50, 100, 250, 500])[1 + (i % 5)],
  (ARRAY[0, 900, 1900, 2900, 4900, 9900])[1 + (i % 6)],
  o.id,
  LEAST(
    now() + ((i % 150) - 30) * interval '1 day' - interval '45 days',  -- announced ~45d before start
    now() - interval '1 day'
  )
FROM generate_series(1, 200) AS i
JOIN organizers o ON o.rn = 1 + (i % 40);

-- -----------------------------------------------------------------------------
-- Seed: bookings (~10k+). Random (user, event) pairs; power(random(), 2) skews
-- picks toward low row numbers, so a handful of events are very popular —
-- realistic long-tail distribution. Only the first 180 events (by creation
-- order) receive random bookings, so ~20 events end up with ZERO bookings.
-- Status mix: ~78% CONFIRMED, ~15% CANCELLED, ~7% WAITLISTED.
-- Total picks per event are capped at capacity (a booking system enforces
-- capacity, so random data must not oversell — only the two seeded villains
-- below may be oversold). Colliding picks (same user, same event) and rows
-- over the cap are dropped, which is why we generate 16,000 raw picks to
-- land above 10k surviving rows.
-- -----------------------------------------------------------------------------

WITH numbered_users AS (
  SELECT id, row_number() OVER (ORDER BY email) AS rn
  FROM users
),
numbered_events AS (
  SELECT id, capacity, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM events
),
picks AS (
  SELECT
    1 + floor(random() * 2000)::int          AS user_rn,
    1 + floor(power(random(), 2) * 180)::int AS event_rn,  -- skew: popular events
    random()                                 AS status_roll,
    random()                                 AS age_roll
  FROM generate_series(1, 16000)
),
placed AS (
  SELECT
    u.id         AS user_id,
    e.id         AS event_id,
    e.capacity,
    p.status_roll,
    p.age_roll,
    row_number() OVER (PARTITION BY e.id ORDER BY p.age_roll) AS k
  FROM picks p
  JOIN numbered_users  u ON u.rn = p.user_rn
  JOIN numbered_events e ON e.rn = p.event_rn
)
INSERT INTO bookings (user_id, event_id, status, created_at)
SELECT
  user_id,
  event_id,
  CASE
    WHEN status_roll < 0.78 THEN 'CONFIRMED'
    WHEN status_roll < 0.93 THEN 'CANCELLED'
    ELSE 'WAITLISTED'
  END,
  now() - (age_roll * interval '90 days')
FROM placed
WHERE k <= capacity              -- never seed more bookings than seats
ON CONFLICT (event_id, user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: two deliberately OVERSOLD events (capacity 5, 8 CONFIRMED bookings
-- each), so the GROUP BY/HAVING "which events are oversold?" demo returns
-- rows instead of an anticlimactic empty set.
-- -----------------------------------------------------------------------------

INSERT INTO events (title, description, venue, starts_at, capacity, price_cents, organizer_id)
SELECT
  t.title,
  'Deliberately oversold seed data — the HAVING demo needs a villain.',
  'The Broom Closet',
  now() + interval '14 days',
  5,
  900,
  (SELECT id FROM users WHERE role = 'ORGANIZER' ORDER BY email LIMIT 1)
FROM (VALUES ('Tiny Room Meetup'), ('Server Room Rave')) AS t(title);

INSERT INTO bookings (user_id, event_id, status)
SELECT u.id, e.id, 'CONFIRMED'
FROM events e
CROSS JOIN (
  SELECT id FROM users WHERE role = 'ATTENDEE' ORDER BY email LIMIT 8
) u
WHERE e.title IN ('Tiny Room Meetup', 'Server Room Rave')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Fresh planner statistics so class EXPLAIN estimates are sane from minute one.
ANALYZE users;
ANALYZE events;
ANALYZE bookings;

-- Sanity summary — shows up in `docker compose logs postgres` on first boot.
SELECT
  (SELECT count(*) FROM users)    AS users,
  (SELECT count(*) FROM events)   AS events,
  (SELECT count(*) FROM bookings) AS bookings,
  (SELECT count(*) FROM bookings WHERE status = 'CONFIRMED') AS confirmed;
