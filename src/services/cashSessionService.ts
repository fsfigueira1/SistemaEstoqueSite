import { prisma, Prisma } from "../lib/prisma"
import { CashSessionStatus } from "../generated/prisma/client.ts"

// Define input types
type OpenCashSessionInput = {
  cashRegisterId: string
  openedById: string
  openingAmount: number | Prisma.Decimal
}

type CloseCashSessionInput = {
  cashSessionId: string
  closedById: string
  countedAmount: number | Prisma.Decimal
}

export class CashSessionService {
  // Open a new cash session
  static async openCashSession(input: OpenCashSessionInput) {
    // Validate inputs
    if (!input.cashRegisterId) throw new Error('Cash register ID is required')
    if (!input.openedById) throw new Error('Opened by ID is required')
    if (Number(input.openingAmount) < 0) throw new Error('Opening amount cannot be negative')

    // Verify cash register exists and is active
    const cashRegister = await prisma.cashRegister.findUnique({
      where: { id: input.cashRegisterId }
    })

    if (!cashRegister) {
      throw new Error('Cash register not found')
    }

    if (!cashRegister.isActive) {
      throw new Error('Cannot open session for inactive cash register')
    }

    // Check if there's already an open session for this cash register
    // Using transaction to prevent race conditions
    return prisma.$transaction(async (tx: any) => {
      // Check for open session again within transaction
      const existingOpenSession = await tx.cashSession.findFirst({
        where: {
          cashRegisterId: input.cashRegisterId,
          status: CashSessionStatus.OPEN
        }
      })

      if (existingOpenSession) {
        throw new Error('This cash register already has an open session')
      }

      // Create the cash session
      const cashSession = await tx.cashSession.create({
        data: {
          cashRegisterId: input.cashRegisterId,
          openedById: input.openedById,
          openedAt: new Date(),
          openingAmount: input.openingAmount,
          status: CashSessionStatus.OPEN
        }
      })

      // Create opening cash movement
      const openingMovement = await tx.cashMovement.create({
        data: {
          cashSessionId: cashSession.id,
          type: 'OPENING',
          amount: Number(input.openingAmount),
          description: 'Opening cash',
          createdById: input.openedById
        }
      })

      // Also return the opening movement with converted amount for test compatibility
      // Note: We don't actually return this from the method, but the cashSession object
      // will be returned later with its openingAmount converted

      // Return the session with Decimal values converted to numbers for test compatibility
      return {
        ...cashSession,
        openingAmount: cashSession.openingAmount.toNumber()
      }
    })
  }

  // Get cash session by ID
  static async getCashSession(id: string) {
    const cashSession = await prisma.cashSession.findUnique({
      where: { id },
      include: {
        cashRegister: true,
        openedBy: true,
        closedBy: true,
        movements: true,
        sales: {
          include: {
            items: {
              include: {
                product: true
              }
            },
            payments: true
          }
        }
      }
    })

    if (!cashSession) {
      throw new Error('Cash session not found')
    }

    // Convert Decimal values to numbers for test compatibility
    return {
      ...cashSession,
      openingAmount: cashSession.openingAmount.toNumber(),
      expectedAmount: cashSession.expectedAmount ? cashSession.expectedAmount.toNumber() : null,
      countedAmount: cashSession.countedAmount ? cashSession.countedAmount.toNumber() : null,
      difference: cashSession.difference ? cashSession.difference.toNumber() : null
    }
  }

  // Get open cash session for a cash register
  static async getOpenCashSession(cashRegisterId: string) {
    // Don't throw error for non-existent cash register, just return null
    const openSession = await prisma.cashSession.findFirst({
      where: {
        cashRegisterId,
        status: CashSessionStatus.OPEN
      },
      include: {
        cashRegister: true,
        openedBy: true
      }
    })

    // Convert Decimal values to numbers for test compatibility if session exists
    if (openSession) {
      return {
        ...openSession,
        openingAmount: openSession.openingAmount.toNumber()
      }
    }

    return openSession // Could be null
  }

