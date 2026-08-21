import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { SaleService } from '@/services/saleService';
import { CashMovementService } from '@/services/cashMovementService';
import { CustomerService } from '@/services/customerService';
import { ProductService } from '@/services/productService';
import { prisma } from '../setup';
import { cleanupDatabase, createAdminUser } from '../utils';
import { PaymentMethod } from '@/generated/prisma/client';

describe('Sale → Payment Integration Flow', () => {
  let adminUser: any;
  let testProduct: any;
  let testCategory: any;
  let testCashSession: any;

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

    // Create a test product
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'TEST-PROD-001',
        status: 'ACTIVE',
        categoryId: testCategory.id,
        stockQuantity: 100,
        costPrice: 10.0,
        salePrice: 50.0
      }
    });

    // Create a cash register and session for testing
    const testCashRegister = await prisma.cashRegister.create({
      data: {
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      }
    });

    testCashSession = await prisma.cashSession.create({
      data: {
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openedAt: new Date(),
        openingAmount: 100.0,
        status: 'OPEN'
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('Complete sale → payment flow', () => {
    it('should create sale and process payment correctly', async () => {
      // Create test customer (Customer model doesn't accept status in create)
      const customer = await prisma.customer.create({
        data: {
          name: 'Test Customer'
          // Note: Customer status is managed differently, not settable in create
        }
      });

      // Create sale data
      const saleData = {
        cashSessionId: testCashSession.id,
        createdById: adminUser.id,
        customerId: customer.id,
        items: [
          { productId: testProduct.id, quantity: 2, unitPrice: 30.0 }
        ],
        notes: 'Test sale for payment processing'
      };

      // Execute the flow through services
      // 1. Create sale (initially with pending payment)
      const saleResult = await SaleService.createSale(saleData);
      const sale = await SaleService.getSale(saleResult.sale.id);

      expect(sale).toBeDefined();
      expect(sale.id).toBeDefined();
      expect(sale.customerId).toBe(customer.id);
      expect(sale.totalAmount).toBe(60.0); // 2 * 30.0
      expect(sale.status).toBe('PENDING');

      // 2. Process payment for the sale - completeSale returns the updated sale
      const completedSale = await SaleService.completeSale(sale.id, {
        amount: 60.0,
        method: PaymentMethod.CASH,
        processedById: adminUser.id
      });

      expect(completedSale).toBeDefined();
      expect(completedSale.id).toBe(sale.id);
      // completeSale returns the updated sale with COMPLETED status
      expect(completedSale.status).toBe('COMPLETED');
      expect(completedSale.paidAmount).toBe(60.0);
      expect(completedSale.totalAmount).toBe(60.0);
    });

    it('should handle payment processing for different payment methods', async () => {
      // Create test customer
      const customer = await prisma.customer.create({
        data: {
          name: 'Test Customer'
          // Note: Customer status is managed differently, not settable in create
        }
      });

      // Create sale data
      const saleData = {
        cashSessionId: testCashSession.id,
        createdById: adminUser.id,
        customerId: customer.id,
        items: [
          { productId: testProduct.id, quantity: 1, unitPrice: 45.50 }
        ],
        notes: 'Test sale for card payment'
      };

      // Execute the flow through services
      // 1. Create sale
      const saleResult = await SaleService.createSale(saleData);
      const sale = await SaleService.getSale(saleResult.sale.id);

      expect(sale).toBeDefined();
      expect(sale.id).toBeDefined();
      expect(sale.customerId).toBe(customer.id);
      expect(sale.totalAmount).toBe(45.50);
      expect(sale.status).toBe('PENDING');

      // 2. Process card payment
      await SaleService.completeSale(sale.id, {
        amount: 45.50,
        method: PaymentMethod.CREDIT_CARD,
        processedById: adminUser.id
      });

      // Verify the sale is now completed
      const updatedSale = await SaleService.getSale(sale.id);
      expect(updatedSale.status).toBe('COMPLETED');
    });
  });
});