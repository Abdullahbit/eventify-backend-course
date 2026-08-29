# Eventify v1.0 — Production-Grade Event Booking Platform

Eventify is an event management and high-concurrency ticket reservation API built with **Express 5**, **Prisma 7**, **PostgreSQL 17**, **Redis 8**, and **BullMQ**.

Designed from the ground up to prevent race conditions, ticket overselling, and authentication exploits, Eventify features **Serializable transactional bookings**, **Opaque Refresh Token Rotation (RTR)**, **Broken Object Level Authorization (BOLA)** defenses, **Redis cache-aside with write invalidation**, **Fixed-window rate limiting**, and **Asynchronous BullMQ waitlist promotion queues**.

---

## 🏛️ System Architecture

```mermaid
graph TD
    Client["Client / Mobile / Web"] -->|HTTPS / Cookies| ExpressApp["Express 5 API Server (Port 3000)"]
    
    subgraph Security & Middleware
        ExpressApp --> AuthGuard["requireAuth (HS256 JWT)"]
        ExpressApp --> RoleGuard["requireRole (ORGANIZER / ADMIN)"]
        ExpressApp --> RateLimiter["Redis Fixed-Window Limiter"]
    end
    
    subgraph Data & Cache Layer
        ExpressApp --> CacheAside["Cache-Aside Layer (Redis 8)"]
        CacheAside -->|Read Cache / Version Counter| RedisDB[("Redis Store")]
        ExpressApp -->|Serializable Transactions| PostgresDB[("PostgreSQL 17")]
    end
    
    subgraph Asynchronous Workers
        ExpressApp -->|Enqueue waitlist-promote| BullQueue[("BullMQ Redis Queue")]
        WorkerProcess["Worker Process (src/worker.ts)"] -->|Poll Jobs| BullQueue
        WorkerProcess -->|Promote Oldest Waitlisted| PostgresDB
        WorkerProcess -->|Send Confirmation| MailerConsole["Mailer Transport"]
    end
```

---

## 🚀 Key Technical Highlights

1. **Race-Safe Concurrency (Zero Oversell)**:
   - All booking creation runs inside `Serializable` transaction isolation with capacity re-checking.
   - Verified via automated parallel bursts (20 simultaneous requests against capacity 5 yielded exactly 5 confirmed and 15 waitlisted/rejected with 0 over-sell).
2. **Opaque Refresh Token Rotation (RTR)**:
   - 15-minute stateless JWTs (HS256 algorithm pinned).
   - 7-day 32-byte opaque random refresh tokens stored as SHA-256 hashes at rest in Postgres.
   - Delivered via `httpOnly; Secure; SameSite=Strict; Path=/v1/auth/refresh` cookies.
   - **Reuse Theft Detection**: Replaying an already-spent refresh token invalidates the entire descendant token family tree.
3. **BOLA & IDOR Defenses**:
   - Organizers can only update and delete events they created (`organizerId === sub`), with ADMIN bypass.
   - Attendees can only view and cancel their own bookings (`userId === sub`), with ADMIN bypass.
4. **Cache-Aside & Cache Invalidation**:
   - Read-path queries Redis first (`event:{id}`).
   - Write-path (`POST`, `PATCH`, `DELETE`) deletes the item key and increments `events:list:v` to instantly invalidate all paginated list caches.
   - **Fail-Open**: All cache and queue layers gracefully fall back to direct PostgreSQL reads if Redis is offline.
5. **Waitlist Queue & Background Workers**:
   - Full events automatically place bookings into `WAITLISTED` status.
   - Cancelling a confirmed booking enqueues a `waitlist-promote` job. The worker promotes the oldest waitlisted booking to `CONFIRMED` inside a capacity-checked transaction and fires a confirmation email.
6. **OpenAPI 3.1 Specification**:
   - Automated documentation served live at `/openapi.json`.

---

## 📋 API Endpoints

