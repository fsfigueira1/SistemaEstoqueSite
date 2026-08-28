import { prisma, Prisma } from "../../lib/lib/prisma"

// Define input types for price history operations
type PriceHistoryCreateInput = {
  productId: string
  previousPrice: number | Prisma.Decimal
  newPrice: number | Prisma.Decimal
  changedById: string
  reason?: string | null
}

type PriceHistoryUpdateInput = {
  reason?: string | null
}

export class PriceHistoryService {
  // Get all price history records with filters
  static async getPriceHistory(filters: {
    productId?: string
    startDate?: Date
    endDate?: Date
    changedById?: string
    page?: number
    limit?: number
  }) {
    const {
      productId,
      startDate,
      endDate,
      changedById,
      page = 1,
      limit = 10
    } = filters

    const skip = (page - 1) * limit
    const where: Prisma.PriceHistoryWhereInput = {}

    if (productId) where.productId = productId
    if (startDate) where.changedAt = { gte: startDate }
    if (endDate) {
      where.changedAt = {
        ...(where.changedAt as Record<string, unknown>),
        lte: endDate
      }
    }
    if (changedById) where.changedById = changedById

    const [priceHistory, total] = await Promise.all([
      prisma.priceHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { changedAt: 'desc' }
      }),
      prisma.priceHistory.count({ where })
    ])

    // Convert Decimal values to numbers for consistency with test expectations
    const priceHistoryWithNumbers = priceHistory.map((record: any) => ({
      ...record,
      previousPrice: record.previousPrice.toNumber(),
      newPrice: record.newPrice.toNumber()
    }))

    return {
      priceHistory: priceHistoryWithNumbers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get price history record by ID
  static async getPriceHistoryById(id: string) {
    const priceHistoryRecord = await prisma.priceHistory.findUnique({
      where: { id }
    })

    if (!priceHistoryRecord) {
      throw new Error('Price history record not found')
    }

    // Convert Decimal values to numbers for consistency with test expectations
    return {
      ...priceHistoryRecord,
      previousPrice: priceHistoryRecord.previousPrice.toNumber(),
      newPrice: priceHistoryRecord.newPrice.toNumber()
    }
  }

  // Get price history for a specific product
  static async getPriceHistoryByProduct(productId: string, options: {
    startDate?: Date
    endDate?: Date
    changedById?: string
    page?: number
    limit?: number
  } = {}) {
    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new Error('Product not found')
    }

    const {
      startDate,
      endDate,
      changedById,
      page = 1,
      limit = 10
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.PriceHistoryWhereInput = { productId }

    if (startDate) where.changedAt = { gte: startDate }
    if (endDate) {
      where.changedAt = {
        ...(where.changedAt as Record<string, unknown>),
        lte: endDate
      }
    }
    if (changedById) where.changedById = changedById

    const [priceHistory, total] = await Promise.all([
      prisma.priceHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { changedAt: 'desc' }
      }),
      prisma.priceHistory.count({ where })
    ])

    // Convert Decimal values to numbers for consistency with test expectations
    const priceHistoryWithNumbers = priceHistory.map((record: any) => ({
      ...record,
      previousPrice: record.previousPrice.toNumber(),
      newPrice: record.newPrice.toNumber()
    }))

    return {
      priceHistory: priceHistoryWithNumbers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get the latest price for a product
  static async getLatestPrice(productId: string) {
    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new Error('Product not found')
    }

    const latestRecord = await prisma.priceHistory.findFirst({
      where: { productId },
      orderBy: { changedAt: 'desc' }
    })

    if (!latestRecord) {
      // If no history exists, return current product prices
      return {
        productId,
        currentCostPrice: product.costPrice.toNumber(),
        currentSalePrice: product.salePrice.toNumber(),
        hasHistory: false
      }
    }

    return {
      productId,
      previousPrice: latestRecord.previousPrice.toNumber(),
      newPrice: latestRecord.newPrice.toNumber(),
      changedById: latestRecord.changedById,
      reason: latestRecord.reason,
      changedAt: latestRecord.changedAt,
      hasHistory: true
    }
  }

  // Get price history summary for a product
  static async getPriceHistorySummary(productId: string) {
    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new Error('Product not found')
    }

    // Get aggregates
    const result = await prisma.priceHistory.aggregate({
      where: { productId },
      _count: true,
      _avg: {
        previousPrice: true,
        newPrice: true
      },
      _sum: {
        previousPrice: true,
        newPrice: true
      }
    })

    // Get first and last records for range
    const firstRecord = await prisma.priceHistory.findFirst({
      where: { productId },
      orderBy: { changedAt: 'asc' }
    })

    const lastRecord = await prisma.priceHistory.findFirst({
      where: { productId },
      orderBy: { changedAt: 'desc' }
    })

    return {
      productId,
      totalChanges: result._count,
      averageChange: {
        previousPrice: result._avg.previousPrice ? result._avg.previousPrice.toNumber() : 0,
        newPrice: result._avg.newPrice ? result._avg.newPrice.toNumber() : 0
      },
      totalChange: {
        previousPrice: result._sum.previousPrice ? result._sum.previousPrice.toNumber() : 0,
        newPrice: result._sum.newPrice ? result._sum.newPrice.toNumber() : 0
      },
      firstChange: firstRecord ? {
        previousPrice: firstRecord.previousPrice.toNumber(),
        newPrice: firstRecord.newPrice.toNumber(),
        changedAt: firstRecord.changedAt
      } : null,
      lastChange: lastRecord ? {
        previousPrice: lastRecord.previousPrice.toNumber(),
        newPrice: lastRecord.newPrice.toNumber(),
        changedAt: lastRecord.changedAt
      } : null,
      currentPrice: {
        costPrice: product.costPrice.toNumber(),
        salePrice: product.salePrice.toNumber()
      }
    }
  }
}