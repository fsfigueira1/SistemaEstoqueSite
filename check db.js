const { PrismaBetterSqlite3 } = import '@prisma/adapter-better-sqlite3');
const { PrismaClient } = import './src/generated/prisma/client');

async function checkDatabase() {
  try {
    const adapter = new PrismaBetterSqlite3({ url: 'file:./test.db' });
    const prisma = new PrismaClient({ adapter });

    // Try to query one table to see if it exists
    const userCount = await prisma.user.count();
    console.log(`User table exists with ${userCount} records`);

    // Check a few more tables
    const cashRegisterCount = await prisma.cashRegister.count();
    console.log(`CashRegister table exists with ${cashRegisterCount} records`);

    const cashSessionCount = await prisma.cashSession.count();
    console.log(`CashSession table exists with ${cashSessionCount} records`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking database:', error.message);
  }
}

checkDatabase();