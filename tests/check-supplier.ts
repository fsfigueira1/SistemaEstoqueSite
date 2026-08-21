import { prisma } from './setup';

async function check() {
  // Try to find one supplier to see its structure
  try {
    const supplier = await prisma.supplier.findFirst();
    if (supplier) {
      console.log('Supplier structure:', Object.keys(supplier));
    } else {
      console.log('No suppliers found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testSupplier = await prisma.supplier.create({
          data: {
            // Let's see what's required
          }
        });
        console.log('Successfully created supplier with no fields:', testSupplier);
      } catch (createError) {
        console.error('Error creating supplier with no fields:', (createError as Error).message);

        // Try with name (based on error messages)
        try {
          const testSupplier2 = await prisma.supplier.create({
            data: {
              name: 'Test Supplier'
            }
          });
          console.log('Successfully created supplier with name:', testSupplier2);
        } catch (createError2) {
          console.error('Error creating supplier with name:', (createError2 as Error).message);
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
