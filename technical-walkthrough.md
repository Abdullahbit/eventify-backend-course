# Technical Walkthrough: Mini Order & Inventory Backend

Use this guide to walk your grader through the actual codebase, explaining the technical decisions and how everything wires together to meet the final assignment requirements perfectly.

---

## 1. Database Schema (`prisma/schema.prisma`)
Our database is defined using Prisma's schema language and is strictly normalized.

```prisma
model Product {
  id           Int         @id @default(autoincrement())
  name         String
  priceInCents Int
  stock        Int
  orderItems   OrderItem[]
}

model Order {
  id            Int         @id @default(autoincrement())
  customerEmail String
  status        String      @default("placed")
  totalInCents  Int
  createdAt     DateTime    @default(now())
  orderItems    OrderItem[]
}

model OrderItem {
  id               Int     @id @default(autoincrement())
  orderId          Int
  productId        Int
  quantity         Int
  unitPriceInCents Int
  order            Order   @relation(fields: [orderId], references: [id])
  product          Product @relation(fields: [productId], references: [id])
}
```
**Talking Points:**
- Point out the `OrderItem` model. Explain that this is a **Junction Table** (or associative entity) connecting a many-to-many relationship between `Order` and `Product`.
- By tracking `unitPriceInCents` in the `OrderItem` table, we "freeze" the price of the product at the exact moment of purchase. If the product price changes next week, past orders won't be mathematically corrupted. 
- Using `priceInCents` prevents floating-point precision errors (like `$1.99 + $0.01 = 2.00000000001`) that often break financial systems.

---

## 2. The Core Logic (`src/index.ts`)
This file is our Express application. The most critical part of this file is the `POST /orders` endpoint, which handles bulk purchasing and validations.

```typescript
// After validating email, positive quantities, and duplicate IDs...
const result = await prisma.$transaction(async (tx) => {
  let totalInCents = 0;
  const orderItemsData = [];

  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });

    if (product.stock < item.quantity) {
      throw new Error('Out of stock');
    }

    // Accumulate total and lock in the unit price
    totalInCents += product.priceInCents * item.quantity;
    orderItemsData.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceInCents: product.priceInCents
    });

    // Deduct stock
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });
  }

  // Create the final order
  // ...
});
```
**Talking Points:**
- **Validation:** Highlight that the endpoint aggressively validates input before hitting the database (checking for valid emails, positive integer quantities, and duplicate item arrays).
- **Security:** We NEVER accept prices or totals from the client. We calculate the `totalInCents` entirely server-side by fetching the product data securely inside the loop.
- **Why `$transaction`? (Bonus Requirement):** Explain that when building an inventory system, checking stock and deducting stock *must* happen together safely. If we didn't use a transaction block, high traffic could cause a **race condition** where two users buy the last item simultaneously, resulting in negative stock! 
- By wrapping these operations in `tx`, we ensure **ACID compliance** (Atomicity, Consistency, Isolation, Durability). The operations are locked together. If one item in the array is out of stock, we `throw new Error()`, which safely aborts and rolls back the entire transaction.

---

## 3. Order Cancellations (`src/index.ts`)
The `POST /orders/:id/cancel` endpoint handles returning items to inventory securely.

```typescript
if (order.status === 'cancelled') {
  throw new Error('Order is already cancelled'); // Mapped to 409 Conflict
}
      
if (order.status !== 'placed') {
  throw new Error('Order cannot be cancelled unless in placed status');
}

for (const item of order.orderItems) {
  await tx.product.update({
    where: { id: item.productId },
    data: { stock: { increment: item.quantity } }
  });
}
```
**Talking Points:**
- **Idempotency & Status Checking:** We strictly enforce that the order must be `"placed"`. If it's already `"cancelled"`, we throw a `409 Conflict` error. This guarantees that a user cannot spam the cancel button and artificially print infinite stock back into the database (restoring stock twice).
- **Batch Restoration:** The transaction safely loops through every item in the original order and cleanly restores the exact quantity originally purchased.

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