| Method | Path | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Service health check & uptime |
| `GET` | `/openapi.json` | Public | Interactive OpenAPI 3.1 schema specification |
| `POST` | `/v1/auth/login` | Public (5 req/min/IP) | Log in; returns JWT and sets `httpOnly` refresh cookie |
| `POST` | `/v1/auth/refresh` | Cookie Auth | Rotate refresh token and issue new access JWT |
| `GET` | `/v1/venues` | Public | List all venues |
| `POST` | `/v1/venues` | Public / Admin | Create a new venue |
| `GET` | `/v1/events` | Public | List paginated events (cached via Redis) |
| `POST` | `/v1/events` | `ORGANIZER` / `ADMIN` | Create an event |
| `GET` | `/v1/events/:id` | Public | Fetch event details (cached via Redis) |
| `PATCH` | `/v1/events/:id` | Owner / `ADMIN` | Update event (invalidates cache) |
| `DELETE` | `/v1/events/:id` | Owner / `ADMIN` | Delete event (invalidates cache) |
| `POST` | `/v1/bookings` | Authenticated (10 req/min) | Book ticket (creates `CONFIRMED` or `WAITLISTED`) |
| `GET` | `/v1/bookings/:id` | Public / Owner | Fetch booking confirmation |
| `DELETE` | `/v1/bookings/:id` | Owner / `ADMIN` | Cancel booking (triggers worker waitlist promotion) |

---

## 🛠️ Quickstart & Local Development

### Prerequisites
* **Node.js 24 LTS** (`node --version` -> `v24.x`)
* **npm 11+**
* **PostgreSQL 17** (Local or via Docker)
* **Redis 8** (Optional — API fails open if offline)

### 1. Installation
```bash
git clone https://github.com/Abdullahbit/eventify-backend-course.git
cd eventify-backend-course
npm install
```

### 2. Configure Environment
Create your `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eventify?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="0123456789012345678901234567890123456789012345678901234567890123"
WEB_ORIGIN="http://localhost:3000"
PORT=3000
```

### 3. Database Migration & Seeding
```bash
# Generate Prisma 7 Client
npx prisma generate

# Apply migrations
npx prisma migrate dev

# Seed demo users and events
npm run seed
```

### 4. Run the API & Worker
```bash
# Start API Server (Watch mode)
npm run dev

# Start Background Worker Process
npm run worker
```

---

## 🧪 Testing & Verification

```bash
# 1. Typecheck (0 errors)
npm run typecheck

# 2. Linting (0 warnings/errors)
npm run lint

# 3. Integration Tests (Auth, BOLA, Waitlist, Soft-Cancel Rebook, Cache Invalidation)
npm test

# 4. Waitlist & Idempotency Demo Script
node --env-file=.env scripts/waitlist-demo.ts

# 5. Rate Limiter Burst Test
node --env-file=.env scripts/rate-limit-burst.ts
```

---

## ☁️ Live Deployment (Render & Cloud Services)

Eventify is configured for zero-config deployment on Render using the included `render.yaml` blueprint:
* **Web Service (`eventify-api`)**: Hosts Express 5 API on Render.
* **Worker Service (`eventify-worker`)**: Hosts background queue consumer for BullMQ.
* **Database**: Neon Serverless PostgreSQL 17.
* **Cache & Queues**: Upstash Serverless Redis.

---

## 🤖 AI-Assisted Development & Verification Disclosure

In accordance with course guidelines, AI pair programming was utilized across development phases with strict human oversight:
* **What AI Drafted**: Initial boilerplate scaffolding for routes, Zod schemas, OpenAPI definitions, and initial test matrices.
* **What Human / Review Verification Caught & Fixed**:
  1. *Algorithm Confusion Vulnerability*: Pinned `{ algorithms: ['HS256'] }` on `jwt.verify` to prevent HMAC confusion exploits.
  2. *BullMQ Client Wrapper Bug*: Caught and fixed configuration object passing in `createNodeRedisClient`.
  3. *Uncaught Connection Error Crashes*: Added `.on('error')` client listeners to enable full fail-open behavior during Redis outages.
  4. *Prisma Transaction Timeout Rollbacks*: Refactored background queue dispatching out of Serializable transactions so Postgres transactions commit cleanly without blocking.
