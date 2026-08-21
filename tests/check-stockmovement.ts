import { prisma } from './setup';

async function check() {
  // Try to find one stock movement to see its structure
  try {
    const sm = await prisma.stockMovement.findFirst();
    if (sm) {
      console.log('StockMovement structure:', Object.keys(sm));
    } else {
      console.log('No stock movements found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testSM = await prisma.stockMovement.create({
          data: {
            // Let's see what's required
          }
        });
        console.log('Successfully created stock movement with no fields:', testSM);
      } catch (createError) {
        console.error('Error creating stock movement with no fields:', (createError as Error).message);

        // Try with required fields (based on error messages)
        try {
          const testSM2 = await prisma.stockMovement.create({
            data: {
              productId: 'test-product-id',
              performedById: 'test-user-id',
              quantity: 10,
              type: 'PURCHASE' as const
            }
          });
          console.log('Successfully created stock movement with basic fields:', testSM2);
        } catch (createError2) {
          console.error('Error creating stock movement with basic fields:', (createError2 as Error).message);
          
          // Show what happens when we try to reference non-existent entities
          try {
            const testProduct = await prisma.product.create({
              data: {
                name: 'Test Product',
                sku: 'TEST-SKU-' + Date.now(),
                categoryId: 'test-category-id'
              }
            });
            
            const testUser = await prisma.user.create({
              data: {
                email: 'test@example.com',
                name: 'Test User',
                password: 'hashed_password_123',
                role: 'USER' as const
              }
            });
            
            const testSM3 = await prisma.stockMovement.create({
              data: {
                productId: testProduct.id,
                performedById: testUser.id,
                quantity: 10,
                type: 'PURCHASE' as const
              }
            });
            console.log('Successfully created stock movement with entity references:', testSM3);
          } catch (createError3) {
            console.error('Error creating stock movement with entity references:', (createError3 as Error).message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
