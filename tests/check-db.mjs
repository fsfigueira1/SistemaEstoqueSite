import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

console.log('Checking test.db...');
const adapter = new PrismaBetterSqlite3({ url: 'file:./test.db' });
const prisma = new PrismaClient({ adapter });

async function check() {
  try {
    // Check if we can connect
    const version = await prisma.$queryRaw`SELECT sqlite_version()`;
    console.log('SQLite version:', version);

    // Check if tables exist
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('Tables:', tables);

    // Check a few specific tables
    const users = await prisma.user.findMany();
    console.log('Users count:', users.length);

    const categories = await prisma.category.findMany();
    console.log('Categories count:', categories.length);

    const products = await prisma.product.findMany();
    console.log('Products count:', products.length);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();