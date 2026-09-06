# Technical Walkthrough: Mini Order & Inventory Backend

Use this guide to walk your grader through the actual codebase, explaining the technical decisions and how everything wires together.

---

## 1. Database Schema (`prisma/schema.prisma`)
Our database is defined using Prisma's schema language.

```prisma
model Product {
  id         Int         @id @default(autoincrement())
  name       String
  stock      Int
  orderItems OrderItem[]
}

model Order {
  id         Int         @id @default(autoincrement())
  status     String      @default("PENDING")
  orderItems OrderItem[]
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  productId Int
  quantity  Int
  order     Order   @relation(fields: [orderId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}
```
**Talking Points:**
- Point out the `OrderItem` model. Explain that this is a **Junction Table** (or associative entity) connecting a many-to-many relationship between `Order` and `Product`. 
- By using `OrderItem`, we can track the specific `quantity` of a product bought in a single order, rather than just storing a list of IDs. This guarantees a normalized database structure (3NF).

---

## 2. The Core Logic (`src/index.ts`)
This file is our Express application. The most critical part of this file is the `POST /orders` endpoint.

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Fetch the product to check stock
  const product = await tx.product.findUnique({ where: { id: productId } });

  if (product.stock < quantity) {
    throw new Error('Out of stock');
  }

  // 2. Deduct stock
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: quantity } }
  });

  // 3. Create the order and order item
  // ...
});
```
**Talking Points:**
- **Why `$transaction`?** Explain that when building an inventory system, checking stock and deducting stock *must* happen together safely. 
- If we didn't use a transaction block, high traffic could cause a **race condition** where two requests read `product.stock = 1` at the exact same time, and both successfully deduct it, resulting in `-1` stock in the database!
- By wrapping these operations in `tx`, we ensure **ACID compliance** (Atomicity, Consistency, Isolation, Durability). The operations are locked together. If the stock drops below the requested quantity, we `throw new Error()`, which safely aborts and rolls back the entire transaction.

---

## 3. Concurrency Testing (`tests/concurrency.test.ts`)
We wrote an automated test to physically prove that our transaction prevents race conditions.

```typescript
it('should handle 15 concurrent purchase attempts cleanly', async () => {
  const purchaseRequests = Array.from({ length: 15 }).map(() => 
    request(app).post('/orders').send({ productId: testProductId, quantity: 1 })
  );

  // Fire all 15 requests at the EXACT same time
  const responses = await Promise.all(purchaseRequests);
  
  // Verify exactly 10 succeeded and 5 failed
  expect(successCount).toBe(10);
  expect(failCount).toBe(5);
});
```
**Talking Points:**
- We seeded exactly `10` stock for a dummy item.
- We constructed an array of `15` HTTP POST requests using Supertest.
- We passed that array into `Promise.all()`. This is crucial because it fires all 15 requests asynchronously at the exact same millisecond, simulating a real-world high-traffic spike (like a sneaker drop).
- The test asserts that exactly 10 succeed and 5 hit the `400 Out of Stock` block, proving our Prisma `$transaction` works perfectly.

---

## 4. Production Resilience (`src/index.ts` bottom)
We implemented a **Graceful Shutdown** handler.

```typescript
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```
**Talking Points:**
- In production (e.g., Kubernetes or Docker Swarm), containers are destroyed and recreated constantly to scale. Before being destroyed, the OS sends a `SIGTERM` signal.
- If we didn't catch this, the server would instantly die, and users mid-purchase would see an error page.
- Our code catches the signal, calls `server.close()` to stop accepting *new* traffic, finishes processing *active* traffic, closes the database cleanly, and then exits safely.

---

## 5. Next.js Frontend (`client/src/app/page.tsx`)
We built the UI using React Server/Client Components.

```tsx
"use client";
import { useEffect, useState } from "react";
```
**Talking Points:**
- Explain the `"use client"` directive. Next.js uses React Server Components by default to render HTML on the server for performance.
- Because our inventory dashboard needs to react to user clicks instantly without a page refresh, we need React Hooks like `useState` and `onClick`. The `"use client"` directive tells Next.js to ship this JS to the browser so the UI is fully interactive.
- Point out that our frontend fetches directly from `http://localhost:3000/products`, which works because we added the `cors` middleware to the Express app.
