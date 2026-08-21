import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { ProductService } from '../src/services/productService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

describe('Product Service', () => {
  let adminUser: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('createProduct', () => {
    it('should create a valid product', async () => {
      const productData = {
        name: 'Test Product',
        sku: 'TEST001',
        categoryId: '11111111-1111-1111-1111-111111111111',
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 100
      };

      // First create a category since it's required
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      const product = await ProductService.createProduct({
        ...productData,
        categoryId: category.id
      });

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe(productData.name);
      expect(product.sku).toBe(productData.sku);
      expect(product.costPrice).toBe(productData.costPrice);
      expect(product.salePrice).toBe(productData.salePrice);
      expect(product.stockQuantity).toBe(productData.stockQuantity);
      expect(product.status).toBe('ACTIVE');
    });

    it('should throw error when creating product with duplicate SKU', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create first product
      await ProductService.createProduct({
        name: 'First Product',
        sku: 'DUPLICATE-SKU',
        categoryId: category.id,
        costPrice: 10.0,
        salePrice: 15.0
      });

      // Try to create second product with same SKU
      await expect(
        ProductService.createProduct({
          name: 'Second Product',
          sku: 'DUPLICATE-SKU',
          categoryId: category.id,
          costPrice: 12.0,
          salePrice: 18.0
        })
      ).rejects.toThrow();
    });

    it('should throw error when creating product with negative cost price', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      await expect(
        ProductService.createProduct({
          name: 'Invalid Product',
          sku: 'INVALID001',
          categoryId: category.id,
          costPrice: -5.0, // Negative price
          salePrice: 10.0
        })
      ).rejects.toThrow('Cost price cannot be negative');
    });

    it('should throw error when creating product with negative sale price', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      await expect(
        ProductService.createProduct({
          name: 'Invalid Product',
          sku: 'INVALID002',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: -5.0 // Negative price
        })
      ).rejects.toThrow('Sale price cannot be negative');
    });
  });

  describe('getProductById', () => {
    it('should return product by valid ID', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const createdProduct = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'TEST001',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 50
        }
      });

      // Retrieve the product
      const product = await ProductService.getProductById(createdProduct.id);

      expect(product).toBeDefined();
      expect(product.id).toBe(createdProduct.id);
      expect(product.name).toBe(createdProduct.name);
      expect(product.sku).toBe(createdProduct.sku);
      expect(product.stockQuantity).toBe(createdProduct.stockQuantity);
    });

    it('should throw error for non-existent product ID', async () => {
      await expect(
        ProductService.getProductById('non-existent-id')
      ).rejects.toThrow('Product not found');
    });
  });

  describe('getProductBySku', () => {
    it('should return product by valid SKU', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const createdProduct = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'UNIQUE-SKU-123',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 25
        }
      });

      // Retrieve by SKU
      const product = await ProductService.getProductBySku(createdProduct.sku);

      expect(product).toBeDefined();
      if (product) {
        expect(product.id).toBe(createdProduct.id);
        expect(product.sku).toBe(createdProduct.sku);
      }
    });

    it('should return null for non-existent SKU', async () => {
      const product = await ProductService.getProductBySku('NON-EXISTENT');
      expect(product).toBeNull();
    });
  });

  describe('getProductByBarcode', () => {
    it('should return product by valid barcode', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product with barcode
      const createdProduct = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'SKU-BARCODE',
          barcode: '1234567890123',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 15
        }
      });

      // Retrieve by barcode
      const product = await ProductService.getProductByBarcode(createdProduct.barcode!);

      expect(product).toBeDefined();
      if (product) {
        expect(product.id).toBe(createdProduct.id);
        expect(product.barcode).toBe(createdProduct.barcode);
      }
    });

    it('should return null for non-existent barcode', async () => {
      const product = await ProductService.getProductByBarcode('0000000000000');
      expect(product).toBeNull();
    });

    it('should return null for product without barcode', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product without barcode
      await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'SKU-NO-BARCODE',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 10
          // No barcode specified
        }
      });

      // This should return null since we're searching for a barcode that doesn't exist
      const product = await ProductService.getProductByBarcode('9999999999999');
      expect(product).toBeNull();
    });
  });

  describe('updateProduct', () => {
    it('should update product price correctly', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const createdProduct = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'UPDATE-TEST',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 20
        }
      });

      // Update the product
      const updatedProduct = await ProductService.updateProduct(createdProduct.id, {
        salePrice: 20.0,
        costPrice: 12.0
      });

      expect(updatedProduct).toBeDefined();
      expect(updatedProduct.salePrice).toBe(20.0);
      expect(updatedProduct.costPrice).toBe(12.0);
      expect(updatedProduct.name).toBe(createdProduct.name); // Unchanged
      expect(updatedProduct.sku).toBe(createdProduct.sku); // Unchanged
    });

    it('should throw error when updating with negative cost price', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'UPDATE-NEGATIVE',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 20
        }
      });

      // Try to update with negative cost price
      await expect(
        ProductService.updateProduct(product.id, {
          costPrice: -5.0
        })
      ).rejects.toThrow('Cost price cannot be negative');
    });

    it('should throw error when updating with negative sale price', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'UPDATE-NEGATIVE-SALE',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 20
        }
      });

      // Try to update with negative sale price
      await expect(
        ProductService.updateProduct(product.id, {
          salePrice: -5.0
        })
      ).rejects.toThrow('Sale price cannot be negative');
    });
  });

  describe('deactivateProduct', () => {
    it('should deactivate product correctly', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'DEACTIVATE-TEST',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 30,
          status: 'ACTIVE'
        }
      });

      // Deactivate the product
      const deactivatedProduct = await ProductService.deactivateProduct(product.id, 'INACTIVE');

      expect(deactivatedProduct).toBeDefined();
      expect(deactivatedProduct.status).toBe('INACTIVE');
    });

    it('should deactivate product as discontinued', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create a product
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'DISCONTINUE-TEST',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 25,
          status: 'ACTIVE'
        }
      });

      // Discontinue the product
      const discontinuedProduct = await ProductService.deactivateProduct(product.id, 'DISCONTINUED');

      expect(discontinuedProduct).toBeDefined();
      expect(discontinuedProduct.status).toBe('DISCONTINUED');
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with stock at or below minimum level', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create product with low stock (stockQuantity <= minStockLevel)
      const lowStockProduct = await prisma.product.create({
        data: {
          name: 'Low Stock Product',
          sku: 'LOW-STOCK',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 3, // Below minStockLevel of 5
          minStockLevel: 5
        }
      });

      // Create product with adequate stock
      const adequateStockProduct = await prisma.product.create({
        data: {
          name: 'Adequate Stock Product',
          sku: 'ADEQUATE-STOCK',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 10, // Above minStockLevel of 5
          minStockLevel: 5
        }
      });

      // Create product with stock exactly at minimum level
      const minLevelProduct = await prisma.product.create({
        data: {
          name: 'Min Level Product',
          sku: 'MIN-LEVEL',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 5, // Equal to minStockLevel of 5
          minStockLevel: 5
        }
      });

      // Get low stock products
      const lowStockProducts = await ProductService.getLowStockProducts();

      // Should return 2 products (low stock and min level)
      expect(lowStockProducts).toHaveLength(2);

      // Check that the correct products are returned
      const skuList = lowStockProducts.map(p => p.sku);
      expect(skuList).toContain('LOW-STOCK');
      expect(skuList).toContain('MIN-LEVEL');
      expect(skuList).not.toContain('ADEQUATE-STOCK');
    });

    it('should return empty array when no products are low stock', async () => {
      // Create a category
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create products with stock above minimum level
      await prisma.product.create({
        data: {
          name: 'Product 1',
          sku: 'STOCK-1',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 20,
          minStockLevel: 5
        }
      });

      await prisma.product.create({
        data: {
          name: 'Product 2',
          sku: 'STOCK-2',
          categoryId: category.id,
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 15,
          minStockLevel: 5
        }
      });

      // Get low stock products
      const lowStockProducts = await ProductService.getLowStockProducts();

      // Should return empty array
      expect(lowStockProducts).toHaveLength(0);
    });
  });
});