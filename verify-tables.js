const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('./src/generated/prisma/client');

async function verifyTables() {
  try {
    console.log('Connecting to test.db...');
    const adapter = new PrismaBetterSqlite3({ url: 'file:./test.db' });
    const prisma = new PrismaClient({ adapter });

    // Check if User table exists by trying to query it
    console.log('Checking User table...');
    const userCount = await prisma.user.count();
    console.log(`��✓ User table exists with ${userCount} records`);

    // Check CashRegister table
    console.log('Checking CashRegister table...');
    const cashRegisterCount = await prisma.cashRegister.count();
    console.log(`��✓ CashRegister table exists with ${cashRegisterCount} records`);

    // Check CashSession table
    console.log('Checking CashSession table...');
    const cashSessionCount = await prisma.cashSession.count();
    console.log(`��✓ CashSession table exists with ${cashSessionCount} records`);

    await prisma.$disconnect();
    console.log('��✓ All critical tables exist and are accessible');
    return true;
  } catch (error) {
    console.error('��✗ Error verifying tables:', error.message);
    return false;
  }
}

verifyTables().then(success => {
  process.exit(success ? 0 : 1);
});