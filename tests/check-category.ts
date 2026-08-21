import { prisma } from './setup';

async function check() {
  // Try to find one category to see its structure
  try {
    const category = await prisma.category.findFirst();
    if (category) {
      console.log('Category structure:', Object.keys(category));
    } else {
      console.log('No categories found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testCategory = await prisma.category.create({
          data: {
            // Let's see what's required
          }
        });
        console.log('Successfully created category with no fields:', testCategory);
      } catch (createError) {
        console.error('Error creating category with no fields:', (createError as Error).message);

        // Try with name (based on error messages)
        try {
          const testCategory2 = await prisma.category.create({
            data: {
              name: 'Test Category'
            }
          });
          console.log('Successfully created category with name:', testCategory2);
        } catch (createError2) {
          console.error('Error creating category with name:', (createError2 as Error).message);
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
