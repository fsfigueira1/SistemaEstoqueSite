import { PrismaClient, Prisma } from "../generated/prisma/client.ts"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { CashMovementType } from "../generated/prisma/client.ts"

// Initialize PrismaClient with SQLite adapter
// Use test database when in test environment
const databaseUrl = process.env.NODE_ENV === 'test'
  ? "file:./test.db"
  : "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
import { prisma } from "../lib/prisma"
// const prisma = new PrismaClient({ adapter }) - REMOVED to use shared instance;

// Define input types
type CreateCashMovementInput = {
  cashSessionId: string
  type: CashMovementType
  amount: number | Prisma.Decimal
  description?: string | null
  performedById: string // Changed from createdById to match test expectations
}

export class CashMovementService {
  // Create a cash movement
  static async createCashMovement(input: CreateCashMovementInput) {
    // Validate inputs
    if (!input.cashSessionId) throw new Error('Cash session ID is required')
    if (!input.performedById) throw new Error('Performed by ID is required') // Updated message
    if (!input.amount || Number(input.amount) <= 0) throw new Error('Amount must be positive')
    if (!input.description || input.description.trim() === '') {
      throw new Error('Description is required')
    }

    // Verify cash session exists and is open
    const cashSession = await prisma.cashSession.findUnique({
      where: { id: input.cashSessionId },
      include: {
        cashRegister: true
      }
    })

    if (!cashSession) {
      throw new Error('Cash session not found')
    }

    if (cashSession.status === 'CLOSED') {
      throw new Error('Cannot create movements for closed cash session')
    }

    if (!cashSession.cashRegister.isActive) {
      throw new Error('Cannot create movement for inactive cash register')
    }

    // Validate movement type
    if (!Object.values(CashMovementType).includes(input.type)) {
      throw new Error('Invalid cash movement type')
    }

    // Create the cash movement
    const movement = await prisma.cashMovement.create({
      data: {
        cashSessionId: input.cashSessionId,
        type: input.type,
        amount: input.amount,
        description: input.description ?? null,
        createdById: input.performedById // Map performedById to createdById in DB
      }
    })

    // Convert Decimal fields to numbers for test compatibility
    // Map createdById back to performedById for test compatibility
    return {
      ...movement,
      amount: (movement as any).amount.toNumber(),
      performedById: movement.createdById
    }
  }

  // Get cash movement by ID
  static async getCashMovement(id: string) {
    const movement = await prisma.cashMovement.findUnique({
      where: { id }
    })

    if (!movement) {
      throw new Error('Cash movement not found')
    }

    // Convert Decimal fields to numbers for test compatibility
    // Map createdById back to performedById for test compatibility
    return {
      ...movement,
      amount: (movement as any).amount.toNumber(),
      performedById: movement.createdById
    }
  }

  // Get cash movements for a cash session
  static async getCashMovementsBySession(cashSessionId: string, options: {
    limit?: number
    offset?: number
    type?: CashMovementType
    startDate?: Date
    endDate?: Date
  } = {}) {
    // Verify cash session exists
    const cashSession = await prisma.cashSession.findUnique({
      where: { id: cashSessionId }
    })

    if (!cashSession) {
      throw new Error('Cash session not found')
    }

    const {
      limit = 50,
      offset = 1, // page number, starting from 1
      type,
      startDate,
      endDate
    } = options

    // Calculate skip for pagination: (page - 1) * limit
    const skip = (offset - 1) * limit

    const where: Prisma.CashMovementWhereInput = { cashSessionId }
    if (type) where.type = type
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [movements, total] = await Promise.all([
      prisma.cashMovement.findMany({
        where,
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.cashMovement.count({ where })
    ])

    // Convert Decimal fields to numbers for test compatibility
    // Map createdById back to performedById for test compatibility
    const movementsWithNumbers = movements.map((movement: any) => ({
      ...movement,
      amount: (movement as any).amount.toNumber(),
      performedById: movement.createdById
    }))

    return {
      movements: movementsWithNumbers,
      pagination: {
        total,
        limit,
        page: offset,
        hasMore: skip + movements.length < total
      }
    }
  }

  // Get cash movements by type
  static async getCashMovementsByType(cashSessionId: string, type: CashMovementType, options: {
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  } = {}) {
    // Verify cash session exists
    const cashSession = await prisma.cashSession.findUnique({
      where: { id: cashSessionId }
    })

    if (!cashSession) {
      throw new Error('Cash session not found')
    }

    // Validate movement type
    if (!Object.values(CashMovementType).includes(type)) {
      throw new Error('Invalid cash movement type')
    }

    const {
      startDate,
      endDate,
      limit = 50,
      offset = 1 // page number, starting from 1
    } = options

    // Calculate skip for pagination: (page - 1) * limit
    const skip = (offset - 1) * limit
    const where: Prisma.CashMovementWhereInput = {
      cashSessionId,
      type
    }
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [movements, total] = await Promise.all([
      prisma.cashMovement.findMany({
        where,
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.cashMovement.count({ where })
    ])

    // Convert Decimal fields to numbers for test compatibility
    // Map createdById back to performedById for test compatibility
    const movementsWithNumbers = movements.map((movement: any) => ({
      ...movement,
      amount: (movement as any).amount.toNumber(),
      performedById: movement.createdById
    }))

    return {
      movements: movementsWithNumbers,
      pagination: {
        total,
        limit,
        page: offset,
        hasMore: skip + movements.length < total
      }
    }
  }

  // Original methods kept for backward compatibility
  static async getCashSessionMovements(cashSessionId: string, options: {
    limit?: number
    offset?: number
    type?: CashMovementType
    startDate?: Date
    endDate?: Date
  } = {}) {
    return this.getCashMovementsBySession(cashSessionId, options)
  }

  static async getMovementsByType(cashSessionId: string, type: CashMovementType, options: {
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  } = {}) {
    return this.getCashMovementsByType(cashSessionId, type, options)
  }

  // Get cash movement statistics
  static async getStatistics(options: {
    cashSessionId?: string
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      cashSessionId,
      startDate,
      endDate
    } = options

    const where: Prisma.CashMovementWhereInput = {}
    if (cashSessionId) where.cashSessionId = cashSessionId
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    // Get movements grouped by type
    const movements = await prisma.cashMovement.groupBy({
      by: ['type'],
      where,
      _sum: {
        amount: true
      },
      _count: {
        amount: true
      }
    })

    // Format the result
    const stats: Record<string, { count: number; totalAmount: number }> = {}
    let totalAmount = 0
    let totalCount = 0

    for (const movement of movements) {
      stats[movement.type] = {
        count: movement._count.amount,
        totalAmount: Number(movement._sum.amount || 0)
      }
      totalAmount += Number(movement._sum.amount || 0)
      totalCount += movement._count.amount
    }

    return {
      byType: stats,
      totals: {
        amount: totalAmount,
        count: totalCount
      }
    }
  }
}

export default CashMovementService