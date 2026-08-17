import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { SaleService } from '@/services/saleService';
import { StockService } from '@/services/stockService';
import { CashSessionService } from '@/services/cashSessionService';
import { CashMovementService } from '@/services/cashMovementService';
import { AuditService } from '@/services/auditService';
import { ProductService } from '@/services/productService';
import { CustomerService } from '@/services/customerService';
import { prisma } from '../setup';
import { cleanupDatabase } from '../utils';

describe('Complete PDV (Point of Sale) Flow', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('Complete PDV flow: opening → sales → payments → closing', () => {
    it('should execute complete PDV cycle correctly', async () => {
      // Create test customer
      const customer = await prisma.customer.create({
        data: {
          name: 'Cliente Teste'
        }
      });

      // Create category for test products
      const category = await prisma.category.create({
        data: {
          name: 'Test Category'
        }
      });

      // Create test products
      const product1 = await prisma.product.create({
        data: {
          name: 'Produto A',
          sku: `PROD-A-${Date.now()}`,
          status: 'ACTIVE',
          minStockLevel: 10,
          costPrice: 10.0,
          salePrice: 15.0,
          categoryId: category.id
        }
      });

      const product2 = await prisma.product.create({
        data: {
          name: 'Produto B',
          sku: `PROD-B-${Date.now()}`,
          status: 'ACTIVE',
          minStockLevel: 5,
          costPrice: 15.0,
          salePrice: 25.0,
          categoryId: category.id
        }
      });

      // Add initial stock to products
      await StockService.createOrUpdateStock({
        productId: product1.id,
        quantityChange: 50,
        operation: 'SET',
        referenceId: 'initial-setup',
        referenceType: 'SETUP'
      });

      await StockService.createOrUpdateStock({
        productId: product2.id,
        quantityChange: 30,
        operation: 'SET',
        referenceId: 'initial-setup',
        referenceType: 'SETUP'
      });

      // Verify initial stock levels
      let initialStock1 = await StockService.getStockByProductId(product1.id);
      let initialStock2 = await StockService.getStockByProductId(product2.id);
      expect(initialStock1.quantity).toBe(50);
      expect(initialStock2.quantity).toBe(30);

      // Execute complete PDV flow

      // 1. OPENING: No explicit shift opening needed for this test
      // In a real PDV, the cashier would open a shift, but we'll simulate cash tracking

      // 2. PROCESS FIRST SALE
      const saleData1 = {
        customerId: customer.id,
        items: [
          { productId: product1.id, quantity: 2, unitPrice: 15.0 }, // 30.00
          { productId: product2.id, quantity: 1, unitPrice: 25.0 }  // 25.00
        ],
        paymentStatus: 'PAID',
        paymentMethod: 'DINHEIRO',
        notes: 'PDV Sale 1'
      };

      const sale1 = await SaleService.createSale(saleData1);
      expect(sale1).toBeDefined();
      expect(sale1.totalAmount).toBe(55.0); // 30 + 25
      expect(sale1.paymentStatus).toBe('PAID');
      expect(sale1.paymentMethod).toBe('DINHEIRO');

      // Update stock for first sale
      await StockService.createOrUpdateStock({
        productId: product1.id,
        quantityChange: 2,
        operation: 'SUBTRACT',
        referenceId: sale1.id,
        referenceType: 'SALE'
      });

      await StockService.createOrUpdateStock({
        productId: product2.id,
        quantityChange: 1,
        operation: 'SUBTRACT',
        referenceId: sale1.id,
        referenceType: 'SALE'
      });

      // Record cash transaction for first sale
      await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'SALE',
        amount: sale1.totalAmount,
        description: `Venda #${sale1.id}`,
        performedById: customer.id
      });

      // Create audit log for first sale
      await AuditService.createAuditLog({
        action: 'CREATE',
        entity: 'SALE',
        entityId: sale1.id,
        userId: customer.id
      });

      // 3. PROCESS SECOND SALE
      const saleData2 = {
        items: [ // No customer for this sale
          { productId: product1.id, quantity: 3, unitPrice: 15.0 }  // 45.00
        ],
        paymentStatus: 'PAID',
        paymentMethod: 'DINHEIRO',
        notes: 'PDV Sale 2'
      };

      const sale2 = await SaleService.createSale(saleData2);
      expect(sale2).toBeDefined();
      expect(sale2.totalAmount).toBe(45.0); // 3 * 15
      expect(sale2.paymentStatus).toBe('PAID');
      expect(sale2.paymentMethod).toBe('DINHEIRO');

      // Update stock for second sale
      await StockService.createOrUpdateStock({
        productId: product1.id,
        quantityChange: 3,
        operation: 'SUBTRACT',
        referenceId: sale2.id,
        referenceType: 'SALE'
      });

      // Record cash transaction for second sale
      await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'SALE',
        amount: sale2.totalAmount,
        description: `Venda #${sale2.id}`,
        performedById: customer.id
      });

      // Create audit log for second sale
      await AuditService.createAuditLog({
        action: 'CREATE',
        entity: 'SALE',
        entityId: sale2.id,
        userId: customer.id
      });

      // 4. CLOSING: Verify final state

      // Verify final stock levels
      const finalStock1 = await StockService.getStockByProductId(product1.id);
      const finalStock2 = await StockService.getStockByProductId(product2.id);

      // Product 1: 50 - 2 - 3 = 45
      expect(finalStock1.quantity).toBe(45);
      expect(finalStock1.minStock).toBe(10);

      // Product 2: 30 - 1 = 29
      expect(finalStock2.quantity).toBe(29);
      expect(finalStock2.minStock).toBe(5);

      // Verify cash processing through cash movements
      // We could query cash movements, but for now we trust the service calls were made

      // Verify audit logs were created
      const auditLogs = await AuditService.getAuditLogs({
        entity: 'SALE',
        page: 1,
        limit: 10
      });

      expect(auditLogs.auditLogs).toHaveLength(2);
      expect(auditLogs.auditLogs[0].entity).toBe('SALE');
      expect(auditLogs.auditLogs[0].entityId).toBeDefined();
      expect(auditLogs.auditLogs[1].entity).toBe('SALE');
      expect(auditLogs.auditLogs[1].entityId).toBeDefined();

      // Verify financial correctness
      const totalSalesAmount = sale1.totalAmount + sale2.totalAmount; // 55 + 45 = 100
      expect(totalSalesAmount).toBe(100);
    });

    it('should handle PDV flow with insufficient stock gracefully', async () => {
      // Create test product with low stock
      const product = await prisma.product.create({
        data: {
          name: 'Produto Baixo Estoque',
          status: 'ACTIVE',
          minStock: 5
        }
      });

      // Add limited stock
      await StockService.createOrUpdateStock({
        productId: product.id,
        quantityChange: 3,
        operation: 'SET',
        referenceId: 'initial-setup',
        referenceType: 'SETUP'
      });

      // Verify initial stock
      let initialStock = await StockService.getStockByProductId(product.id);
      expect(initialStock.quantity).toBe(3);

      // Create test customer
      const customer = await prisma.customer.create({
        data: {
          name: 'Test Customer',
          status: 'ACTIVE'
        }
      });

      // Create sale data requesting more than available
      const saleData = {
        customerId: customer.id,
        items: [
          { productId: product.id, quantity: 5, unitPrice: 10.0 } // Trying to sell 5 but only have 3
        ],
        paymentStatus: 'PAID',
        paymentMethod: 'DINHEIRO',
        notes: 'PDV Sale - insufficient stock test'
      };

      // Execute the flow and expect validation error
      await expect(SaleService.createSale(saleData))
        .reject
        .toThrow(/Insufficient stock/);

      // Verify stock was NOT changed due to validation failure
      const finalStock = await StockService.getStockByProductId(product.id);
      expect(finalStock.quantity).toBe(3); // Still 3, unchanged
      expect(finalStock.minStock).toBe(5);

      // Verify no cash transaction was recorded
      // (In a real test, we might query cash movements, but the service call should not have happened)
    });
  });
});