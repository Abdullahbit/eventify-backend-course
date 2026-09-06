const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  const products = [
    { name: 'Wireless Mouse', stock: 10 },
    { name: 'Mechanical Keyboard', stock: 10 },
    { name: '27-inch Monitor', stock: 10 },
    { name: 'USB-C Hub', stock: 10 },
    { name: 'Ergonomic Chair', stock: 10 },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: p,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
