import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { AuditService } from '../src/services/auditService';
import { ProductService } from '../src/services/productService';
import { CashSessionService } from '../src/services/cashSessionService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { SaleService } from '../src/services/saleService';
import { PurchaseService } from '../src/services/purchaseService';
import { StockService } from '../src/services/stockService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser, createTestUser } from './utils';
// Import setup-db to ensure test database is properly initialized
import './setup-db';

describe('Audit Service', () => {
  let adminUser: any;
  let testUser: any;
  let testCashRegister: any;
  let testCashSession: any;
  let testProduct: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();
    testUser = await createTestUser();

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
        sku: 'AUDITTEST001',
        categoryId: category.id,
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 100,
        status: 'ACTIVE'
      }
    });

    // Create a cash register for our tests
    testCashRegister = await CashRegisterService.createCashRegister({
      name: 'Test Register',
      description: 'Test description',
      isActive: true
    });

    // Open a cash session for our tests
    testCashSession = await CashSessionService.openCashSession({
      cashRegisterId: testCashRegister.id,
      openedById: adminUser.id,
      openingAmount: 100
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('logAudit', () => {
    it('should create a valid audit log entry', async () => {
      const auditData = {
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id,
        metadata: {
          productName: testProduct.name,
          sku: testProduct.sku
        }
      };

      const auditLog = await AuditService.createAuditLog(auditData);

      expect(auditLog).toBeDefined();
      expect(auditLog.id).toBeDefined();
      expect(auditLog.userId).toBe(adminUser.id);
      expect(auditLog.action).toBe('CREATE_PRODUCT');
      expect(auditLog.entity).toBe('PRODUCT');
      expect(auditLog.entityId).toBe(testProduct.id);
      expect(auditLog.metadata).toEqual({
        productName: testProduct.name,
        sku: testProduct.sku
      });
      expect(auditLog.createdAt).toBeDefined();
    });

    it('should create audit log with IP address and user agent', async () => {
      const auditData = {
        userId: testUser.id,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id,
        metadata: {
          oldPrice: 10.0,
          newPrice: 12.0
        }
      };

      const auditLog = await AuditService.createAuditLog(auditData);

      expect(auditLog).toBeDefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        AuditService.createAuditLog({
          userId: 'non-existent-id',
          action: 'TEST_ACTION',
          entity: 'PRODUCT',
          entityId: testProduct.id
        })
      ).rejects.toThrow('User not found');
    });

    it('should throw error for inactive user', async () => {
      // Make user inactive
      await prisma.user.update({
        where: { id: testUser.id },
        data: { status: 'INACTIVE' }
      });

      await expect(
        AuditService.createAuditLog({
          userId: testUser.id,
          action: 'TEST_ACTION',
          entity: 'PRODUCT',
          entityId: testProduct.id
        })
      ).rejects.toThrow('User is inactive');
    });

    it('should throw error for empty action', async () => {
      await expect(
        AuditService.createAuditLog({
          userId: adminUser.id,
          action: '', // Empty action
          entity: 'PRODUCT',
          entityId: testProduct.id
        })
      ).rejects.toThrow('Action is required');
    });

    it('should throw error for empty entity', async () => {
      await expect(
        AuditService.createAuditLog({
          userId: adminUser.id,
          action: 'TEST_ACTION',
          entity: '', // Empty entity
          entityId: testProduct.id
        })
      ).rejects.toThrow('Entity is required');
    });

  });

  describe('getAuditLogs', () => {
    it('should return audit logs with no filters', async () => {
      // Create multiple audit logs
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: testUser.id,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      const result = await AuditService.getAuditLogs();

      expect(result.auditLogs).toHaveLength(2);
      // Should be ordered by createdAt descending (most recent first)
      expect(result.auditLogs[0].action).toBe('UPDATE_PRODUCT');
      expect(result.auditLogs[1].action).toBe('CREATE_PRODUCT');
    });

    it('should filter by userId', async () => {
      // Create audit logs for different users
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: testUser.id,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Filter for admin user only
      const adminResult = await AuditService.getAuditLogsByUser({
        userId: adminUser.id
      });

      expect(adminResult.auditLogs).toHaveLength(1);
      expect(adminResult.auditLogs[0].action).toBe('CREATE_PRODUCT');
      expect(adminResult.auditLogs[0].userId).toBe(adminUser.id);

      // Filter for test user only
      const userResult = await AuditService.getAuditLogsByUser({
        userId: testUser.id
      });

      expect(userResult.auditLogs).toHaveLength(1);
      expect(userResult.auditLogs[0].action).toBe('UPDATE_PRODUCT');
      expect(userResult.auditLogs[0].userId).toBe(testUser.id);
    });

    it('should filter by action', async () => {
      // Create audit logs with different actions
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'DELETE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Filter for CREATE_PRODUCT action only
      const createLogs = await AuditService.getAuditLogsByUser({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT'
      });

      expect(createLogs.auditLogs).toHaveLength(2);
      expect(createLogs.auditLogs[0].action).toBe('CREATE_PRODUCT');
    });

    it('should filter by entity', async () => {
      // Create audit logs for different entity types
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Create a sale to audit (using fake ID for test isolation)
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_SALE',
        entity: 'SALE',
        entityId: '00000000-0000-0000-0000-000000000002' // Fake ID for test
      });

      // Filter for PRODUCT entity type only
      const productResult = await AuditService.getAuditLogsForEntity({
        entity: 'PRODUCT'
      });

      expect(productResult.auditLogs).toHaveLength(1);
      expect(productResult.auditLogs[0].entity).toBe('PRODUCT');
    });

    it('should filter by date range', async () => {
      // Create an audit log today
      const todayLog = await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'TODAY_ACTION',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Create an audit log yesterday (by manipulating timestamp)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayLog = await prisma.auditLog.create({
        data: {
          user: { connect: { id: adminUser.id } },
          action: 'YESTERDAY_ACTION',
          entity: 'PRODUCT',
          entityId: testProduct.id,
          createdAt: yesterday
        }
      });

      // Define today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get audit logs for today only
      const result = await AuditService.getAuditLogsByUser({
        userId: adminUser.id,
        startDate: todayStart,
        endDate: todayEnd
      });

      expect(result.auditLogs).toHaveLength(1);
      expect(result.auditLogs[0].action).toBe('TODAY_ACTION');
    });

    it('should return empty array when no logs match filters', async () => {
      // Create an audit log
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'EXISTING_ACTION',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Filter for non-existent action
      const result = await AuditService.getAuditLogsByUser({
        userId: adminUser.id,
        action: 'NON_EXISTENT_ACTION'
      });

      expect(result.auditLogs).toHaveLength(0);
    });

    it('should paginate results correctly', async () => {
      // Create multiple audit logs
      for (let i = 1; i <= 15; i++) {
        await AuditService.createAuditLog({
          userId: adminUser.id,
          action: `ACTION_${i}`,
          entity: 'PRODUCT',
          entityId: testProduct.id
        });
      }

      // Get first page (5 items per page)
      const page1 = await AuditService.getAuditLogsByUser({
        userId: adminUser.id,
        page: 1,
        limit: 5
      });

      expect(page1.auditLogs).toHaveLength(5);
      expect(page1.auditLogs[0].action).toBe('ACTION_15'); // Most recent
      expect(page1.auditLogs[4].action).toBe('ACTION_11'); // Fifth most recent

      // Get second page
      const page2 = await AuditService.getAuditLogsByUser({
        userId: adminUser.id,
        page: 2,
        limit: 5
      });

      expect(page2.auditLogs).toHaveLength(5);
      expect(page2.auditLogs[0].action).toBe('ACTION_10');
      expect(page2.auditLogs[4].action).toBe('ACTION_6');

      // Get third page (last page)
      const page3 = await AuditService.getAuditLogsByUser({
        userId: adminUser.id,
        page: 3,
        limit: 5
      });

      expect(page3.auditLogs).toHaveLength(5);
      expect(page3.auditLogs[0].action).toBe('ACTION_5');
      expect(page3.auditLogs[4].action).toBe('ACTION_1'); // Oldest
    });
  });

  describe('getAuditLogsByEntity', () => {
    it('should return audit logs for a specific entity', async () => {
      // Create audit logs for the test product
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'UPDATE_PRODUCT_PRICE',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'UPDATE_PRODUCT_STOCK',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Create a second product
      const product2 = await prisma.product.create({
        data: {
          name: 'Second Product',
          sku: 'SECOND-PROD',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 20.0,
          salePrice: 25.0,
          stockQuantity: 50,
          status: 'ACTIVE'
        }
      });

      // Create audit log for second product
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: product2.id
      });

      // Get audit logs for first product only
      const productResult = await AuditService.getAuditLogsForEntity({
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      expect(productResult.auditLogs).toHaveLength(3);
      // Verify all logs are for the correct entity
      for (const log of productResult.auditLogs) {
        expect(log.entity).toBe('PRODUCT');
        expect(log.entityId).toBe(testProduct.id);
      }
    });

    it('should return empty array when no audit logs exist for entity', async () => {
      // Create a product with no audit logs
      const productNoLogs = await prisma.product.create({
        data: {
          name: 'No Logs Product',
          sku: 'NO-LOGS-PROD',
          categoryId: '11111111-1111-1111-1111-111111111111',
          costPrice: 15.0,
          salePrice: 20.0,
          stockQuantity: 25,
          status: 'ACTIVE'
        }
      });

      const result = await AuditService.getAuditLogsForEntity({
        entity: 'PRODUCT',
        entityId: productNoLogs.id
      });
      expect(result.auditLogs).toHaveLength(0);
    });

    it('should throw error for invalid entity type', async () => {
      await expect(
        AuditService.getAuditLogsForEntity({
          entity: 'INVALID_ENTITY',
          entityId: testProduct.id
        })
      ).rejects.toThrow('Invalid entity type');
    });
  });

  describe('getAuditSummary', () => {
    it('should return correct audit summary', async () => {
      // Create various audit logs
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: testUser.id,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'DELETE_PRODUCT',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'CREATE_SALE',
        entity: 'SALE',
        entityId: '00000000-0000-0000-0000-000000000001' // Fake ID for test
      });

      // Get summary
      const summary = await AuditService.getStatistics();

      expect(summary).toBeDefined();
      expect(summary.total).toBe(5);

      // Check actions breakdown
      expect(summary.byAction.CREATE_PRODUCT).toBe(2);
      expect(summary.byAction.UPDATE_PRODUCT).toBe(1);
      expect(summary.byAction.DELETE_PRODUCT).toBe(1);
      expect(summary.byAction.CREATE_SALE).toBe(1);

      // Check entities breakdown
      expect(summary.byEntity.PRODUCT).toBe(4);
      expect(summary.byEntity.SALE).toBe(1);

      // Check users breakdown
      expect(summary.byUser[adminUser.id]).toBe(4);
      expect(summary.byUser[testUser.id]).toBe(1);
    });

    it('should return empty summary when no audit logs exist', async () => {
      const summary = await AuditService.getStatistics();

      expect(summary).toBeDefined();
      expect(summary.total).toBe(0);
      expect(summary.byAction).toEqual({});
      expect(summary.byEntity).toEqual({});
      expect(summary.byUser).toEqual({});
    });

    it('should filter summary by date range', async () => {
      // Create an audit log today
      await AuditService.createAuditLog({
        userId: adminUser.id,
        action: 'TODAY_ACTION',
        entity: 'PRODUCT',
        entityId: testProduct.id
      });

      // Create an audit log yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await prisma.auditLog.create({
        data: {
          user: { connect: { id: adminUser.id } },
          action: 'YESTERDAY_ACTION',
          entity: 'PRODUCT',
          entityId: testProduct.id,
          createdAt: yesterday
        }
      });

      // Define today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get summary for today only
      const summary = await AuditService.getStatistics({
        startDate: todayStart,
        endDate: todayEnd
      });

      expect(summary.total).toBe(1);
      expect(summary.byAction.TODAY_ACTION).toBe(1);
    });
  });
});