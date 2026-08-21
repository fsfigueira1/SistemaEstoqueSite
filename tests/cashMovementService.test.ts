import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { CashMovementService } from '../src/services/cashMovementService';
import { CashSessionService } from '../src/services/cashSessionService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';
import { CashMovementType } from '../src/generated/prisma/client.ts';

describe('Cash Movement Service', () => {
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

  describe('createCashMovement', () => {
    it('should create a valid cash movement', async () => {
      const movementData = {
        cashSessionId: testCashSession.id,
        type: 'SALE' as CashMovementType,
        amount: 50.0,
        description: 'Test cash sale',
        performedById: adminUser.id
      };

      const movement = await CashMovementService.createCashMovement(movementData);

      expect(movement).toBeDefined();
      expect(movement.id).toBeDefined();
      expect(movement.cashSessionId).toBe(testCashSession.id);
      expect(movement.type).toBe(movementData.type);
      expect(movement.amount).toBe(movementData.amount);
      expect(movement.description).toBe(movementData.description);
      expect(movement.performedById).toBe(movementData.performedById);
      expect(movement.createdAt).toBeDefined();
    });

    it('should throw error for non-existent cash session', async () => {
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: 'non-existent-id',
          type: 'SALE',
          amount: 50,
          description: 'Test movement',
          performedById: adminUser.id
        })
      ).rejects.toThrow('Cash session not found');
    });

    it('should throw error for closed cash session', async () => {
      // Close the session first
      await CashSessionService.closeCashSession({
        cashSessionId: testCashSession.id,
        closedById: adminUser.id,
        countedAmount: 100
      });

      // Try to create movement for closed session
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: testCashSession.id,
          type: 'SALE',
          amount: 50,
          description: 'Test movement',
          performedById: adminUser.id
        })
      ).rejects.toThrow('Cannot create movements for closed cash session');
    });

    it('should throw error for invalid movement type', async () => {
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: testCashSession.id,
          type: 'INVALID_TYPE' as any,
          amount: 50,
          description: 'Test movement',
          performedById: adminUser.id
        })
      ).rejects.toThrow('Invalid cash movement type');
    });

    it('should throw error for negative amount', async () => {
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: testCashSession.id,
          type: 'SALE',
          amount: -10,
          description: 'Test movement',
          performedById: adminUser.id
        })
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw error for zero amount', async () => {
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: testCashSession.id,
          type: 'SALE',
          amount: 0,
          description: 'Test movement',
          performedById: adminUser.id
        })
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw error for empty description', async () => {
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: testCashSession.id,
          type: 'SALE',
          amount: 50,
          description: '', // Empty description
          performedById: adminUser.id
        })
      ).rejects.toThrow('Description is required');
    });

    it('should throw error for whitespace-only description', async () => {
      await expect(
        CashMovementService.createCashMovement({
          cashSessionId: testCashSession.id,
          type: 'SALE',
          amount: 50,
          description: '   ', // Whitespace only
          performedById: adminUser.id
        })
      ).rejects.toThrow('Description is required');
    });
  });

  describe('getCashMovement', () => {
    it('should return cash movement by valid ID', async () => {
      // Create a movement
      const createdMovement = await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'DEPOSIT',
        amount: 75.5,
        description: 'Test deposit',
        performedById: adminUser.id
      });

      // Retrieve the movement
      const movement = await CashMovementService.getCashMovement(createdMovement.id);

      expect(movement).toBeDefined();
      expect(movement.id).toBe(createdMovement.id);
      expect(movement.cashSessionId).toBe(testCashSession.id);
      expect(movement.type).toBe('DEPOSIT');
      expect(movement.amount).toBe(75.5);
      expect(movement.description).toBe('Test deposit');
      expect(movement.performedById).toBe(adminUser.id);
    });

    it('should throw error for non-existent cash movement ID', async () => {
      await expect(
        CashMovementService.getCashMovement('non-existent-id')
      ).rejects.toThrow('Cash movement not found');
    });
  });

  describe('getCashMovementsBySession', () => {
    it('should return all cash movements for a session', async () => {
      // Create multiple movements
      const movement1 = await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'SALE',
        amount: 50,
        description: 'Sale 1',
        performedById: adminUser.id
      });

      const movement2 = await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'DEPOSIT',
        amount: 30,
        description: 'Deposit 1',
        performedById: adminUser.id
      });

      const movement3 = await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'WITHDRAWAL',
        amount: 20,
        description: 'Withdrawal 1',
        performedById: adminUser.id
      });

      // Get movements for session
      const result = await CashMovementService.getCashMovementsBySession(testCashSession.id);
      expect(result.movements).toHaveLength(4); // 1 opening movement + 3 created movements
      // Should be ordered by creation date descending (most recent first)
      const movements = result.movements;
      expect(movements[0].id).toBe(movement3.id); // WITHDRAWAL (most recent)
      expect(movements[1].id).toBe(movement2.id); // DEPOSIT
      expect(movements[2].id).toBe(movement1.id); // SALE (oldest)
      // The first movement should be the opening movement (created by CashSessionService)
    });

    it('should return single movement (opening) when session just opened', async () => {
      // Create a fresh cash register and session for this isolated test
      const cashRegister = await CashRegisterService.createCashRegister({
        name: 'Test Register Empty',
        description: 'Test for empty movements',
        isActive: true
      });

      const cashSession = await CashSessionService.openCashSession({
        cashRegisterId: cashRegister.id,
        openedById: adminUser.id,
        openingAmount: 50
      });

      // The session should have exactly 1 movement (the opening movement created by openCashSession)
      const result = await CashMovementService.getCashMovementsBySession(cashSession.id);
      expect(result.movements).toHaveLength(1);
      expect(result.pagination.total).toBe(1);

      // Verify it's the opening movement
      const movement = result.movements[0];
      expect(movement.type).toBe('OPENING');
      expect(movement.amount).toBe(50);
    });

    it('should throw error for non-existent cash session', async () => {
      await expect(
        CashMovementService.getCashMovementsBySession('non-existent-id')
      ).rejects.toThrow('Cash session not found');
    });
  });

  describe('getCashMovementsByType', () => {
    it('should return cash movements filtered by type', async () => {
      // Create movements of different types
      await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'SALE',
        amount: 50,
        description: 'Sale movement',
        performedById: adminUser.id
      });

      await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'SALE',
        amount: 30,
        description: 'Another sale',
        performedById: adminUser.id
      });

      await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'DEPOSIT',
        amount: 100,
        description: 'Deposit movement',
        performedById: adminUser.id
      });

      // Get only SALE movements
      const saleResult = await CashMovementService.getCashMovementsByType(
        testCashSession.id,
        'SALE'
      );
      expect(saleResult.movements).toHaveLength(2);
      for (const movement of saleResult.movements) {
        expect(movement.type).toBe('SALE');
      }

      // Get only DEPOSIT movements
      const depositResult = await CashMovementService.getCashMovementsByType(
        testCashSession.id,
        'DEPOSIT'
      );
      expect(depositResult.movements).toHaveLength(1);
      expect(depositResult.movements[0].type).toBe('DEPOSIT');
      expect(depositResult.movements[0].amount).toBe(100);
    });

    it('should return empty array when no movements of specified type exist', async () => {
      // Create only SALE movements
      await CashMovementService.createCashMovement({
        cashSessionId: testCashSession.id,
        type: 'SALE',
        amount: 50,
        description: 'Sale movement',
        performedById: adminUser.id
      });

      // Try to get DEPOSIT movements (none exist)
      const result = await CashMovementService.getCashMovementsByType(
        testCashSession.id,
        'DEPOSIT'
      );
      expect(result.movements).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should throw error for invalid movement type', async () => {
      await expect(
        CashMovementService.getCashMovementsByType(
          testCashSession.id,
          'INVALID_TYPE' as any
        )
      ).rejects.toThrow('Invalid cash movement type');
    });

    it('should throw error for non-existent cash session', async () => {
      await expect(
        CashMovementService.getCashMovementsByType('non-existent-id', 'SALE')
      ).rejects.toThrow('Cash session not found');
    });
  });
});