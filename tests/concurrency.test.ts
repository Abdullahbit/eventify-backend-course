import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/index';

const prisma = new PrismaClient();

describe('Concurrency and Race Conditions', () => {
  let testProductId: number;

  beforeAll(async () => {
    // 1. Clean the database before tests
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();

    // 2. Create a test product with exactly 10 stock
    const product = await prisma.product.create({
      data: {
        name: 'Limited Edition Sneakers',
        stock: 10,
      },
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    // Clean up connections
    await prisma.$disconnect();
  });

  it('should handle 15 concurrent purchase attempts cleanly (10 succeed, 5 fail)', async () => {
    // We create an array of 15 identical requests
    const purchaseRequests = Array.from({ length: 15 }).map(() => 
      request(app)
        .post('/orders')
        .send({ productId: testProductId, quantity: 1 })
    );

    // Fire all 15 requests at the EXACT same time using Promise.all
    const responses = await Promise.all(purchaseRequests);

    // Count how many succeeded (status 201) and how many failed due to out of stock (status 400)
    let successCount = 0;
    let failCount = 0;

    responses.forEach(res => {
      if (res.status === 201) successCount++;
      if (res.status === 400 && res.body.error === 'Out of stock') failCount++;
    });

    // Verify exactly 10 succeeded and 5 failed
    expect(successCount).toBe(10);
    expect(failCount).toBe(5);

    // Verify the final stock in the database is exactly 0
    const finalProduct = await prisma.product.findUnique({
      where: { id: testProductId }
    });
    
    expect(finalProduct?.stock).toBe(0);
  });
});
