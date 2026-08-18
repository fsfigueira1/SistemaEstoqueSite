import { prisma } from './tests/setup';
import { cleanupDatabase } from './tests/utils';

async function testSaleTotal() {
  await cleanupDatabase();

  // Create a user first (needed for createdById)
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'USER'
    }
  });

  // Create a category (needed for product)
  const category = await prisma.category.create({
    data: {
      name: 'Test Category'
    }
  });

  // Create a cash session (needed for sale)
  const cashSession = await prisma.cashSession.create({
    data: {
      cashRegisterId: 'test-register-id',
      openedById: user.id,
      openedAt: new Date(),
      openingAmount: 100.0
    }
  });

  // Create a product
  const product = await prisma.product.create({
    data: {
      name: 'Test Product',
      sku: 'TEST001',
      costPrice: 10.0,
      salePrice: 15.0,
      stockQuantity: 100,
      status: 'ACTIVE',
      categoryId: category.id
    }
  });

  console.log(`Created product with salePrice: ${product.salePrice}`);

  // Create a sale directly
  const sale = await prisma.sale.create({
    data: {
      saleNumber: 'TEST001',
      cashSessionId: cashSession.id,
      totalAmount: 105.0, // 7 * 15
      subtotal: 105.0,
      discountAmount: 0.0,
      status: 'PENDING',
      paidAmount: 0.0,
      changeAmount: 0.0,
      createdById: user.id
    }
  });

  console.log(`Created sale with totalAmount: ${sale.totalAmount}`);

  // Reload the sale
  const reloadedSale = await prisma.sale.findUnique({
    where: { id: sale.id }
  });

  console.log(`Reloaded sale totalAmount: ${reloadedSale?.totalAmount ?? 0}`);
}

testSaleTotal().catch(console.error);