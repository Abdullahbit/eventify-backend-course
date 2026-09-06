# Mini Order & Inventory Backend - Presentation Notes

## 1. The Goal
We built a "Mini Order & Inventory Backend" from scratch. The core objective was to build a robust, full-stack application that handles inventory management and prevents data corruption during high traffic.

## 2. Phase 1: Database Setup & Architecture
- **Tech Stack:** We used Node.js, Express, and Prisma ORM.
- **Relational Integrity:** Instead of storing an array of products directly on an order, we designed a normalized database using a junction table (`OrderItem`). This links an `Order` and a `Product` while tracking the exact `quantity` purchased, preventing data duplication.
- **SQLite (Fallback):** We used SQLite for local development to avoid heavy Docker/Postgres dependencies while maintaining full relational capabilities.

## 3. Phase 2: Endpoints & Transactions (The Core Logic)
- We implemented RESTful endpoints: `GET /products`, `POST /orders`, and `POST /orders/:id/cancel`.
- **The Hardest Concept (Prisma Transactions):** When a user buys an item, we use a `prisma.$transaction`. Without this, if two users buy the last item at the exact same millisecond, the database might let *both* of them pass the stock check before deducting it, resulting in negative stock! A transaction bundles the stock check and deduction into one atomic operation—guaranteeing that if one step fails, everything safely rolls back.

## 4. Phase 3: Concurrency Testing
- **Vitest & Supertest:** We set up automated integration tests against a real database (no mocking!).
- **Proving the Transaction:** We used `Promise.all()` to simulate 15 real users clicking "Buy" at the exact same time on an item with only 10 stock. The test definitively proved that our database locked the rows properly: exactly 10 requests succeeded (201) and exactly 5 failed (400 - Out of stock), leaving the final stock at exactly `0`.

## 5. Phase 4: Production Standards
- **Dockerizing:** We wrote an optimized, multi-stage `node:24-slim` Dockerfile that separates the build stage from the runtime stage, keeping the final deployment image tiny.
- **CI/CD:** We configured a GitHub Actions pipeline (`ci.yml`) that automatically spins up Postgres/Redis services, typechecks, and tests the code on every push.
- **Resilience:** We added Pino for structured logging, a `/health` endpoint for load balancers, and a **Graceful Shutdown** handler. 
  - *Why Graceful Shutdown?* When a server is scaled down or restarted, the orchestrator sends a `SIGTERM` signal. Our handler catches this, stops accepting new requests, finishes processing active ones, and cleanly closes the database connection. Without this, users mid-purchase would get their connection abruptly severed!

## 6. Phase 5: The Full-Stack Experience (Next.js)
- **Client Components:** We built a minimal, modern frontend using Next.js (App Router) and Tailwind CSS.
- **Interactivity:** We used the `"use client"` directive because our page needs to maintain React state (`useState`) and handle user interactions (`onClick`) to update the live stock count dynamically when the "Buy 1" button is clicked.
- **CORS:** We updated the backend to use the `cors` middleware, allowing our frontend (running on port 3001) to safely communicate with our backend (running on port 3000) without being blocked by browser security policies.

---
*End of presentation.* You crushed it! 🚀
