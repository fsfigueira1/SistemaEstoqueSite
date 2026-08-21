import { prisma } from './setup';

/**
 * Clean all data from the database between tests
 * Improved version with better locking prevention
 */
export async function cleanupDatabase() {
  let lastError: unknown;

  // Try up to 3 times with increasing delays
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Use individual deleteMany calls instead of one large transaction
      // This reduces lock duration and contention

      // Level 1: Pure leaf tables and tables referencing CashSession
      await prisma.auditLog.deleteMany();
      await prisma.priceHistory.deleteMany();
      await prisma.stockMovement.deleteMany();
      await prisma.purchaseOrderItem.deleteMany();
      await prisma.saleItem.deleteMany();
      await prisma.salePayment.deleteMany();
      await prisma.cashMovement.deleteMany();
      await prisma.sale.deleteMany(); // Moved here - references CashSession

      // Level 2: Tables that reference others and are referenced
      await prisma.cashSession.deleteMany();
      await prisma.purchaseOrder.deleteMany();

      // Level 3: Tables that are referenced but don't reference much
      await prisma.product.deleteMany();
      await prisma.category.deleteMany();
      await prisma.supplier.deleteMany();
      await prisma.cashRegister.deleteMany();
      await prisma.customer.deleteMany();

      // Level 4: Root table (referenced by many)
      await prisma.user.deleteMany();

      return; // Success
    } catch (error) {
      lastError = error;
      const errorMessage = (error as Error).message;

      if (attempt < 3) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
  }

  // If all attempts failed, throw the last error
  console.error('All cleanup attempts failed');
  throw lastError;
}

/**
 * Create a test user for use in tests (non-admin role)
 */
export async function createTestUser(emailOverride?: string) {
  return prisma.user.create({
    data: {
      email: emailOverride || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      name: 'Test User',
      password: 'hashed_password_123',
      role: 'MANAGER',
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