import { describe, it, expect } from 'vitest';
import { ProductService } from '../src/services/productService';

// We need to access the private prisma instance to check its URL
// Since it's not exported, we'll test by trying to create a product
// and see if it works with our test setup

describe('Service Environment Test', () => {
  it('should show NODE_ENV', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV);
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it('should be able to create a product using the service', async () => {
    // First create a category using the test prisma
    const setup = await import('../tests/setup');
    const prisma = setup.prisma;

    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        id: '11111111-1111-1111-1111-111111111111'
      }
    });

    console.log('Created category:', category.id);

    // Now try to create a product using the service
    const productData = {
      name: 'Test Product',
      sku: 'TEST001',
      categoryId: category.id,
      costPrice: 10.0,
      salePrice: 15.0,
      stockQuantity: 100
    };

    try {
      const product = await ProductService.createProduct(productData);
      console.log('Created product:', product);
      expect(product).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.sku).toBe('TEST001');
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  });
});