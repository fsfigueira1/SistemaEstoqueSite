import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { PriceHistoryService } from '../src/services/priceHistoryService';
import { ProductService } from '../src/services/productService';
import { prisma } from './setup';
import { Prisma } from '../src/lib/prisma';
import { cleanupDatabase, createAdminUser } from './utils';

describe('Price History Service', () => {
  let adminUser: Prisma.UserModel;
  let testCategory: Prisma.CategoryModel;
  let testProduct: Prisma.ProductModel;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();

    // Create a category for our tests
    testCategory = await prisma.category.create({
      data: {
        name: 'Test Category',
        description: 'Test description'
      }
    });

    // Create a product for our tests
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'PRICEHIST001',
        categoryId: testCategory.id,
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 50
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('getPriceHistoryById', () => {
    it('should return price history record by valid ID', async () => {
      // Create a price history record first
      const createdRecord = await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 10.0,
          newPrice: 12.0,
          changedById: adminUser.id,
          reason: 'Price increase'
        }
      });

      // Retrieve the record
      const record = await PriceHistoryService.getPriceHistoryById(createdRecord.id);

      expect(record).toBeDefined();
      expect(record.id).toBe(createdRecord.id);
      expect(record.productId).toBe(testProduct.id);
      expect(record.previousPrice).toBe(10.0);
      expect(record.newPrice).toBe(12.0);
      expect(record.changedById).toBe(adminUser.id);
      expect(record.reason).toBe('Price increase');
      expect(record.changedAt).toBeDefined();
    });

    it('should throw error for non-existent price history ID', async () => {
      await expect(
        PriceHistoryService.getPriceHistoryById('non-existent-id')
      ).rejects.toThrow('Price history record not found');
    });
  });

  describe('getPriceHistoryByProduct', () => {
    it('should return price history for a specific product', async () => {
      // Create multiple price history records
      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 10.0,
          newPrice: 12.0,
          changedById: adminUser.id,
          reason: 'First price increase'
        }
      });

      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 12.0,
          newPrice: 15.0,
          changedById: adminUser.id,
          reason: 'Second price increase'
        }
      });

      // Get price history for product
      const result = await PriceHistoryService.getPriceHistoryByProduct(testProduct.id);

      expect(result.priceHistory).toHaveLength(2);
      expect(result.pagination.total).toBe(2);

      // Should be ordered by changedAt descending (most recent first)
      const history = result.priceHistory;
      expect(history[0].newPrice).toBe(15.0); // Most recent
      expect(history[1].newPrice).toBe(12.0); // Older
    });

    it('should return empty array when no price history exists for product', async () => {
      // Create another product with no price history
      const otherProduct = await prisma.product.create({
        data: {
          name: 'Other Product',
          sku: 'OTHER001',
          categoryId: testCategory.id,
          costPrice: 20.0,
          salePrice: 25.0,
          stockQuantity: 30
        }
      });

      const result = await PriceHistoryService.getPriceHistoryByProduct(otherProduct.id);
      expect(result.priceHistory).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        PriceHistoryService.getPriceHistoryByProduct('non-existent-id')
      ).rejects.toThrow('Product not found');
    });
  });

  describe('getPriceHistory', () => {
    it('should return all price history records with filters', async () => {
      // Create a second product for testing
      const otherProduct = await prisma.product.create({
        data: {
          name: 'Other Product',
          sku: 'OTHER002',
          categoryId: testCategory.id,
          costPrice: 20.0,
          salePrice: 25.0,
          stockQuantity: 30
        }
      });

      // Create price history records for both products
      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 10.0,
          newPrice: 12.0,
          changedById: adminUser.id,
          reason: 'Price increase for test product'
        }
      });

      await prisma.priceHistory.create({
        data: {
          productId: otherProduct.id,
          previousPrice: 20.0,
          newPrice: 22.0,
          changedById: adminUser.id,
          reason: 'Price increase for other product'
        }
      });

      // Get all price history records
      const result = await PriceHistoryService.getPriceHistory({});

      expect(result.priceHistory).toHaveLength(2);
      expect(result.pagination.total).toBe(2);

      // Filter by productId
      const filteredResult = await PriceHistoryService.getPriceHistory({
        productId: testProduct.id
      });

      expect(filteredResult.priceHistory).toHaveLength(1);
      expect(filteredResult.pagination.total).toBe(1);
      expect(filteredResult.priceHistory[0].productId).toBe(testProduct.id);
    });

    it('should support pagination', async () => {
      // Create multiple price history records
      for (let i = 0; i < 5; i++) {
        await prisma.priceHistory.create({
          data: {
            productId: testProduct.id,
            previousPrice: 10.0 + i,
            newPrice: 12.0 + i,
            changedById: adminUser.id,
            reason: `Price increase #${i + 1}`
          }
        });
      }

      // Get first page (limit 2)
      const page1 = await PriceHistoryService.getPriceHistory({
        productId: testProduct.id,
        page: 1,
        limit: 2
      });

      expect(page1.priceHistory).toHaveLength(2);
      expect(page1.pagination.total).toBe(5);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(2);
      expect(page1.pagination.totalPages).toBe(3);

      // Get second page
      const page2 = await PriceHistoryService.getPriceHistory({
        productId: testProduct.id,
        page: 2,
        limit: 2
      });

      expect(page2.priceHistory).toHaveLength(2);
      expect(page2.pagination.page).toBe(2);

      // Get third page
      const page3 = await PriceHistoryService.getPriceHistory({
        productId: testProduct.id,
        page: 3,
        limit: 2
      });

      expect(page3.priceHistory).toHaveLength(1);
      expect(page3.pagination.page).toBe(3);
    });

    it('should support date filtering', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow

      // Create price history record
      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 10.0,
          newPrice: 12.0,
          changedById: adminUser.id,
          reason: 'Price increase'
        }
      });

      // Filter by startDate (should include record)
      const resultStart = await PriceHistoryService.getPriceHistory({
        startDate: past
      });
      expect(resultStart.pagination.total).toBeGreaterThanOrEqual(1);

      // Filter by endDate (should include record)
      const resultEnd = await PriceHistoryService.getPriceHistory({
        endDate: future
      });
      expect(resultEnd.pagination.total).toBeGreaterThanOrEqual(1);

      // Filter by future startDate (should exclude record)
      const resultFutureStart = await PriceHistoryService.getPriceHistory({
        startDate: future
      });
      expect(resultFutureStart.pagination.total).toBe(0);
    });
  });

  describe('getLatestPrice', () => {
    it('should return latest price for product with history', async () => {
      // Create price history records
      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 10.0,
          newPrice: 12.0,
          changedById: adminUser.id,
          reason: 'First price'
        }
      });

      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 12.0,
          newPrice: 15.0,
          changedById: adminUser.id,
          reason: 'Second price'
        }
      });

      const latest = await PriceHistoryService.getLatestPrice(testProduct.id);

      expect(latest.hasHistory).toBe(true);
      expect(latest.productId).toBe(testProduct.id);
      expect(latest.previousPrice).toBe(12.0);
      expect(latest.newPrice).toBe(15.0);
      expect(latest.changedById).toBe(adminUser.id);
      expect(latest.reason).toBe('Second price');
    });

    it('should indicate no history when product has no price changes', async () => {
      const latest = await PriceHistoryService.getLatestPrice(testProduct.id);

      expect(latest.hasHistory).toBe(false);
      expect(latest.productId).toBe(testProduct.id);
      expect(latest.currentCostPrice).toBe(10.0); // Original cost price
      expect(latest.currentSalePrice).toBe(15.0); // Original sale price
    });
  });

  describe('getPriceHistorySummary', () => {
    it('should return price history summary for product', async () => {
      // Create price history records
      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 10.0,
          newPrice: 12.0,
          changedById: adminUser.id,
          reason: 'First increase'
        }
      });

      await prisma.priceHistory.create({
        data: {
          productId: testProduct.id,
          previousPrice: 12.0,
          newPrice: 15.0,
          changedById: adminUser.id,
          reason: 'Second increase'
        }
      });

      const summary = await PriceHistoryService.getPriceHistorySummary(testProduct.id);

      expect(summary.productId).toBe(testProduct.id);
      expect(summary.totalChanges).toBe(2);
      expect(summary.currentPrice.costPrice).toBe(10.0);
      expect(summary.currentPrice.salePrice).toBe(15.0);
      expect(summary.firstChange?.newPrice).toBe(12.0);
      expect(summary.lastChange?.newPrice).toBe(15.0);
    });

    it('should handle product with no price history', async () => {
      const summary = await PriceHistoryService.getPriceHistorySummary(testProduct.id);

      expect(summary.productId).toBe(testProduct.id);
      expect(summary.totalChanges).toBe(0);
      expect(summary.firstChange).toBeNull();
      expect(summary.lastChange).toBeNull();
      expect(summary.currentPrice.costPrice).toBe(10.0);
      expect(summary.currentPrice.salePrice).toBe(15.0);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        PriceHistoryService.getPriceHistorySummary('non-existent-id')
      ).rejects.toThrow('Product not found');
    });
  });
});