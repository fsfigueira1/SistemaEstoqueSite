import { PrismaClient, Prisma } from "../generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { StockMovementType } from "../generated/prisma/client"

// Import the shared PrismaClient instance to prevent SQLite_BUSY errors with multiple connections
import { prisma } from "../lib/prisma"

// Define input types
type StockAdjustmentInput = {
  productId: string
  quantity: number // Always positive, type determines direction
  performedById: string
  reference?: string | null
  notes?: string | null
}

type StockOperationInput = {
  productId: string
  quantity: number // Always positive
  performedById: string
  reference?: string | null
  notes?: string | null
}

export class StockService {
  // Get current stock for a product
  static async getStock(productId: string) {
    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new Error('Product not found')
    }

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      currentStock: product.stockQuantity,
      minStockLevel: product.minStockLevel,
      maxStockLevel: product.maxStockLevel,
      status: product.status
    }
  }

  // Add stock to product (always creates a StockMovement)
  static async addStock(input: StockOperationInput) {
    // Validate inputs
    if (!input.productId) throw new Error('Product ID is required')
    if (!input.performedById) throw new Error('Performed by ID is required')
    if (input.quantity <= 0) throw new Error('Quantity must be positive')

    // Verify product exists and is active
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) {
      throw new Error('Product not found')
    }
    if (product.status !== 'ACTIVE') {
      throw new Error('Cannot modify stock for inactive or discontinued product')
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: {
            increment: input.quantity
          }
        }
      })

      // Create stock movement record
      const stockMovement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          quantity: input.quantity,
          type: StockMovementType.ADJUSTMENT_IN,
          performedById: input.performedById,
          reference: input.reference,
          notes: input.notes,
          createdAt: new Date()
        }
      })

      return {
        product: updatedProduct,
        stockMovement
      }
    })
  }

  // Remove stock from product (always creates a StockMovement)
  static async removeStock(input: StockOperationInput) {
    // Validate inputs
    if (!input.productId) throw new Error('Product ID is required')
    if (!input.performedById) throw new Error('Performed by ID is required')
    if (input.quantity <= 0) throw new Error('Quantity must be positive')

    // Verify product exists and is active
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) {
      throw new Error('Product not found')
    }
    if (product.status !== 'ACTIVE') {
      throw new Error('Cannot modify stock for inactive or discontinued product')
    }

    // Check if sufficient stock exists
    const currentStock = await this.getStock(productId)
    if (currentStock.currentStock < input.quantity) {
      throw new Error('Insufficient stock')
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: {
            decrement: input.quantity
          }
        }
      })

      // Create stock movement record
      const stockMovement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          quantity: input.quantity,
          type: StockMovementType.ADJUSTMENT_OUT,
          performedById: input.performedById,
          reference: input.reference,
          notes: input.notes,
          createdAt: new Date()
        }
      })

      return {
        product: updatedProduct,
        stockMovement
      }
    })
  }

  // Adjust stock to a specific level (creates a StockMovement)
  static async adjustStock(input: StockAdjustmentInput) {
    // Validate inputs
    if (!input.productId) throw new Error('Product ID is required')
    if (!input.performedById) throw new Error('Performed by ID is required')
    if (input.quantity === 0) throw new Error('Quantity must not be zero')

    // Verify product exists and is active
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) {
      throw new Error('Product not found')
    }
    if (product.status !== 'ACTIVE') {
      throw new Error('Cannot modify stock for inactive or discontinued product')
    }

    // Get current stock
    const currentStock = await this.getStock(productId)

    // Calculate the difference needed to reach target quantity
    // If quantity is positive, we need to ADD (target - current)
    // If quantity is negative, we need to SUBTRACT (current - target)
    const difference = input.quantity - currentStock.currentStock

    // If no adjustment needed, return early
    if (difference === 0) {
      return {
        product: await prisma.product.findUnique({ where: { id: input.productId } }),
        stockMovement: null
      }
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: {
            increment: difference
          }
        }
      })

      // Create stock movement record
      const stockMovement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          quantity: Math.abs(difference), // Always positive
          type: difference > 0 ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
          performedById: input.performedById,
          reference: input.reference,
          notes: input.notes,
          createdAt: new Date()
        }
      })

      return {
        product: updatedProduct,
        stockMovement
      }
    })
  }

  // Get stock movements for a product
  static async getStockMovements(productId: string, options: {
    limit?: number
    page?: number
    startDate?: Date
    endDate?: Date
  } = {}) {
    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new Error('Product not found')
    }

    const {
      limit = 10,
      page = 1,
      startDate,
      endDate
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.StockMovementWhereInput = {
      productId
    }

    if (startDate) { where.createdAt = { gte: startDate } }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [stockMovements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, sku: true }
          },
          performedBy: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.stockMovement.count({ where })
    ])

    return {
      stockMovements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }
}

export default StockService