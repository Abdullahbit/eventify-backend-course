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
  const { customerEmail, items } = req.body;

  if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required and cannot be empty' });
  }

  const productIds = items.map((item: any) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    return res.status(400).json({ error: 'Duplicate product IDs are not allowed' });
  }

  for (const item of items) {
    if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      return res.status(400).json({ error: 'Quantities must be positive integers' });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let totalInCents = 0;
      const orderItemsData = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error('Product not found');
        }

        if (product.stock < item.quantity) {
          throw new Error('Out of stock');
        }

        totalInCents += product.priceInCents * item.quantity;
        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceInCents: product.priceInCents
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      const order = await tx.order.create({
        data: {
          customerEmail,
          totalInCents,
          status: 'placed',
          orderItems: {
            create: orderItemsData
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

// GET /orders/:id - Get order by ID
app.get('/orders/:id', async (req: Request, res: Response): Promise<any> => {
  const orderId = parseInt(req.params.id as string, 10);
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /orders/:id/cancel - Cancel an order and restore stock
app.post('/orders/:id/cancel', async (req: Request, res: Response): Promise<any> => {
  const orderId = parseInt(req.params.id as string, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { orderItems: true }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'cancelled') {
        throw new Error('Order is already cancelled');
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

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' }
      });

      return updatedOrder;
    });

    res.json(result);
  } catch (error: any) {
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Order is already cancelled') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Order cannot be cancelled unless in placed status') {
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
