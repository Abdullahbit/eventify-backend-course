const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching products from DummyJSON...');
  const res = await fetch('https://dummyjson.com/products?limit=5');
  const data = await res.json();
  
  console.log('Seeding database...');
  for (const item of data.products) {
    // Math.round(price * 100) to get price in cents
    const priceInCents = Math.round(item.price * 100);
    await prisma.product.create({
      data: {
        name: item.title,
        priceInCents: priceInCents,
        stock: 10,
      },
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
