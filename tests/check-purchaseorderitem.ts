import { prisma } from './setup';

async function check() {
  // Try to find one purchase order item to see its structure
  try {
    const poi = await prisma.purchaseOrderItem.findFirst();
    if (poi) {
      console.log('PurchaseOrderItem structure:', Object.keys(poi));
    } else {
      console.log('No purchase order items found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testPOI = await prisma.purchaseOrderItem.create({
          data: {
            // Let's see what's required
          }
        });
        console.log('Successfully created purchase order item with no fields:', testPOI);
      } catch (createError) {
        console.error('Error creating purchase order item with no fields:', (createError as Error).message);

        // Try with required fields (based on error messages)
        try {
          const testPOI2 = await prisma.purchaseOrderItem.create({
            data: {
              purchaseOrderId: 'test-po-id',
              productId: 'test-product-id',
              quantity: 5,
              unitPrice: 10.0
            }
          });
          console.log('Successfully created purchase order item with basic fields:', testPOI2);
        } catch (createError2) {
          console.error('Error creating purchase order item with basic fields:', (createError2 as Error).message);
          
          // Show what happens when we try to reference non-existent entities
          try {
            const testPO = await prisma.purchaseOrder.create({
              data: {
                supplierId: 'test-supplier-id',
                createdById: 'test-user-id',
                totalAmount: 100.0
              }
            });
            
            const testProduct = await prisma.product.create({
              data: {
                name: 'Test Product',
                sku: 'TEST-SKU-' + Date.now(),
                categoryId: 'test-category-id'
              }
            });
            
            const testPOI3 = await prisma.purchaseOrderItem.create({
              data: {
                purchaseOrderId: testPO.id,
                productId: testProduct.id,
                quantity: 5,
                unitPrice: 10.0
              }
            });
            console.log('Successfully created purchase order item with entity references:', testPOI3);
          } catch (createError3) {
            console.error('Error creating purchase order item with entity references:', (createError3 as Error).message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
