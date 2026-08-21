const fs = require('fs');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('./src/generated/prisma/client');

async function checkTestDbState() {
  console.log('=== Checking test.db state ===');

  // Check if file exists
  const fileExists = fs.existsSync('./test.db');
  console.log(`test.db exists: ${fileExists}`);

  if (fileExists) {
    const stats = fs.statSync('./test.db');
    console.log(`test.db size: ${stats.size} bytes`);
    console.log(`test.db modified: ${stats.mtime}`);
  }

  // Try to query using Prisma
  try {
    console.log('\n--- Trying to query with Prisma ---');
    const adapter = new PrismaBetterSqlite3({ url: 'file:./test.db' });
    const prisma = new PrismaClient({ adapter });

    // Try to count users
    const userCount = await prisma.user.count();
    console.log(`User table accessible: ${userCount} users found`);

    // Try to count cash registers
    const cashRegisterCount = await prisma.cashRegister.count();
    console.log(`CashRegister table accessible: ${cashRegisterCount} registers found`);

    // Try to count cash sessions
    const cashSessionCount = await prisma.cashSession.count();
    console.log(`CashSession table accessible: ${cashSessionCount} sessions found`);

    await prisma.$disconnect();
    console.log('Prisma client disconnected successfully');

  } catch (error) {
    console.error('Error querying with Prisma:', error.message);
    console.error('Error stack:', error.stack);
  }
}

checkTestDbState();