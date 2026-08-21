import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { SaleService } from '@/services/saleService';
import { CashSessionService } from '@/services/cashSessionService';
import { CashMovementService } from '@/services/cashMovementService';
import { UserService } from '@/services/userService';
import { StockService } from '@/services/stockService';
import { prisma } from '../setup';
import { cleanupDatabase, createAdminUser } from '../utils';
import { PaymentMethod, SaleStatus } from '@/generated/prisma/client';

describe('Sale → Cash Integration Flow', () => {
  let adminUser: any;
  let testCashRegister: any;
  let testCashSession: any;
  let testCategory: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();

    // Create a test category
    testCategory = await prisma.category.create({
      data: {
        name: 'Test Category',
        description: 'Test category for integration tests'
      }
    });

    // Create a cash register for our tests
    testCashRegister = await prisma.cashRegister.create({
      data: {
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      }
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

  describe('Complete sale → cash flow', () => {
    it('should process sales and update cash register correctly', async () => {
      // Create test products
      const product1 = await prisma.product.create({
        data: {
          name: 'Product A',
          sku: 'PROD-A-001',
          status: 'ACTIVE',
          minStockLevel: 5,
          categoryId: testCategory.id
        }
      });

      const product2 = await prisma.product.create({
        data: {
          name: 'Product B',
          sku: 'PROD-B-001',
          status: 'ACTIVE',
          minStockLevel: 3,
          categoryId: testCategory.id
        }
      });

      // Add initial stock
      await StockService.addStock({
        productId: product1.id,
        quantity: 10,
        performedById: adminUser.id,
        reference: 'initial-setup'
      });

      await StockService.addStock({
        productId: product2.id,
        quantity: 10,
        performedById: adminUser.id,
        reference: 'initial-setup'
       });

      // Create cash sale data
      const saleData = {
        cashSessionId: testCashSession.id,
        createdById: adminUser.id,
        items: [
          { productId: product1.id, quantity: 1, unitPrice: 25.0 },
          { productId: product2.id, quantity: 2, unitPrice: 15.0 }
        ],
        notes: 'Cash sale'
      };

      // Execute the flow through services
      // 1. Create cash sale (starts as PENDING)
      const saleResult = await SaleService.createSale(saleData);
      // Get the sale with items populated
      const sale = await SaleService.getSale(saleResult.sale.id);

      expect(sale).toBeDefined();
      expect(sale.id).toBeDefined();
      expect(sale.items).toHaveLength(2);
      expect(sale.totalAmount).toBe(55.0); // (1*25) + (2*15) = 25 + 30 = 55
      expect(sale.status).toBe(SaleStatus.PENDING);

      // 2. Complete the sale with payment
      const completedSaleResult = await SaleService.completeSale(sale.id, {
        amount: 55.0,
        method: PaymentMethod.CASH,
        processedById: adminUser.id,
        notes: 'Cash sale payment'
      });
      // Get the completed sale with items populated
      const completedSale = await SaleService.getSale(completedSaleResult.id);

      expect(completedSale).toBeDefined();
      expect(completedSale.id).toBeDefined();
      expect(completedSale.items).toHaveLength(2);
      expect(completedSale.totalAmount).toBe(55.0);
      expect(completedSale.status).toBe(SaleStatus.COMPLETED);

      // 3. Record cash transaction (handled automatically by completeSale)
      // Get the cash movements to verify
      const movements = await CashMovementService.getCashMovementsBySession(testCashSession.id);
      const saleMovement = movements.movements.find(m => m.type === 'SALE');

      expect(saleMovement).toBeDefined();
      expect(saleMovement.amount).toBe(55.0);
      expect(saleMovement.type).toBe('SALE');
      expect(saleMovement.description).toContain('Sale');

      // 4. Verify final stock levels
      const finalStock1 = await StockService.getStock(product1.id);
      expect(finalStock1.currentStock).toBe(9); // 10 - 1

      const finalStock2 = await StockService.getStock(product2.id);
      expect(finalStock2.currentStock).toBe(8); // 10 - 2
    });

    it('should handle cash sales and track cash position correctly', async () => {
      // Create test product
      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          sku: 'TEST-PROD-001',
          status: 'ACTIVE',
          minStockLevel: 5,
          categoryId: testCategory.id
        }
      });

      // Add initial stock
      await StockService.addStock({
        productId: product.id,
        quantity: 20,
        performedById: adminUser.id,
        reference: 'initial-setup'
      });

      // Process multiple cash sales
      const salesData = [
        {
          items: [{ productId: product.id, quantity: 2, unitPrice: 10.0 }],
          paymentStatus: 'PAID',
          paymentMethod: PaymentMethod.CASH,
          notes: 'Cash sale 1'
        },
        {
          items: [{ productId: product.id, quantity: 3, unitPrice: 10.0 }],
          paymentStatus: 'PAID',
          paymentMethod: PaymentMethod.CASH,
          notes: 'Cash sale 2'
        },
        {
          items: [{ productId: product.id, quantity: 1, unitPrice: 10.0 }],
          paymentStatus: 'PAID',
          paymentMethod: PaymentMethod.CASH,
          notes: 'Cash sale 3'
        }
      ];

      let totalCashExpected = 0;
      let totalQuantitySold = 0;

      // Process each sale
      for (const saleData of salesData) {
        // Create sale
        const saleResult = await SaleService.createSale({
          ...saleData,
          cashSessionId: testCashSession.id,
          createdById: adminUser.id
        });
        // Get the sale with items populated
        const sale = await SaleService.getSale(saleResult.sale.id);
        expect(sale).toBeDefined();
        expect(sale.totalAmount).toBe(saleData.items[0].quantity * saleData.items[0].unitPrice);

        // Complete the sale
        await SaleService.completeSale(sale.id, {
          amount: sale.totalAmount,
          method: PaymentMethod.CASH,
          processedById: adminUser.id
        });

        totalCashExpected += sale.totalAmount;
        totalQuantitySold += saleData.items[0].quantity;
      }

      // Verify total cash processed
      expect(totalCashExpected).toBe(60.0); // (2*10) + (3*10) + (1*10) = 20 + 30 + 10 = 60
      expect(totalQuantitySold).toBe(6); // 2 + 3 + 1 = 6

      // Verify final stock
      const finalStock = await StockService.getStock(product.id);
      expect(finalStock.currentStock).toBe(14); // 20 - 6 = 14
    });
  });
});