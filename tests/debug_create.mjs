import { prisma } from './setup.ts';

async function testCreate() {
  try {
    console.log('Creating category...');
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        id: '11111111-1111-1111-1111-111111111111'
      }
    });
    console.log('Category created:', category.id);

    console.log('Creating product...');
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'PURCHASETEST001',
        categoryId: category.id,
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 50,
        status: 'ACTIVE'
      }
    });
    console.log('Product created:', product.id);
  } catch (err) {
    console.error('Error:', err);
    // Let's see if we can get more details
    if (err.code === 'P2002') {
      console.log('Unique constraint violation');
    } else if (err.code === 'P2003') {
      console.log('Foreign key constraint violation');
      console.log('Failed constraint:', err.meta?.field_name);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCreate();