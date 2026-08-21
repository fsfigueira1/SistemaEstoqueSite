import { prisma } from './setup';

async function check() {
  // Try to find one product to see its structure
  try {
    const product = await prisma.product.findFirst();
    if (product) {
      console.log('Product structure:', Object.keys(product));
    } else {
      console.log('No products found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testProduct = await prisma.product.create({
          data: {
            // Let's see what's required
          }
        });
        console.log('Successfully created product with no fields:', testProduct);
      } catch (createError) {
        console.error('Error creating product with no fields:', (createError as Error).message);

        // Try with required fields (based on error messages)
        try {
          const testProduct2 = await prisma.product.create({
            data: {
              name: 'Test Product',
              sku: 'TEST-SKU-' + Date.now(),
              categoryId: 'test-category-id' // This will fail but shows what's needed
            }
          });
          console.log('Successfully created product with basic fields:', testProduct2);
        } catch (createError2) {
          console.error('Error creating product with basic fields:', (createError2 as Error).message);
          
          // Show what happens when we try to reference a non-existent category
          try {
            const testCategory = await prisma.category.create({
              data: {
                name: 'Test Category for Product'
              }
            });
            
            const testProduct3 = await prisma.product.create({
              data: {
                name: 'Test Product',
                sku: 'TEST-SKU-' + Date.now(),
                categoryId: testCategory.id
              }
            });
            console.log('Successfully created product with category reference:', testProduct3);
          } catch (createError3) {
            console.error('Error creating product with category reference:', (createError3 as Error).message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
