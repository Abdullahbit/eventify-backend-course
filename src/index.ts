import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import cors from 'cors';

const logger = pino();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// GET /health - Database Ping
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'connected' });
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    res.status(503).json({ status: 'DOWN', database: 'disconnected' });
  }
});

// GET /products - List all products and their stock
app.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /orders - Create an order and deduct stock
app.post('/orders', async (req: Request, res: Response): Promise<any> => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid product or quantity' });
  }

  try {
    // We use a Prisma Transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the product to check stock
      const product = await tx.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < quantity) {
        throw new Error('Out of stock');
      }

      // 2. Deduct stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } }
      });

      // 3. Create the order and order item
      const order = await tx.order.create({
        data: {
          status: 'COMPLETED',
          orderItems: {
            create: {
              productId,
              quantity
            }
          }
        },
        include: {
          orderItems: true
        }
      });

      return order;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === 'Out of stock' || error.message === 'Product not found') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /orders/:id/cancel - Cancel an order and restore stock
app.post('/orders/:id/cancel', async (req: Request, res: Response): Promise<any> => {
  const orderId = parseInt(req.params.id as string, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { orderItems: true }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'CANCELLED') {
        throw new Error('Order is already cancelled');
      }

      // 2. Restore stock for each item in the order
      for (const item of order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }

      // 3. Mark the order as CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' }
      });

      return updatedOrder;
    });

    res.json(result);
  } catch (error: any) {
    if (error.message === 'Order not found' || error.message === 'Order is already cancelled') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
let server: any;

if (require.main === module) {
  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// Graceful Shutdown Handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await prisma.$disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
