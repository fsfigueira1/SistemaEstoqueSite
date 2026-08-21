import { prisma } from './setup';

async function check() {
  // Try to find one purchase order to see its structure
  try {
    const po = await prisma.purchaseOrder.findFirst();
    if (po) {
      console.log('PurchaseOrder structure:', Object.keys(po));
    } else {
      console.log('No purchase orders found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testPO = await prisma.purchaseOrder.create({
          data: {
            // Let's see what's required
          }
        });
        console.log('Successfully created purchase order with no fields:', testPO);
      } catch (createError) {
        console.error('Error creating purchase order with no fields:', (createError as Error).message);

        // Try with required fields (based on error messages)
        try {
          const testPO2 = await prisma.purchaseOrder.create({
            data: {
              supplierId: 'test-supplier-id',
              createdById: 'test-user-id',
              totalAmount: 100.0
            }
          });
          console.log('Successfully created purchase order with basic fields:', testPO2);
        } catch (createError2) {
          console.error('Error creating purchase order with basic fields:', (createError2 as Error).message);
          
          // Show what happens when we try to reference non-existent entities
          try {
            const testSupplier = await prisma.supplier.create({
              data: {
                name: 'Test Supplier'
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
            
            const testPO3 = await prisma.purchaseOrder.create({
              data: {
                supplierId: testSupplier.id,
                createdById: testUser.id,
                totalAmount: 100.0
              }
            });
            console.log('Successfully created purchase order with entity references:', testPO3);
          } catch (createError3) {
            console.error('Error creating purchase order with entity references:', (createError3 as Error).message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
