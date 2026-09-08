import { prisma, Prisma } from "../lib/prisma"

// Define input types
type CashRegisterCreateInput = {
  name: string
  description?: string | null
  isActive?: boolean
}

type CashRegisterUpdateInput = {
  name?: string
  description?: string | null
  isActive?: boolean
}

export class CashRegisterService {
  // Create a new cash register
  static async createCashRegister(data: CashRegisterCreateInput) {
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      throw new Error('Cash register name is required')
    }

    // Check if a cash register with the same name already exists (optional)
    const existing = await prisma.cashRegister.findFirst({
      where: { name: data.name }
    })

    if (existing) {
      throw new Error('A cash register with this name already exists')
    }

    return prisma.cashRegister.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? true
      }
    })
  }

  // Get cash register by ID
  static async getCashRegister(id: string) {
    const cashRegister = await prisma.cashRegister.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { status: 'OPEN' },
          take: 1
        }
      }
    })

    if (!cashRegister) {
      throw new Error('Cash register not found')
    }

    return cashRegister
  }

  // Update cash register
  static async updateCashRegister(id: string, data: CashRegisterUpdateInput) {
    // Check if cash register exists
    const existing = await prisma.cashRegister.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Cash register not found')
    }

    // If updating name, check for duplicates
    if (data.name !== undefined && data.name !== existing.name) {
      if (data.name.trim() === '') {
        throw new Error('Cash register name cannot be empty')
      }

      const duplicate = await prisma.cashRegister.findFirst({
        where: { name: data.name, NOT: { id } }
      })

      if (duplicate) {
        throw new Error('A cash register with this name already exists')
      }
    }

    return prisma.cashRegister.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive
      }
    })
  }

  // Deactivate cash register
  static async deactivateCashRegister(id: string) {
    // Check if cash register exists
    const cashRegister = await prisma.cashRegister.findUnique({ where: { id } })
    if (!cashRegister) {
      throw new Error('Cash register not found')
    }

    // Check if there are any open sessions
    const openSession = await prisma.cashSession.findFirst({
      where: {
        cashRegisterId: id,
        status: 'OPEN'
      }
    })

    if (openSession) {
      throw new Error('Cannot deactivate cash register with an open session. Close the session first.')
    }

    return prisma.cashRegister.update({
      where: { id },
      data: { isActive: false }
    })
  }

  // Activate cash register
  static async activateCashRegister(id: string) {
    const cashRegister = await prisma.cashRegister.findUnique({ where: { id } })
    if (!cashRegister) {
      throw new Error('Cash register not found')
    }

    return prisma.cashRegister.update({
      where: { id },
      data: { isActive: true }
    })
  }

  // List cash registers
  static async listCashRegisters(options: {
    activeOnly?: boolean
    search?: string
    page?: number
    limit?: number
  } = {}) {
    const {
      activeOnly = false,
      search,
      page = 1,
      limit = 10
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.CashRegisterWhereInput = {}

    if (activeOnly) {
      where.isActive = true
    }

    if (search) {
      where.name = {
        contains: search, mode: "insensitive" as const
      } as Prisma.StringFilter<"CashRegister">
    }

    const [cashRegisters, total] = await Promise.all([
      prisma.cashRegister.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      }),
      prisma.cashRegister.count({ where })
    ])

    return {
      cashRegisters,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get cash register statistics
  static async getCashRegisterStatistics(id: string) {
    const cashRegister = await prisma.cashRegister.findUnique({
      where: { id },
      include: {
        sessions: {
          include: {
            movements: true,
            sales: {
              include: {
                payments: true
              }
            }
          }
        }
      }
    })

    if (!cashRegister) {
      throw new Error('Cash register not found')
    }

    // Calculate statistics
    const totalSessions = cashRegister.sessions.length
    const openSessions = cashRegister.sessions.filter((s: any) => s.status === 'OPEN').length
    const closedSessions = cashRegister.sessions.filter((s: any) => s.status === 'CLOSED').length

    // Calculate total processed amount
    let totalProcessed = 0
    let totalCashSales = 0

    for (const session of cashRegister.sessions) {
      // Add opening amount of the session
      totalProcessed += Number(session.openingAmount)

      // Sum cash movements
      for (const movement of session.movements) {
        // Adjust total based on movement type
        switch (movement.type) {
          case 'SALE':
          case 'DEPOSIT':
            totalProcessed += Number(movement.amount)
            if (movement.type === 'SALE') {
              totalCashSales += Number(movement.amount)
            }
            break
          case 'WITHDRAWAL':
            totalProcessed -= Number(movement.amount)
            break
          case 'ADJUSTMENT':
            // For adjustments, the amount itself carries the sign
            totalProcessed += Number(movement.amount)
            break
          case 'OPENING':
            // Opening movements are already accounted for in session.openingAmount
            break
          default:
            // For any other types, treat as positive addition
            totalProcessed += Number(movement.amount)
            break
        }
      }

      // Sum sales
      for (const sale of session.sales) {
        for (const payment of sale.payments) {
          if (payment.status === 'PAID') {
            totalProcessed += Number(payment.amount)
            if (payment.method === 'CASH') {
              totalCashSales += Number(payment.amount)
            }
          }
        }
      }
    }

    return {
      cashRegister: {
        id: cashRegister.id,
        name: cashRegister.name,
        isActive: cashRegister.isActive
      },
      statistics: {
        totalSessions,
        openSessions,
        closedSessions,
        totalProcessedAmount: totalProcessed,
        totalCashSalesAmount: totalCashSales
      }
    }
  }
}

export default CashRegisterService