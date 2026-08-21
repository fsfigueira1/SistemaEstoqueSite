const { PrismaClient } = import './src/generated/prisma/client');
const { PrismaBetterSqlite3 } = import '@prisma/adapter-better-sqlite3');

async function debug() {
  const adapter = new PrismaBetterSqlite3({ url: 'file:./test.db' });
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.priceHistory.count();
    console.log(`PriceHistory count: ${count}`);

    if (count > 0) {
      const records = await prisma.priceHistory.findMany({
        take: 5
      });
      console.log('First 5 records:', records);
    }
  } catch (error) {
    console.error('Error querying priceHistory:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug();