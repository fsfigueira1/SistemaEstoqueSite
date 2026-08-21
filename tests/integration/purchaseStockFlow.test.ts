import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { PurchaseService } from '@/services/purchaseService';
import { StockService } from '@/services/stockService';
import { prisma } from '../setup';
import { cleanupDatabase, createAdminUser } from '../utils';

describe('Purchase → Stock Integration Flow', () => {
  let adminUser: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('Complete purchase → stock flow', () => {
    it('should create purchase and update stock correctly', async () => {
      // Create test supplier
      const supplier = await prisma.supplier.create({
        data: {
          name: 'Test Supplier',
        }
      });

      // Create test category first (required for Product)
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create test product
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          status: 'ACTIVE',
          minStockLevel: 5,
          sku: 'TEST001',
          costPrice: 10.0,
          salePrice: 15.0,
          categoryId: category.id
        }
      });

      // Create purchase data
      const purchaseData = {
        supplierId: supplier.id,
        createdById: adminUser.id,
        items: [
          { productId: product.id, quantity: 10, unitCost: 15.0 }
        ],
        paymentStatus: 'PAID',
        notes: 'Test purchase'
      };

      // Execute the flow through services
      // 1. Create purchase
      const purchase = await PurchaseService.createPurchase(purchaseData);

      expect(purchase).toBeDefined();
      expect(purchase.id).toBeDefined();
      expect(purchase.supplierId).toBe(supplier.id);
      expect(purchase.totalAmount).toBe(150.0); // 10 * 15.0
      expect(purchase.status).toBe('PENDING'); // Initial status is PENDING

      // 2. Update stock based on purchase
      for (const item of purchaseData.items) {
        const stockUpdate = await StockService.addStock({
          productId: item.productId,
          quantity: item.quantity,
          performedById: adminUser.id,
          reference: purchase.id,
          notes: 'Stock added from purchase'
        });

        expect(stockUpdate).toBeDefined();
        expect(stockUpdate.product.id).toBe(item.productId);
        expect(stockUpdate.product.stockQuantity).toBe(10); // Initial 0 + 10
        expect(stockUpdate.stockMovement).toBeDefined();
        expect(stockUpdate.stockMovement.type).toBe('PURCHASE');
        expect(stockUpdate.stockMovement.quantity).toBe(item.quantity);
      }

      // 3. Verify final stock levels
      const finalStock = await StockService.getStock(product.id);
      expect(finalStock).toBeDefined();
      expect(finalStock.currentStock).toBe(10);
      expect(finalStock.minStockLevel).toBe(5);
    });

    it('should handle multiple items in purchase correctly', async () => {
      // Create test supplier
      const supplier = await prisma.supplier.create({
        data: {
          name: 'Test Supplier',
        }
      });

      // Create test category first (required for Product)
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create test products
      const product1 = await prisma.product.create({
        data: {
          name: 'Test Product 1',
          status: 'ACTIVE',
          minStockLevel: 5,
          sku: 'TEST002',
          costPrice: 8.0,
          salePrice: 12.0,
          categoryId: category.id
        }
      });

      const product2 = await prisma.product.create({
        data: {
          name: 'Test Product 2',
          status: 'ACTIVE',
          minStockLevel: 3,
          sku: 'TEST003',
          costPrice: 15.0,
          salePrice: 22.0,
          categoryId: category.id
        }
      });

      // Create purchase data with multiple items
      const purchaseData = {
        supplierId: supplier.id,
        createdById: adminUser.id,
        items: [
          { productId: product1.id, quantity: 5, unitCost: 10.0 },
          { productId: product2.id, quantity: 3, unitCost: 20.0 }
        ],
        paymentStatus: 'PAID',
        notes: 'Multi-item purchase'
      };

      // Execute the flow through services
      // 1. Create purchase
      const purchase = await PurchaseService.createPurchase(purchaseData);

      expect(purchase).toBeDefined();
      expect(purchase.id).toBeDefined();
      expect(purchase.supplierId).toBe(supplier.id);
      expect(purchase.totalAmount).toBe(110.0); // (5*10) + (3*20) = 50 + 60 = 110
      expect(purchase.status).toBe('PENDING'); // Initial status is PENDING

      // 2. Update stock for each item
      for (const item of purchaseData.items) {
        const stockUpdate = await StockService.addStock({
          productId: item.productId,
          quantity: item.quantity,
          performedById: adminUser.id,
          reference: purchase.id,
          notes: 'Stock added from purchase'
        });

        expect(stockUpdate).toBeDefined();
        expect(stockUpdate.product.id).toBe(item.productId);
        expect(stockUpdate.product.stockQuantity).toBe(item.quantity); // Initial 0 + quantity
        expect(stockUpdate.stockMovement).toBeDefined();
        expect(stockUpdate.stockMovement.type).toBe('PURCHASE');
        expect(stockUpdate.stockMovement.quantity).toBe(item.quantity);
      }

      // 3. Verify final stock levels
      const finalStock1 = await StockService.getStock(product1.id);
      expect(finalStock1).toBeDefined();
      expect(finalStock1.currentStock).toBe(5); // 0 + 5
      expect(finalStock1.minStockLevel).toBe(5);

      const finalStock2 = await StockService.getStock(product2.id);
      expect(finalStock2).toBeDefined();
      expect(finalStock2.currentStock).toBe(3); // 0 + 3
      expect(finalStock2.minStockLevel).toBe(3);
    });
  });
});