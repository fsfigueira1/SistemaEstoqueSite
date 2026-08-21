const { PrismaClient } = require('../src/generated/prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Create a separate test database file - EXACT COPY FROM tests/setup.ts
const adapter = new PrismaBetterSqlite3({ url: 'file:./test.db' });
const prisma = new PrismaClient({ adapter });

async function testConnection() {
  try {
    console.log('Testing connection to test.db...');

    // Try to count users - this should work if table exists and connection is good
    const userCount = await prisma.user.count();
    console.log(`��✓ Successfully connected to test.db`);
    console.log(`��✓ User table exists and has ${userCount} records`);

    // Try a few more tables to be sure
    const cashRegisterCount = await prisma.cashRegister.count();
    console.log(`��✓ CashRegister table exists and has ${cashRegisterCount} records`);

    const cashSessionCount = await prisma.cashSession.count();
    console.log(`��✓ CashSession table exists and has ${cashSessionCount} records`);

    await prisma.$disconnect();
    console.log('��✓ Disconnected successfully');
    return true;
  } catch (error) {
    console.error('��✗ Error testing connection:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});