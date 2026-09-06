# Mini Order & Inventory Backend

This is a production-ready, full-stack application built as a final assignment for the Eventify Backend Course. It features a robust Node.js/Express backend that handles concurrent order processing, and a minimal Next.js frontend to visualize live stock deductions.

## Features & Architecture

* **Database Normalization (Prisma ORM):** Uses a junction table (`OrderItem`) linking `Order` and `Product` to track quantities cleanly and prevent data duplication. (Currently running on SQLite for simple local testing).
* **Race Condition Prevention:** Implements Prisma `$transaction` blocks on the `POST /orders` endpoint to guarantee stock checks and deductions happen atomically. 
* **Concurrency Testing (Vitest & Supertest):** Proves transaction integrity by firing 15 asynchronous purchase requests at the exact same millisecond against an item with only 10 stock.
* **Production Standards:** 
  * Graceful Shutdown handlers for `SIGTERM` / `SIGINT` signals.
  * Pino structured logging.
  * Dedicated `/health` endpoint for load balancer pings.
  * Multi-stage Dockerfile (`node:24-slim`) to minimize image sizes.
  * GitHub Actions CI pipeline (`ci.yml`) for automated testing and type-checking.
* **Next.js Frontend:** A React Client Component (`"use client"`) built with Tailwind CSS that hooks into the REST API using CORS to provide a real-time purchasing dashboard.

---

## How to Run Locally

### 1. Database Setup & Seeding
This project is configured to use a local SQLite file (`dev.db`), meaning you do not need Docker or PostgreSQL installed to run it. 

Run the following commands in the root directory to generate the database and seed it with 5 dummy products:
```bash
npx prisma db push
node prisma/seed-js.js
```

### 2. Start the Backend API
In the root directory, start the Express server (runs on `http://localhost:3000`):
```bash
npm start
```

### 3. Start the Frontend UI
Open a **new terminal tab**, navigate into the `client` folder, and start the Next.js app:
```bash
cd client
npm run dev
```
Navigate to `http://localhost:3001` (or whichever port Next.js specifies) to view the live dashboard and test the "Buy 1" functionality.

### 4. Run the Concurrency Tests
To run the automated integration tests that prove race conditions are handled correctly:
```bash
npx vitest run
```
