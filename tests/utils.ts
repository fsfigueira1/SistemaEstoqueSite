import { prisma } from './setup';

/**
 * Clean all data from the database between tests
 * This preserves the table structure but removes all data
 * Uses Prisma's deleteMany for reliable deletion with proper FK handling
 * Includes retry logic and better error handling for timeout issues
 */
export async function cleanupDatabase() {
  let lastError: unknown;

  // Try up to 3 times with increasing timeouts
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const start = Date.now();
      const baseTimeout = 15000;
      const timeout = baseTimeout * attempt; // Increase timeout with each attempt

      // Use multiple smaller transactions instead of one large transaction
      // This reduces lock contention and avoids SQLITE_BUSY errors
      // Delete in order that respects foreign key constraints (dependent tables first)

      // Level 1: Pure leaf tables (reference others but aren't referenced much)
      // plus tables that reference CashSession (Sale, CashMovement)
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany();
        await tx.priceHistory.deleteMany();
        await tx.stockMovement.deleteMany();
        await tx.purchaseOrderItem.deleteMany();
        await tx.saleItem.deleteMany();
        await tx.salePayment.deleteMany();
        await tx.cashMovement.deleteMany();
        await tx.sale.deleteMany(); // Moved to Level 1 - references CashSession
      }, { timeout });

      // Level 2: Tables that reference others and are referenced
      // (Sale moved to Level 1, PurchaseOrder stays here)
      await prisma.$transaction(async (tx) => {
        await tx.cashSession.deleteMany();
        await tx.purchaseOrder.deleteMany();
      }, { timeout });

      // Level 3: Tables that are referenced but don't reference much
      await prisma.$transaction(async (tx) => {
        await tx.product.deleteMany();
        await tx.category.deleteMany();
        await tx.supplier.deleteMany();
        await tx.cashRegister.deleteMany();
        await tx.customer.deleteMany();
      }, { timeout });

      // Level 4: Root table (referenced by many)
      await prisma.$transaction(async (tx) => {
        await tx.user.deleteMany();
      }, { timeout });

      const end = Date.now();
      console.log(`cleanupDatabase took ${end - start}ms (attempt ${attempt})`);
      return; // Success, exit the function
    } catch (error) {
      lastError = error;
      const errorMessage = (error as Error).message;
      console.warn(`Cleanup attempt ${attempt} failed:`, errorMessage);

      // If this is not the last attempt, wait before retrying
      if (attempt < 3) {
        // Wait longer between attempts (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  // If all attempts failed, throw the last error
  console.error('All cleanup attempts failed');
  throw lastError;
}

/**
 * Reset the database by deleting and recreating it
 * This is more thorough but slower
 * NOTE: This does NOT disconnect the shared PrismaClient singleton
 * The singleton must remain connected for the entire test suite
 */
export async function resetDatabase() {
  // Import here to avoid circular dependencies
  const { existsSync, unlinkSync } = require('fs');

  // Delete the test database file if it exists
  if (existsSync('./test.db')) {
    // Try to delete it, with retries if it's locked
    let retries = 5;
    while (retries > 0) {
      try {
        unlinkSync('./test.db');
        break;
      } catch (e) {
        retries--;
        if (retries === 0) {
          console.error('Failed to delete test.db after multiple attempts:', (e as Error).message);
          throw e;
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Also delete the WAL and SHM files if they exist (SQLite write-ahead logging files)
  for (const suffix of ['-wal', '-shm']) {
    const walPath = `./test.db${suffix}`;
    if (existsSync(walPath)) {
      try {
        unlinkSync(walPath);
      } catch (e) {
        // Ignore errors for WAL/SHM files
      }
    }
  }

  // Run migrations on test database
  const { execSync } = require('child_process');
  // We need to set the DATABASE_URL environment variable for the migration
  const env = { ...process.env, DATABASE_URL: 'file:./test.db' };
  try {
    execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  } catch (e) {
    console.error('Failed to run migrations:', (e as Error).message);
    throw e;
  }
}

/**
 * Create a test user for use in tests
 */
export async function createTestUser(emailOverride?: string) {
  return prisma.user.create({
    data: {
      email: emailOverride || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      name: 'Test User',
      password: 'hashed_password_123', // In real app, this would be hashed
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });
}

/**
 * Create an admin user
 */
export async function createAdminUser(emailOverride?: string) {
  return prisma.user.create({
    data: {
      email: emailOverride || `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@test.com`,
      name: 'Admin User',
      password: 'hashed_password_456',
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });
}