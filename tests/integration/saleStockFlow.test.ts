import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { SaleService } from '@/services/saleService';
import { StockService } from '@/services/stockService';
import { ProductService } from '@/services/productService';
import { CustomerService } from '@/services/customerService';
import { CashSessionService } from '@/services/cashSessionService';
import { CashRegisterService } from '@/services/cashRegisterService';
import { prisma } from '../setup';
import { cleanupDatabase, createAdminUser } from '../utils';

describe('Sale → Stock Integration Flow', () => {
  let adminUser: any;
  let testCashRegister: any;
  let testCashSession: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();

    // Create a cash register for our tests
    testCashRegister = await CashRegisterService.createCashRegister({
      name: 'Test Register',
      description: 'Test description',
      isActive: true
    });

    // Open a cash session
    testCashSession = await CashSessionService.openCashSession({
      cashRegisterId: testCashRegister.id,
      openedById: adminUser.id,
      openingAmount: 100.0
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('Complete sale → stock flow', () => {
    it('should create sale and update stock correctly', async () => {
      // Create test customer
      const customer = await prisma.customer.create({
        data: {
          name: 'Test Customer'
        }
      });

      // Create category for test product
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          id: '11111111-1111-1111-1111-111111111111'
        }
      });

      // Create test product with initial stock
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: `TEST-${Date.now()}`,
          status: 'ACTIVE',
          minStockLevel: 5,
          costPrice: 10.0,
          salePrice: 25.0,
          categoryId: category.id
        }
      });

      // Add initial stock to product
      await StockService.addStock({
        productId: product.id,
        quantity: 10,
        performedById: adminUser.id
      });

      // Verify initial stock
      let initialStock = await StockService.getStock(product.id);
      expect(initialStock.currentStock).toBe(10);

      // Create sale data
      const saleData = {
        customerId: customer.id,
        cashSessionId: testCashSession.id,
        createdById: adminUser.id,
        items: [
          { productId: product.id, quantity: 3, unitPrice: 25.0 }
        ],
        notes: 'Test sale'
      };

      // Execute the flow through services
      // 1. Create sale
      const saleResult = await SaleService.createSale(saleData);
      const sale = saleResult.sale;

      expect(sale).toBeDefined();
      expect(sale.id).toBeDefined();
      expect(sale.customerId).toBe(customer.id);
      expect(sale.totalAmount).toBe(75.0); // 3 * 25.0
      expect(sale.status).toBe('PENDING'); // Sales start as PENDING, not COMPLETED

      // 2. Update stock based on sale (subtract quantity)
      for (const item of saleData.items) {
        const stockUpdate = await StockService.removeStock({
          productId: item.productId,
          quantity: item.quantity,
          performedById: adminUser.id
        });
        }

      // 3. Verify final stock levels
      const finalStock = await StockService.getStock(product.id);
      expect(finalStock).toBeDefined();
      expect(finalStock.currentStock).toBe(7); // 10 - 3
      expect(finalStock.minStockLevel).toBe(5);
    });

    it('should handle insufficient stock validation correctly', async () => {
      // Create test customer
      const customer = await prisma.customer.create({
        data: {
          name: 'Test Customer'
        }
      });

      // Create category for test product
      const category = await prisma.category.create({
        data: {
          name: 'Test Category 2',
          id: '22222222-2222-2222-2222-222222222222'
        }
      });

      // Create test product with limited stock
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: `TEST-LIMITED-${Date.now()}`,
          status: 'ACTIVE',
          minStockLevel: 5,
          costPrice: 10.0,
          salePrice: 25.0,
          categoryId: category.id
        }
      });

      // Add limited stock to product
      await StockService.addStock({
        productId: product.id,
        quantity: 3,
        performedById: adminUser.id
      });

      // Verify initial stock
      let initialStock = await StockService.getStock(product.id);
      expect(initialStock.currentStock).toBe(3);

      // Create sale data requesting more than available
      const saleData = {
        customerId: customer.id,
        cashSessionId: testCashSession.id,
        createdById: adminUser.id,
        items: [
          { productId: product.id, quantity: 5, unitPrice: 25.0 } // Trying to sell 5 but only have 3
        ],
        notes: 'Test sale - insufficient stock'
      };

      // Execute the flow and expect validation error
      await expect(SaleService.createSale(saleData))
        .rejects
        .toThrow('Insufficient stock');

      // Verify stock was NOT changed due to validation failure
      const finalStock = await StockService.getStock(product.id);
      expect(finalStock.currentStock).toBe(3); // Still 3, unchanged
      expect(finalStock.minStockLevel).toBe(5);
    });
  });
});