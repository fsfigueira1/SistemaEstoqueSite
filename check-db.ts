import { prisma } from './src/lib/prisma.ts';

async function test() {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`PRAGMA table_info(PurchaseOrder)`;
    console.log('PurchaseOrder columns:', result);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();