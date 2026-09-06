import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Concurrency Tests & Requirements', () => {
  let testProductId: number;

  beforeAll(async () => {
    // Reset test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Concurrency Product',
        priceInCents: 1500,
        stock: 10
      }
    });
    testProductId = product.id;
  });

  it('should handle 15 concurrent purchase attempts cleanly (Race Condition check)', async () => {
    const purchaseRequests = Array.from({ length: 15 }).map(() =>
      request(app)
        .post('/orders')
        .send({
          customerEmail: 'test@example.com',
          items: [{ productId: testProductId, quantity: 1 }]
        })
    );

    const responses = await Promise.all(purchaseRequests);

    const successCount = responses.filter(r => r.status === 201).length;
    const failCount = responses.filter(r => r.status === 400).length;

    expect(successCount).toBe(10);
    expect(failCount).toBe(5);

    const finalProduct = await prisma.product.findUnique({
      where: { id: testProductId }
    });
    expect(finalProduct?.stock).toBe(0);
  });

  it('Ordering more than available stock returns 400 (per our logic mapping 400/409)', async () => {
    // We expect 400 for out of stock based on the implementation
    const res = await request(app)
      .post('/orders')
      .send({
        customerEmail: 'test2@example.com',
        items: [{ productId: testProductId, quantity: 1 }]
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Out of stock');
  });

  it('Cancelling an order restores stock and returns 409 if cancelled again', async () => {
    // Create new product
    const p = await prisma.product.create({
      data: { name: 'Cancel Test', priceInCents: 1000, stock: 5 }
    });

    // Place order
    const orderRes = await request(app).post('/orders').send({
      customerEmail: 'cancel@example.com',
      items: [{ productId: p.id, quantity: 2 }]
    });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    // Check stock deducted (5 - 2 = 3)
    const pAfterOrder = await prisma.product.findUnique({ where: { id: p.id } });
    expect(pAfterOrder?.stock).toBe(3);

    // Cancel order
    const cancelRes = await request(app).post(`/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(200);

    // Check stock restored
    const pAfterCancel = await prisma.product.findUnique({ where: { id: p.id } });
    expect(pAfterCancel?.stock).toBe(5);

    // Cancel again -> 409
    const cancelAgainRes = await request(app).post(`/orders/${orderId}/cancel`);
    expect(cancelAgainRes.status).toBe(409);
    expect(cancelAgainRes.body.error).toBe('Order is already cancelled');
  });
});
