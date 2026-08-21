import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { CashSessionService } from '../src/services/cashSessionService';
import { CashRegisterService } from '../src/services/cashRegisterService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';

describe('Cash Session Service', () => {
  let adminUser: any;
  let testCashRegister: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();

    // Create a cash register for our tests
    testCashRegister = await CashRegisterService.createCashRegister({
      name: 'Test Register',
      description: 'Test description',
      isActive: true
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('openCashSession', () => {
    it('should open a new cash session correctly', async () => {
      const openingAmount = 100.0;

      const session = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: openingAmount
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.cashRegisterId).toBe(testCashRegister.id);
      expect(session.openedById).toBe(adminUser.id);
      expect(session.openingAmount).toBe(openingAmount);
      expect(session.status).toBe('OPEN');
      expect(session.closedById).toBeNull();
      expect(session.closedAt).toBeNull();
      expect(session.expectedAmount).toBeNull();
      expect(session.countedAmount).toBeNull();
      expect(session.difference).toBeNull();

      // Verify opening cash movement was created
      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: session.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('OPENING');
      expect(movements[0].amount.toNumber()).toBe(openingAmount);
      expect(movements[0].description).toBe('Opening cash');
      expect(movements[0].createdById).toBe(adminUser.id);
    });

    it('should throw error for non-existent cash register', async () => {
      await expect(
        CashSessionService.openCashSession({
          cashRegisterId: 'non-existent-id',
          openedById: adminUser.id,
          openingAmount: 50
        })
      ).rejects.toThrow('Cash register not found');
    });

    it('should throw error for inactive cash register', async () => {
      // Make cash register inactive
      await CashRegisterService.deactivateCashRegister(testCashRegister.id);

      await expect(
        CashSessionService.openCashSession({
          cashRegisterId: testCashRegister.id,
          openedById: adminUser.id,
          openingAmount: 50
        })
      ).rejects.toThrow('Cannot open session for inactive cash register');
    });

    it('should throw error when trying to open second session for same register', async () => {
      // Open first session
      await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Try to open second session for same register
      await expect(
        CashSessionService.openCashSession({
          cashRegisterId: testCashRegister.id,
          openedById: adminUser.id,
          openingAmount: 50
        })
      ).rejects.toThrow('This cash register already has an open session');
    });

    it('should throw error for negative opening amount', async () => {
      await expect(
        CashSessionService.openCashSession({
          cashRegisterId: testCashRegister.id,
          openedById: adminUser.id,
          openingAmount: -10 // Negative amount
        })
      ).rejects.toThrow('Opening amount cannot be negative');
    });
  });

  describe('getCashSession', () => {
    it('should return cash session by valid ID', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Retrieve the session
      const session = await CashSessionService.getCashSession(openedSession.id);

      expect(session).toBeDefined();
      expect(session.id).toBe(openedSession.id);
      expect(session.cashRegisterId).toBe(testCashRegister.id);
      expect(session.openedById).toBe(adminUser.id);
      expect(session.openingAmount).toBe(100);
      expect(session.status).toBe('OPEN');
    });

    it('should throw error for non-existent cash session ID', async () => {
      await expect(
        CashSessionService.getCashSession('non-existent-id')
      ).rejects.toThrow('Cash session not found');
    });
  });

  describe('getOpenCashSession', () => {
    it('should return open cash session for a cash register', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Get open session
      const openSession = await CashSessionService.getOpenCashSession(testCashRegister.id);

      expect(openSession).toBeDefined();
      expect(openSession!.id).toBe(openedSession.id);
      expect(openSession!.status).toBe('OPEN');
    });

    it('should return null when no open session exists', async () => {
      // Make sure no open session exists
      const openSession = await CashSessionService.getOpenCashSession(testCashRegister.id);
      expect(openSession).toBeNull();
    });

    it('should return null for non-existent cash register', async () => {
      const openSession = await CashSessionService.getOpenCashSession('non-existent-id');
      expect(openSession).toBeNull();
    });
  });

  describe('closeCashSession', () => {
    it('should close cash session correctly', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Add some transactions to the session
      // Add a sale movement (cash income)
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'SALE',
          amount: 60,
          description: 'Cash sale',
          createdById: adminUser.id
        }
      });

      // Add a deposit movement (more cash income)
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'DEPOSIT',
          amount: 30,
          description: 'Cash deposit',
          createdById: adminUser.id
        }
      });

      // Add a withdrawal movement (cash outflow)
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'WITHDRAWAL',
          amount: 20,
          description: 'Cash withdrawal',
          createdById: adminUser.id
        }
      });

      // Close the session
      const countedAmount = 170; // 100 opening + 60 sale + 30 deposit - 20 withdrawal
      const closedSession = await CashSessionService.closeCashSession({
        cashSessionId: openedSession.id,
        closedById: adminUser.id,
        countedAmount: countedAmount
      });

      expect(closedSession).toBeDefined();
      expect(closedSession.id).toBe(openedSession.id);
      expect(closedSession.status).toBe('CLOSED');
      expect(closedSession.closedById).toBe(adminUser.id);
      expect(closedSession.closedAt).toBeDefined();
      expect(closedSession.openingAmount).toBe(100);
      expect(closedSession.countedAmount).toBe(countedAmount);
      expect(closedSession.expectedAmount).toBe(170); // Calculated expected amount
      expect(closedSession.difference).toBe(0); // 170 counted - 170 expected = 0

      // Verify closing cash movement was created
      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: openedSession.id }
      });
      // Should have exactly 4 movements: OPENING, SALE, DEPOSIT, WITHDRAWAL (no ADJUSTMENT when difference is 0)
      expect(movements).toHaveLength(4);

      // Verify no ADJUSTMENT movement exists when difference is 0
      const adjustmentMovement = movements.find(m => m.type === 'ADJUSTMENT');
      expect(adjustmentMovement).toBeUndefined();

      // Actually, with difference = 0, there should be no adjustment movement
      // Let me check the service logic again...
    });

    it('should create cash over movement when counted > expected', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Add a sale movement
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'SALE',
          amount: 50,
          description: 'Cash sale',
          createdById: adminUser.id
        }
      });

      // Expected amount: 100 (opening) + 50 (sale) = 150
      // But we'll count 160 (10 over)
      const countedAmount = 160;
      const closedSession = await CashSessionService.closeCashSession({
        cashSessionId: openedSession.id,
        closedById: adminUser.id,
        countedAmount: countedAmount
      });

      expect(closedSession).toBeDefined();
      expect(closedSession.status).toBe('CLOSED');
      expect(closedSession.openingAmount).toBe(100);
      expect(closedSession.countedAmount).toBe(countedAmount);
      expect(closedSession.expectedAmount).toBe(150);
      expect(closedSession.difference).toBe(10); // 160 - 150 = 10 over

      // Verify cash over movement was created
      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: openedSession.id }
      });

      // Find the cash over movement (should be the last one created)
      const overMovement = movements.find(m =>
        m.type === 'ADJUSTMENT' &&
        m.description === 'Cash over' &&
        m.amount.toNumber() === 10
      );
      expect(overMovement).toBeDefined();
      expect(overMovement!.createdById).toBe(adminUser.id);
    });

    it('should create cash short movement when counted < expected', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Add a sale movement
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'SALE',
          amount: 50,
          description: 'Cash sale',
          createdById: adminUser.id
        }
      });

      // Expected amount: 100 (opening) + 50 (sale) = 150
      // But we'll count 140 (10 short)
      const countedAmount = 140;
      const closedSession = await CashSessionService.closeCashSession({
        cashSessionId: openedSession.id,
        closedById: adminUser.id,
        countedAmount: countedAmount
      });

      expect(closedSession).toBeDefined();
      expect(closedSession.status).toBe('CLOSED');
      expect(closedSession.openingAmount).toBe(100);
      expect(closedSession.countedAmount).toBe(countedAmount);
      expect(closedSession.expectedAmount).toBe(150);
      expect(closedSession.difference).toBe(-10); // 140 - 150 = -10 short

      // Verify cash short movement was created
      const movements = await prisma.cashMovement.findMany({
        where: { cashSessionId: openedSession.id }
      });

      // Find the cash short movement
      const shortMovement = movements.find(m =>
        m.type === 'ADJUSTMENT' &&
        m.description === 'Cash short' &&
        m.amount.toNumber() === 10
      );
      expect(shortMovement).toBeDefined();
      expect(shortMovement!.createdById).toBe(adminUser.id);
    });

    it('should throw error for non-existent cash session', async () => {
      await expect(
        CashSessionService.closeCashSession({
          cashSessionId: 'non-existent-id',
          closedById: adminUser.id,
          countedAmount: 50
        })
      ).rejects.toThrow('Cash session not found');
    });

    it('should throw error for already closed session', async () => {
      // Open and close a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      await CashSessionService.closeCashSession({
        cashSessionId: openedSession.id,
        closedById: adminUser.id,
        countedAmount: 100
      });

      // Try to close again
      await expect(
        CashSessionService.closeCashSession({
          cashSessionId: openedSession.id,
          closedById: adminUser.id,
          countedAmount: 100
        })
      ).rejects.toThrow('Cash session is already closed');
    });

    it('should throw error for negative counted amount', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Try to close with negative amount
      await expect(
        CashSessionService.closeCashSession({
          cashSessionId: openedSession.id,
          closedById: adminUser.id,
          countedAmount: -50 // Negative amount
        })
      ).rejects.toThrow('Counted amount cannot be negative');
    });
  });

  describe('listCashSessions', () => {
    it('should list all cash sessions when no filters applied', async () => {
      // Create 3 sessions sequentially for the same register:
      // session1 -> open -> close
      const session1 = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });
      await CashSessionService.closeCashSession({
        cashSessionId: session1.id,
        closedById: adminUser.id,
        countedAmount: 100
      });

      // session2 -> open -> close
      const session2 = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 200
      });
      await CashSessionService.closeCashSession({
        cashSessionId: session2.id,
        closedById: adminUser.id,
        countedAmount: 200
      });

      // session3 -> open (leave open)
      const session3 = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 150
      });

      // List all sessions
      const result = await CashSessionService.listCashSessions();

      expect(result.cashSessions).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it('should filter by cash register ID', async () => {
      // Create a second cash register
      const cashRegister2 = await CashRegisterService.createCashRegister({
        name: 'Second Register',
        description: 'Second test register',
        isActive: true
      });

      // First cash register: session1 -> open -> close
      const session1 = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });
      await CashSessionService.closeCashSession({
        cashSessionId: session1.id,
        closedById: adminUser.id,
        countedAmount: 100
      });

      // First cash register: session2 -> open (leave open)
      const session2 = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 200
      });

      // Second cash register: session3 -> open (leave open)
      const session3 = await CashSessionService.openCashSession({
        cashRegisterId: cashRegister2.id,
        openedById: adminUser.id,
        openingAmount: 50
      });

      // List sessions for first register only
      const result = await CashSessionService.listCashSessions({
        cashRegisterId: testCashRegister.id
      });

      expect(result.cashSessions).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      // Verify all sessions belong to the correct cash register
      for (const session of result.cashSessions) {
        expect(session.cashRegisterId).toBe(testCashRegister.id);
      }
    });

    it('should filter by status', async () => {
      // Create a second cash register
      const cashRegister2 = await CashRegisterService.createCashRegister({
        name: 'Second Register',
        description: 'Second test register',
        isActive: true
      });

      // sessionOpen -> OPEN (leave open) on first register
      const openSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // sessionClosed -> OPEN -> CLOSED on second register
      const sessionToClose = await CashSessionService.openCashSession({
        cashRegisterId: cashRegister2.id,
        openedById: adminUser.id,
        openingAmount: 150
      });
      await CashSessionService.closeCashSession({
        cashSessionId: sessionToClose.id,
        closedById: adminUser.id,
        countedAmount: 150
      });

      // List only open sessions
      const openResult = await CashSessionService.listCashSessions({
        status: 'OPEN'
      });

      expect(openResult.cashSessions).toHaveLength(1);
      expect(openResult.cashSessions[0].id).toBe(openSession.id);
      expect(openResult.cashSessions[0].status).toBe('OPEN');

      // List only closed sessions
      const closedResult = await CashSessionService.listCashSessions({
        status: 'CLOSED'
      });

      expect(closedResult.cashSessions).toHaveLength(1);
      expect(closedResult.cashSessions[0].id).toBe(sessionToClose.id);
      expect(closedResult.cashSessions[0].status).toBe('CLOSED');
    });

    it('should filter by date range', async () => {
      // Create a session today
      const todaySession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Create a session yesterday (by manipulating the date)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdaySession = await prisma.cashSession.create({
        data: {
          cashRegisterId: testCashRegister.id,
          openedById: adminUser.id,
          openedAt: yesterday,
          openingAmount: 50,
          status: 'OPEN'
        }
      });

      // Filter for today's sessions only
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const result = await CashSessionService.listCashSessions({
        startDate: todayStart,
        endDate: todayEnd
      });

      expect(result.cashSessions).toHaveLength(1);
      expect(result.cashSessions[0].id).toBe(todaySession.id);
    });
  });

  describe('getCashSessionSummary', () => {
    it('should return correct summary for a cash register with transactions', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Add some transactions
      // Sale movement (cash income)
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'SALE',
          amount: 80,
          description: 'Cash sale',
          createdById: adminUser.id
        }
      });

      // Deposit movement (more cash income)
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'DEPOSIT',
          amount: 40,
          description: 'Cash deposit',
          createdById: adminUser.id
        }
      });

      // Withdrawal movement (cash outflow)
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'WITHDRAWAL',
          amount: 30,
          description: 'Cash withdrawal',
          createdById: adminUser.id
        }
      });

      // Add a sale with payment
      const sale = await prisma.sale.create({
        data: {
          saleNumber: 'SALE-001',
          cashSessionId: openedSession.id,
          status: 'PENDING',
          subtotal: 60,
          totalAmount: 60,
          createdById: adminUser.id
        }
      });

      await prisma.salePayment.create({
        data: {
          saleId: sale.id,
          method: 'CASH',
          amount: 60,
          status: 'PAID',
          processedById: adminUser.id
        }
      });

      // Get summary
      const summary = await CashSessionService.getCashSessionSummary(openedSession.id);

      expect(summary).toBeDefined();
      expect(summary.cashSession.id).toBe(openedSession.id);
      expect(summary.cashSession.cashRegister.id).toBe(testCashRegister.id);
      expect(summary.cashSession.openedBy.id).toBe(adminUser.id);
      expect(summary.cashSession.openingAmount).toBe(100);
      expect(summary.cashSession.status).toBe('OPEN');

      // Verify expected amount calculation:
      // Opening: 100
      // Movements: SALE 80 + DEPOSIT 40 - WITHDRAWAL 30 = 90
      // Sales payments: 60
      // Expected total: 100 + 90 + 60 = 250
      expect(summary.expectedAmount).toBe(250);

      // Since countedAmount is not set (session is still open), difference should be null
      expect(summary.countedAmount).toBeNull();
      expect(summary.difference).toBeNull();

      // Verify transaction counts
      expect(summary.transactions.movementsCount).toBe(3); // SALE, DEPOSIT, WITHDRAWAL
      expect(summary.transactions.salesCount).toBe(1);
      expect(summary.transactions.paymentsCount).toBe(1);
    });

    it('should return correct summary for a closed session', async () => {
      // Open a session
      const openedSession = await CashSessionService.openCashSession({
        cashRegisterId: testCashRegister.id,
        openedById: adminUser.id,
        openingAmount: 100
      });

      // Add some transactions
      await prisma.cashMovement.create({
        data: {
          cashSessionId: openedSession.id,
          type: 'SALE',
          amount: 50,
          description: 'Cash sale',
          createdById: adminUser.id
        }
      });

      // Close the session with exact amount (no over/short)
      await CashSessionService.closeCashSession({
        cashSessionId: openedSession.id,
        closedById: adminUser.id,
        countedAmount: 150 // 100 opening + 50 sale
      });

      // Get summary
      const summary = await CashSessionService.getCashSessionSummary(openedSession.id);

      expect(summary).toBeDefined();
      expect(summary.cashSession.id).toBe(openedSession.id);
      expect(summary.cashSession.status).toBe('CLOSED');
      expect(summary.cashSession.openingAmount).toBe(100);
      expect(summary.expectedAmount).toBe(150);
      expect(summary.countedAmount).toBe(150);
      expect(summary.difference).toBe(0); // Perfect count

      // Since session is closed, we should have closedBy information
      expect(summary.closedBy).toBeDefined();
      expect(summary.closedBy!.id).toBe(adminUser.id);
    });

    it('should throw error for non-existent cash session', async () => {
      await expect(
        CashSessionService.getCashSessionSummary('non-existent-id')
      ).rejects.toThrow('Cash session not found');
    });
  });
});