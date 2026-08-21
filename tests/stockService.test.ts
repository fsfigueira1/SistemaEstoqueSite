import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { StockService } from '../src/services/stockService';
import { ProductService } from '../src/services/productService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

describe('Stock Service', () => {
  let adminUser: any;
  let testProduct: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();

    // Create a category for our test product
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        id: '11111111-1111-1111-1111-111111111111'
      }
    });

    // Create a test product
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'STOCK-TEST',
        categoryId: category.id,
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 10, // Starting stock
        minStockLevel: 5,
        maxStockLevel: 100
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('getStock', () => {
    it('should return current stock information for a product', async () => {
      const stockInfo = await StockService.getStock(testProduct.id);

      expect(stockInfo).toBeDefined();
      expect(stockInfo.productId).toBe(testProduct.id);
      expect(stockInfo.name).toBe(testProduct.name);
      expect(stockInfo.sku).toBe(testProduct.sku);
      expect(stockInfo.currentStock).toBe(testProduct.stockQuantity);
      expect(stockInfo.minStockLevel).toBe(testProduct.minStockLevel);
      expect(stockInfo.maxStockLevel).toBe(testProduct.maxStockLevel);
      expect(stockInfo.status).toBe(testProduct.status);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        StockService.getStock('non-existent-id')
      ).rejects.toThrow('Product not found');
    });
  });

  describe('addStock', () => {
    it('should add stock to product and create STOCK movements', async () => {
      const initialStock = testProduct.stockQuantity;
      const amountToAdd = 5;

      const result = await StockService.addStock({
        productId: testProduct.id,
        quantity: amountToAdd,
        performedById: adminUser.id
      });

      // Check that stock was increased
      expect(result.product.stockQuantity).toBe(initialStock + amountToAdd);

      // Check that a stock movement was created
      expect(result.stockMovement).toBeDefined();
      expect(result.stockMovement.productId).toBe(testProduct.id);
      expect(result.stockMovement.type).toBe('PURCHASE'); // Adding stock is PURCHASE
      expect(result.stockMovement.quantity).toBe(amountToAdd);
      expect(result.stockMovement.performedById).toBe(adminUser.id);

      // Verify in database
      const updatedProduct = await prisma.product.findUnique({
        where: { id: testProduct.id }
      });
      expect(updatedProduct?.stockQuantity).toBe(initialStock + amountToAdd);

      const movements = await prisma.stockMovement.findMany({
        where: { productId: testProduct.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('PURCHASE');
      expect(movements[0].quantity).toBe(amountToAdd);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        StockService.addStock({
          productId: 'non-existent-id',
          quantity: 5,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Product not found');
    });

    it('should throw error for inactive product', async () => {
      // Make product inactive
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { status: 'INACTIVE' }
      });

      await expect(
        StockService.addStock({
          productId: testProduct.id,
          quantity: 5,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Cannot modify stock for inactive or discontinued product');
    });

    it('should throw error for non-positive quantity', async () => {
      await expect(
        StockService.addStock({
          productId: testProduct.id,
          quantity: 0,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Quantity must be positive');

      await expect(
        StockService.addStock({
          productId: testProduct.id,
          quantity: -5,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Quantity must be positive');
    });
  });

  describe('removeStock', () => {
    it('should remove stock from product and create SALE movements', async () => {
      const initialStock = testProduct.stockQuantity;
      const amountToRemove = 3;

      const result = await StockService.removeStock({
        productId: testProduct.id,
        quantity: amountToRemove,
        performedById: adminUser.id
      });

      // Check that stock was decreased
      expect(result.product.stockQuantity).toBe(initialStock - amountToRemove);

      // Check that a stock movement was created
      expect(result.stockMovement).toBeDefined();
      expect(result.stockMovement.productId).toBe(testProduct.id);
      expect(result.stockMovement.type).toBe('SALE'); // Removing stock is SALE
      expect(result.stockMovement.quantity).toBe(amountToRemove);
      expect(result.stockMovement.performedById).toBe(adminUser.id);

      // Verify in database
      const updatedProduct = await prisma.product.findUnique({
        where: { id: testProduct.id }
      });
      expect(updatedProduct?.stockQuantity).toBe(initialStock - amountToRemove);

      const movements = await prisma.stockMovement.findMany({
        where: { productId: testProduct.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('SALE');
      expect(movements[0].quantity).toBe(amountToRemove);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        StockService.removeStock({
          productId: 'non-existent-id',
          quantity: 3,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Product not found');
    });

    it('should throw error for inactive product', async () => {
      // Make product inactive
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { status: 'INACTIVE' }
      });

      await expect(
        StockService.removeStock({
          productId: testProduct.id,
          quantity: 3,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Cannot modify stock for inactive or discontinued product');
    });

    it('should throw error when removing more stock than available', async () => {
      await expect(
        StockService.removeStock({
          productId: testProduct.id,
          quantity: 15, // More than available (10)
          performedById: adminUser.id
        })
      ).rejects.toThrow(/Insufficient stock/);

      // Verify stock wasn't changed
      const product = await prisma.product.findUnique({
        where: { id: testProduct.id }
      });
      expect(product?.stockQuantity).toBe(testProduct.stockQuantity);
    });

    it('should throw error for non-positive quantity', async () => {
      await expect(
        StockService.removeStock({
          productId: testProduct.id,
          quantity: 0,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Quantity must be positive');

      await expect(
        StockService.removeStock({
          productId: testProduct.id,
          quantity: -3,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Quantity must be positive');
    });
  });

  describe('adjustStock', () => {
    it('should increase stock when target is higher than current', async () => {
      const initialStock = testProduct.stockQuantity; // 10
      const targetQuantity = 15;
      const difference = targetQuantity - initialStock; // 5

      const result = await StockService.adjustStock({
        productId: testProduct.id,
        quantity: targetQuantity,
        performedById: adminUser.id
      });

      // Check that stock was adjusted to target
      expect(result.product.stockQuantity).toBe(targetQuantity);

      // Check that a stock movement was created for the increase
      expect(result.stockMovement).toBeDefined();
      expect(result.stockMovement.productId).toBe(testProduct.id);
      expect(result.stockMovement.type).toBe('ADJUSTMENT_IN'); // Increase
      expect(result.stockMovement.quantity).toBe(difference);
      expect(result.stockMovement.performedById).toBe(adminUser.id);
    });

    it('should decrease stock when target is lower than current', async () => {
      const initialStock = testProduct.stockQuantity; // 10
      const targetQuantity = 6;
      const difference = initialStock - targetQuantity; // 4

      const result = await StockService.adjustStock({
        productId: testProduct.id,
        quantity: targetQuantity,
        performedById: adminUser.id
      });

      // Check that stock was adjusted to target
      expect(result.product.stockQuantity).toBe(targetQuantity);

      // Check that a stock movement was created for the decrease
      expect(result.stockMovement).toBeDefined();
      expect(result.stockMovement.productId).toBe(testProduct.id);
      expect(result.stockMovement.type).toBe('ADJUSTMENT_OUT'); // Decrease
      expect(result.stockMovement.quantity).toBe(difference);
      expect(result.stockMovement.performedById).toBe(adminUser.id);
    });

    it('should return early when no adjustment needed', async () => {
      const currentStock = testProduct.stockQuantity;

      const result = await StockService.adjustStock({
        productId: testProduct.id,
        quantity: currentStock, // Same as current
        performedById: adminUser.id
      });

      // Should return early with no movement
      expect(result.stockMovement).toBeNull();
      expect(result.product.stockQuantity).toBe(currentStock);
      expect((result as { message: string }).message).toBe('No adjustment needed - current stock matches target');
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        StockService.adjustStock({
          productId: 'non-existent-id',
          quantity: 15,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Product not found');
    });

    it('should throw error for inactive product', async () => {
      // Make product inactive
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { status: 'INACTIVE' }
      });

      await expect(
        StockService.adjustStock({
          productId: testProduct.id,
          quantity: 15,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Cannot modify stock for inactive or discontinued product');
    });

    it('should throw error for non-positive quantity', async () => {
      await expect(
        StockService.adjustStock({
          productId: testProduct.id,
          quantity: 0,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Quantity must be positive');

      await expect(
        StockService.adjustStock({
          productId: testProduct.id,
          quantity: -5,
          performedById: adminUser.id
        })
      ).rejects.toThrow('Quantity must be positive');
    });
  });

  describe('getStockMovements', () => {
    it('should return stock movements for a product', async () => {
      // Perform some stock operations
      await StockService.addStock({
        productId: testProduct.id,
        quantity: 5,
        performedById: adminUser.id
      });

      await StockService.removeStock({
        productId: testProduct.id,
        quantity: 3,
        performedById: adminUser.id
      });

      // Get stock movements
      const movements = await StockService.getStockMovements(testProduct.id);

      expect(movements).toBeDefined();
      expect(movements.movements).toHaveLength(2);

      // Check first movement (most recent first due to orderBy desc)
      const firstMovement = movements.movements[0];
      expect(firstMovement.type).toBe('SALE'); // removeStock was called second
      expect(firstMovement.quantity).toBe(3);

      // Check second movement
      const secondMovement = movements.movements[1];
      expect(secondMovement.type).toBe('PURCHASE'); // addStock was called first
      expect(secondMovement.quantity).toBe(5);

      // Check pagination info
      expect(movements.pagination).toBeDefined();
      expect(movements.pagination.total).toBe(2);
    });

    it('should filter movements by type', async () => {
      // Perform operations
      await StockService.addStock({
        productId: testProduct.id,
        quantity: 5,
        performedById: adminUser.id
      });

      await StockService.removeStock({
        productId: testProduct.id,
        quantity: 3,
        performedById: adminUser.id
      });

      // Get only PURCHASE movements
      const purchaseMovements = await StockService.getStockMovements(testProduct.id, {
        type: 'PURCHASE'
      });

      expect(purchaseMovements.movements).toHaveLength(1);
      expect(purchaseMovements.movements[0].type).toBe('PURCHASE');

      // Get only SALE movements
      const saleMovements = await StockService.getStockMovements(testProduct.id, {
        type: 'SALE'
      });

      expect(saleMovements.movements).toHaveLength(1);
      expect(saleMovements.movements[0].type).toBe('SALE');
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        StockService.getStockMovements('non-existent-id')
      ).rejects.toThrow('Product not found');
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with stock at or below minimum level', async () => {
      // Create a product with low stock
      const lowStockProduct = await prisma.product.create({
        data: {
          name: 'Low Stock Product',
          sku: 'LOW-STOCK-001',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 3, // Below minStockLevel of 5
          minStockLevel: 5,
          maxStockLevel: 100
        }
      });

      // Create a product with adequate stock
      const adequateStockProduct = await prisma.product.create({
        data: {
          name: 'Adequate Stock Product',
          sku: 'ADEQUATE-STOCK-001',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 10, // Above minStockLevel of 5
          minStockLevel: 5,
          maxStockLevel: 100
        }
      });

      // Get low stock products
      const lowStockProducts = await StockService.getLowStockProducts();

      // Should return 1 product (the low stock one)
      expect(lowStockProducts).toHaveLength(1);
      expect(lowStockProducts[0].sku).toBe('LOW-STOCK-001');
    });

    it('should return empty array when no products are low stock', async () => {
      // Create products with stock above minimum level
      await prisma.product.create({
        data: {
          name: 'Product 1',
          sku: 'STOCK-1',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 20,
          minStockLevel: 5,
          maxStockLevel: 100
        }
      });

      await prisma.product.create({
        data: {
          name: 'Product 2',
          sku: 'STOCK-2',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 15,
          minStockLevel: 5,
          maxStockLevel: 100
        }
      });

      // Get low stock products
      const lowStockProducts = await StockService.getLowStockProducts();

      // Should return empty array
      expect(lowStockProducts).toHaveLength(0);
    });

    it('should include products with stock exactly at minimum level', async () => {
      // Create a product with stock exactly at minimum level
      const minLevelProduct = await prisma.product.create({
        data: {
          name: 'Min Level Product',
          sku: 'MIN-LEVEL-001',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 5, // Equal to minStockLevel of 5
          minStockLevel: 5,
          maxStockLevel: 100
        }
      });

      // Get low stock products
      const lowStockProducts = await StockService.getLowStockProducts();

      // Should return 1 product (the min level one)
      expect(lowStockProducts).toHaveLength(1);
      expect(lowStockProducts[0].sku).toBe('MIN-LEVEL-001');
    });
  });

  describe('getOutOfStockProducts', () => {
    it('should return products with zero stock', async () => {
      // Create a product with zero stock
      const outOfStockProduct = await prisma.product.create({
        data: {
          name: 'Out of Stock Product',
          sku: 'OUT-OF-STOCK-001',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 0, // Out of stock
          minStockLevel: 5,
          maxStockLevel: 100,
          status: 'ACTIVE'
        }
      });

      // Create a product with stock
      const inStockProduct = await prisma.product.create({
        data: {
          name: 'In Stock Product',
          sku: 'IN-STOCK-001',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 10,
          minStockLevel: 5,
          maxStockLevel: 100,
          status: 'ACTIVE'
        }
      });

      // Get out of stock products
      const outOfStockProducts = await StockService.getOutOfStockProducts();

      // Should return 1 product (the out of stock one)
      expect(outOfStockProducts).toHaveLength(1);
      expect(outOfStockProducts[0].sku).toBe('OUT-OF-STOCK-001');
      expect(outOfStockProducts[0].stockQuantity).toBe(0);
    });

    it('should return empty array when no products are out of stock', async () => {
      // Create products with stock
      await prisma.product.create({
        data: {
          name: 'Product 1',
          sku: 'STOCK-1',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 10,
          minStockLevel: 5,
          maxStockLevel: 100,
          status: 'ACTIVE'
        }
      });

      await prisma.product.create({
        data: {
          name: 'Product 2',
          sku: 'STOCK-2',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 15,
          minStockLevel: 5,
          maxStockLevel: 100,
          status: 'ACTIVE'
        }
      });

      // Get out of stock products
      const outOfStockProducts = await StockService.getOutOfStockProducts();

      // Should return empty array
      expect(outOfStockProducts).toHaveLength(0);
    });

    it('should not return inactive products even if they have zero stock', async () => {
      // Create an inactive product with zero stock
      await prisma.product.create({
        data: {
          name: 'Inactive Product',
          sku: 'INACTIVE-ZERO',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 10.0,
          salePrice: 15.0,
          stockQuantity: 0,
          minStockLevel: 5,
          maxStockLevel: 100,
          status: 'INACTIVE' // Inactive
        }
      });

      // Get out of stock products
      const outOfStockProducts = await StockService.getOutOfStockProducts();

      // Should return empty array (inactive products are excluded)
      expect(outOfStockProducts).toHaveLength(0);
    });
  });
});