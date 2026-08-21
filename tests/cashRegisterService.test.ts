import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

describe('Cash Register Service', () => {
  let adminUser: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('createCashRegister', () => {
    it('should create a valid cash register', async () => {
      const cashRegisterData = {
        name: 'Main Register',
        description: 'Primary cash register',
        isActive: true
      };

      const cashRegister = await CashRegisterService.createCashRegister(cashRegisterData);

      expect(cashRegister).toBeDefined();
      expect(cashRegister.id).toBeDefined();
      expect(cashRegister.name).toBe(cashRegisterData.name);
      expect(cashRegister.description).toBe(cashRegisterData.description);
      expect(cashRegister.isActive).toBe(cashRegisterData.isActive);
    });

    it('should throw error for empty name', async () => {
      await expect(
        CashRegisterService.createCashRegister({
          name: '', // Empty name
          description: 'Test register',
          isActive: true
        })
      ).rejects.toThrow('Cash register name is required');

      await expect(
        CashRegisterService.createCashRegister({
          name: '   ', // Whitespace only
          description: 'Test register',
          isActive: true
        })
      ).rejects.toThrow('Cash register name is required');
    });

    it('should throw error for duplicate name', async () => {
      // Create first cash register
      await CashRegisterService.createCashRegister({
        name: 'Duplicate Register',
        description: 'First register',
        isActive: true
      });

      // Try to create second with same name
      await expect(
        CashRegisterService.createCashRegister({
          name: 'Duplicate Register',
          description: 'Second register',
          isActive: true
        })
      ).rejects.toThrow('A cash register with this name already exists');
    });
  });

  describe('getCashRegister', () => {
    it('should return cash register by valid ID', async () => {
      // Create a cash register
      const createdRegister = await CashRegisterService.createCashRegister({
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      });

      // Retrieve the cash register
      const register = await CashRegisterService.getCashRegister(createdRegister.id);

      expect(register).toBeDefined();
      expect(register.id).toBe(createdRegister.id);
      expect(register.name).toBe(createdRegister.name);
      expect(register.description).toBe(createdRegister.description);
      expect(register.isActive).toBe(createdRegister.isActive);
    });

    it('should throw error for non-existent cash register ID', async () => {
      await expect(
        CashRegisterService.getCashRegister('non-existent-id')
      ).rejects.toThrow('Cash register not found');
    });
  });

  describe('updateCashRegister', () => {
    it('should update cash register correctly', async () => {
      // Create a cash register
      const createdRegister = await CashRegisterService.createCashRegister({
        name: 'Original Name',
        description: 'Original description',
        isActive: true
      });

      // Update the cash register
      const updatedRegister = await CashRegisterService.updateCashRegister(createdRegister.id, {
        name: 'Updated Name',
        description: 'Updated description',
        isActive: false
      });

      expect(updatedRegister).toBeDefined();
      expect(updatedRegister.name).toBe('Updated Name');
      expect(updatedRegister.description).toBe('Updated description');
      expect(updatedRegister.isActive).toBe(false);
      expect(updatedRegister.id).toBe(createdRegister.id);
    });

    it('should throw error for empty name when updating', async () => {
      // Create a cash register
      const register = await CashRegisterService.createCashRegister({
        name: 'Valid Name',
        description: 'Test description',
        isActive: true
      });

      // Try to update with empty name
      await expect(
        CashRegisterService.updateCashRegister(register.id, {
          name: '' // Empty name
        })
      ).rejects.toThrow('Cash register name cannot be empty');

      // Try to update with whitespace-only name
      await expect(
        CashRegisterService.updateCashRegister(register.id, {
          name: '   ' // Whitespace only
        })
      ).rejects.toThrow('Cash register name cannot be empty');
    });

    it('should throw error for duplicate name when updating', async () => {
      // Create two cash registers
      await CashRegisterService.createCashRegister({
        name: 'Register One',
        description: 'First register',
        isActive: true
      });

      const registerTwo = await CashRegisterService.createCashRegister({
        name: 'Register Two',
        description: 'Second register',
        isActive: true
      });

      // Try to update registerTwo to have the same name as registerOne
      await expect(
        CashRegisterService.updateCashRegister(registerTwo.id, {
          name: 'Register One' // Duplicate name
        })
      ).rejects.toThrow('A cash register with this name already exists');
    });

    it('should allow updating to the same name (no change)', async () => {
      // Create a cash register
      const register = await CashRegisterService.createCashRegister({
        name: 'Same Name',
        description: 'Test description',
        isActive: true
      });

      // Update with the same name (should work)
      const updatedRegister = await CashRegisterService.updateCashRegister(register.id, {
        name: 'Same Name', // Same name
        description: 'Updated description'
      });

      expect(updatedRegister).toBeDefined();
      expect(updatedRegister.name).toBe('Same Name');
      expect(updatedRegister.description).toBe('Updated description');
    });
  });

  describe('deactivateCashRegister', () => {
    it('should deactivate cash register correctly', async () => {
      // Create a cash register
      const createdRegister = await CashRegisterService.createCashRegister({
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      });

      // Deactivate the cash register
      const deactivatedRegister = await CashRegisterService.deactivateCashRegister(createdRegister.id);

      expect(deactivatedRegister).toBeDefined();
      expect(deactivatedRegister.isActive).toBe(false);
    });

    it('should throw error when trying to deactivate register with open session', async () => {
      // Create a cash register
      const cashRegister = await CashRegisterService.createCashRegister({
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      });

      // Create an open session for this register
      await prisma.cashSession.create({
        data: {
          cashRegisterId: cashRegister.id,
          openedById: adminUser.id,
          openedAt: new Date(),
          openingAmount: 100,
          status: 'OPEN'
        }
      });

      // Try to deactivate the cash register - should fail
      await expect(
        CashRegisterService.deactivateCashRegister(cashRegister.id)
      ).rejects.toThrow('Cannot deactivate cash register with an open session. Close the session first.');
    });
  });

  describe('activateCashRegister', () => {
    it('should activate cash register correctly', async () => {
      // Create a cash register
      const createdRegister = await CashRegisterService.createCashRegister({
        name: 'Test Register',
        description: 'Test description',
        isActive: false // Start as inactive
      });

      // Activate the cash register
      const activatedRegister = await CashRegisterService.activateCashRegister(createdRegister.id);

      expect(activatedRegister).toBeDefined();
      expect(activatedRegister.isActive).toBe(true);
    });
  });

  describe('listCashRegisters', () => {
    it('should list all cash registers when no filters applied', async () => {
      // Create multiple cash registers
      await CashRegisterService.createCashRegister({
        name: 'Register 1',
        description: 'First register',
        isActive: true
      });

      await CashRegisterService.createCashRegister({
        name: 'Register 2',
        description: 'Second register',
        isActive: false
      });

      await CashRegisterService.createCashRegister({
        name: 'Register 3',
        description: 'Third register',
        isActive: true
      });

      // List all cash registers
      const result = await CashRegisterService.listCashRegisters();

      expect(result.cashRegisters).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it('should list only active cash registers when activeOnly filter is true', async () => {
      // Create multiple cash registers
      await CashRegisterService.createCashRegister({
        name: 'Active Register 1',
        description: 'First active register',
        isActive: true
      });

      await CashRegisterService.createCashRegister({
        name: 'Inactive Register 1',
        description: 'First inactive register',
        isActive: false
      });

      await CashRegisterService.createCashRegister({
        name: 'Active Register 2',
        description: 'Second active register',
        isActive: true
      });

      // List only active cash registers
      const result = await CashRegisterService.listCashRegisters({
        activeOnly: true
      });

      expect(result.cashRegisters).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      // Verify all returned registers are active
      for (const register of result.cashRegisters) {
        expect(register.isActive).toBe(true);
      }
    });

    it('should filter by search term', async () => {
      // Create multiple cash registers
      await CashRegisterService.createCashRegister({
        name: 'Alpha Register',
        description: 'First register',
        isActive: true
      });

      await CashRegisterService.createCashRegister({
        name: 'Beta Register',
        description: 'Second register',
        isActive: true
      });

      await CashRegisterService.createCashRegister({
        name: 'Gamma Register',
        description: 'Third register',
        isActive: true
      });

      // Search for registers with "Beta" in name
      const result = await CashRegisterService.listCashRegisters({
        search: 'Beta'
      });

      expect(result.cashRegisters).toHaveLength(1);
      expect(result.cashRegisters[0].name).toBe('Beta Register');
      expect(result.pagination.total).toBe(1);
    });

    it('should return empty array when no matches found', async () => {
      // Create a cash register
      await CashRegisterService.createCashRegister({
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      });

      // Search for non-existent term
      const result = await CashRegisterService.listCashRegisters({
        search: 'NonExistentTerm'
      });

      expect(result.cashRegisters).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should paginate results correctly', async () => {
      // Create multiple cash registers
      for (let i = 1; i <= 15; i++) {
        await CashRegisterService.createCashRegister({
          name: `Register ${i}`,
          description: `Register ${i} description`,
          isActive: true
        });
      }

      // Get first page (5 items per page)
      const page1 = await CashRegisterService.listCashRegisters({
        page: 1,
        limit: 5
      });

      expect(page1.cashRegisters).toHaveLength(5);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(5);
      expect(page1.pagination.total).toBe(15);
      expect(page1.pagination.totalPages).toBe(3);

      // Get second page
      const page2 = await CashRegisterService.listCashRegisters({
        page: 2,
        limit: 5
      });

      expect(page2.cashRegisters).toHaveLength(5);
      expect(page2.pagination.page).toBe(2);

      // Get third page (last page)
      const page3 = await CashRegisterService.listCashRegisters({
        page: 3,
        limit: 5
      });

      expect(page3.cashRegisters).toHaveLength(5);
      expect(page3.pagination.page).toBe(3);
    });
  });

  describe('getCashRegisterStatistics', () => {
    it('should return correct statistics for a cash register', async () => {
      // Create a cash register
      const cashRegister = await CashRegisterService.createCashRegister({
        name: 'Test Register',
        description: 'Test description',
        isActive: true
      });

      // Create an open session
      const openSession = await prisma.cashSession.create({
        data: {
          cashRegisterId: cashRegister.id,
          openedById: adminUser.id,
          openedAt: new Date(),
          openingAmount: 100,
          status: 'OPEN'
        }
      });

      // Create a closed session
      const closedSession = await prisma.cashSession.create({
        data: {
          cashRegisterId: cashRegister.id,
          openedById: adminUser.id,
          openedAt: new Date(Date.now() - 3600000), // 1 hour ago
          openingAmount: 50,
          closedById: adminUser.id,
          closedAt: new Date(),
          expectedAmount: 75,
          countedAmount: 80,
          difference: 5,
          status: 'CLOSED'
        }
      });

      // Add some cash movements to the open session
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openSession.id,
          type: 'SALE',
          amount: 60,
          description: 'Cash sale',
          createdById: adminUser.id
        }
      });

      await prisma.cashMovement.create({
        data: {
          cashSessionId: openSession.id,
          type: 'DEPOSIT',
          amount: 30,
          description: 'Cash deposit',
          createdById: adminUser.id
        }
      });

      await prisma.cashMovement.create({
        data: {
          cashSessionId: openSession.id,
          type: 'WITHDRAWAL',
          amount: 20,
          description: 'Cash withdrawal',
          createdById: adminUser.id
        }
      });

      // Get statistics
      const stats = await CashRegisterService.getCashRegisterStatistics(cashRegister.id);

      expect(stats).toBeDefined();
      expect(stats.cashRegister.id).toBe(cashRegister.id);
      expect(stats.cashRegister.name).toBe(cashRegister.name);
      expect(stats.cashRegister.isActive).toBe(true);

      // Check session statistics
      expect(stats.statistics.totalSessions).toBe(2); // 1 open + 1 closed
      expect(stats.statistics.openSessions).toBe(1);
      expect(stats.statistics.closedSessions).toBe(1);

      // Check processed amounts
      // Opening amount (100) + SALE (60) + DEPOSIT (30) - WITHDRAWAL (20) = 170
      // Plus the closed session amounts: opening (50) + payments (we didn't add any, so just the session amounts)
      // Actually, let's recalculate based on what we added:
      // Open session: opening 100 + SALE 60 + DEPOSIT 30 - WITHDRAWAL 20 = 170
      // Closed session: we set openingAmount to 50, but didn't add movements, so just 50
      // Total processed should be 170 + 50 = 220
      // Cash sales: SALE 60 (from open session) + 0 (from closed session) = 60

      expect(stats.statistics.totalProcessedAmount).toBe(220);
      expect(stats.statistics.totalCashSalesAmount).toBe(60);
    });

    it('should throw error for non-existent cash register', async () => {
      await expect(
        CashRegisterService.getCashRegisterStatistics('non-existent-id')
      ).rejects.toThrow('Cash register not found');
    });
  });
});