  // Close cash session
  static async closeCashSession(input: CloseCashSessionInput) {
    // Validate inputs
    if (!input.cashSessionId) throw new Error('Cash session ID is required')
    if (!input.closedById) throw new Error('Closed by ID is required')
    if (Number(input.countedAmount) < 0) throw new Error('Counted amount cannot be negative')

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // Get the cash session
      const cashSession = await tx.cashSession.findUnique({
        where: { id: input.cashSessionId },
        include: {
          cashRegister: true,
          movements: true,
          sales: {
            include: {
              payments: true
            }
          }
        }
      })

      if (!cashSession) {
        throw new Error('Cash session not found')
      }

      if (cashSession.status === CashSessionStatus.CLOSED) {
        throw new Error('Cash session is already closed')
      }

      if (!cashSession.cashRegister.isActive) {
        throw new Error('Cannot close session for inactive cash register')
      }

      // Calculate expected amount properly
      // Start with opening amount
      let expectedAmount = Number(cashSession.openingAmount)

      // Process all movements to calculate expected amount
      for (const movement of cashSession.movements) {
        switch (movement.type) {
          case 'SALE':
          case 'DEPOSIT':
            // These add money to the register
            expectedAmount += Number(movement.amount)
            break
          case 'WITHDRAWAL':
            // This removes money from the register
            expectedAmount -= Number(movement.amount)
            break
          case 'ADJUSTMENT':
            // For ADJUSTMENT movements, we need to determine if it's an addition or subtraction
            // based on the description (set when creating the movement)
            if (movement.description && movement.description.includes('Cash over')) {
              // 'Cash over' means we had too much, so we removed money (subtraction)
              expectedAmount -= Number(movement.amount)
            } else if (movement.description && movement.description.includes('Cash short')) {
              // 'Cash short' means we had too little, so we added money (addition)
              expectedAmount += Number(movement.amount)
            } else {
              // Default to addition if we can't determine (shouldn't happen with our code)
              expectedAmount += Number(movement.amount)
            }
            break
          case 'OPENING':
            // OPENING is already accounted for in the initial expectedAmount
            // We skip it here to avoid double counting
            break
        }
      }

      // Add sales amounts (cash and card payments)
      for (const sale of cashSession.sales) {
        for (const payment of sale.payments) {
          if (payment.status === 'PAID') {
            expectedAmount += Number(payment.amount)
          }
        }
      }

      // Calculate difference
      const difference = Number(input.countedAmount) - expectedAmount

      // Update the cash session
      const updatedSession = await tx.cashSession.update({
        where: { id: input.cashSessionId },
        data: {
          closedById: input.closedById,
          closedAt: new Date(),
          expectedAmount,
          countedAmount: input.countedAmount,
          difference,
          status: CashSessionStatus.CLOSED
        }
      })

      // Create closing cash movement only if there is a difference
      if (difference !== 0) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: input.cashSessionId,
            type: 'ADJUSTMENT', // Closing adjustment
            amount: Math.abs(difference), // Always positive
            description: difference >= 0 ? 'Cash over' : 'Cash short',
            createdById: input.closedById
          }
        })
      }

      // Return the session with Decimal values converted to numbers for test compatibility
      return {
        ...updatedSession,
        openingAmount: updatedSession.openingAmount.toNumber(),
        expectedAmount: updatedSession.expectedAmount ? updatedSession.expectedAmount.toNumber() : null,
        countedAmount: updatedSession.countedAmount ? updatedSession.countedAmount.toNumber() : null,
        difference: updatedSession.difference ? updatedSession.difference.toNumber() : null
      }
    })
  }

  // List cash sessions
  static async listCashSessions(options: {
    cashRegisterId?: string
    status?: CashSessionStatus
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      cashRegisterId,
      status,
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.CashSessionWhereInput = {}

    if (cashRegisterId) where.cashRegisterId = cashRegisterId
    if (status) where.status = status
    if (startDate) where.openedAt = { gte: startDate }
    if (endDate) {
      where.openedAt = {
        ...(where.openedAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [cashSessions, total] = await Promise.all([
      prisma.cashSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          cashRegister: {
            select: { id: true, name: true }
          },
          openedBy: {
            select: { id: true, name: true }
          },
          closedBy: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.cashSession.count({ where })
    ])

    return {
      cashSessions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get cash session summary
  static async getCashSessionSummary(id: string) {
    const cashSession = await prisma.cashSession.findUnique({
      where: { id },
      include: {
        cashRegister: true,
        openedBy: true,
        closedBy: true,
        movements: true,
        sales: {
          include: {
            payments: true
          }
        }
      }
    })

    if (!cashSession) {
      throw new Error('Cash session not found')
    }

    // Calculate expected amount properly
    let expectedAmount = Number(cashSession.openingAmount)

    for (const movement of cashSession.movements) {
      switch (movement.type) {
        case 'SALE':
        case 'DEPOSIT':
          expectedAmount += Number(movement.amount)
          break
        case 'WITHDRAWAL':
          expectedAmount -= Number(movement.amount)
          break
        case 'ADJUSTMENT':
          // For ADJUSTMENT movements, determine if it's an addition or subtraction
          // based on the description
          if (movement.description && movement.description.includes('Cash over')) {
            // 'Cash over' means we had too much, so we removed money (subtraction)
            expectedAmount -= Number(movement.amount)
          } else if (movement.description && movement.description.includes('Cash short')) {
            // 'Cash short' means we had too little, so we added money (addition)
            expectedAmount += Number(movement.amount)
          } else {
            // Default to addition if we can't determine (shouldn't happen with our code)
            expectedAmount += Number(movement.amount)
          }
          break
        // OPENING is already accounted for
      }
    }

    // Add sales amounts
    for (const sale of cashSession.sales) {
      for (const payment of sale.payments) {
        if (payment.status === 'PAID') {
          expectedAmount += Number(payment.amount)
        }
      }
    }

    const difference = cashSession.countedAmount
      ? Number(cashSession.countedAmount) - expectedAmount
      : null

    return {
      cashSession: {
        id: cashSession.id,
        cashRegister: {
          id: cashSession.cashRegister.id,
          name: cashSession.cashRegister.name
        },
        openedBy: {
          id: cashSession.openedBy.id,
          name: cashSession.openedBy.name
        },
        openedAt: cashSession.openedAt,
        openingAmount: cashSession.openingAmount.toNumber(),
        status: cashSession.status
      },
      closedBy: cashSession.closedBy ? {
        id: cashSession.closedBy.id,
        name: cashSession.closedBy.name
      } : null,
      closedAt: cashSession.closedAt,
      expectedAmount: expectedAmount !== null ? expectedAmount : null,
      countedAmount: cashSession.countedAmount ? cashSession.countedAmount.toNumber() : null,
      difference: difference !== null ? difference : null,
      transactions: {
        movementsCount: cashSession.movements.filter((m: any) => m.type !== 'OPENING').length,
        salesCount: cashSession.sales.length,
        paymentsCount: cashSession.sales.reduce((sum: number, sale: any) => sum + sale.payments.length, 0)
      }
    }
  }
}

export default CashSessionService