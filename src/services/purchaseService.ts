import { PrismaClient, Prisma, ProductStatus  } from "../generated/prisma/client.ts"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"


// Initialize PrismaClient with SQLite adapter
// Use test database when in test environment
const databaseUrl = process.env.NODE_ENV === 'test'
  ? "file:./test.db"
  : "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
import { prisma } from "../lib/prisma"
// const prisma = new PrismaClient({ adapter }) - REMOVED to use shared instance;

// Define input types
type CreatePurchaseOrderInput = {
  supplierId: string
  expectedDate?: Date | null
  notes?: string | null
  createdById: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice?: number | Prisma.Decimal // Support both unitPrice and unitCost
    unitCost?: number | Prisma.Decimal
    discountAmount?: number | Prisma.Decimal | null // Per-item discount
  }>
  taxRate?: number | Prisma.Decimal // As percentage (0.15 for 15%)
  discountAmount?: number | Prisma.Decimal // Fixed discount amount
}

type UpdatePurchaseOrderInput = {
  supplierId?: string
  expectedDate?: Date | null
  notes?: string | null
  updatedById?: string | null
}

export class PurchaseService {
  // Create a new purchase order
  static async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    // Validate inputs
    if (!input.supplierId) throw new Error('Supplier ID is required')
    if (!input.createdById) throw new Error('Created by ID is required')
    if (!input.items || input.items.length === 0) throw new Error('Purchase order must have at least one item')

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId }
    })

    if (!supplier) {
      throw new Error('Supplier not found')
    }

    // Validate taxRate if provided
    if (input.taxRate !== undefined && input.taxRate !== null) {
      if (Number(input.taxRate) < 0) {
        throw new Error('Tax rate cannot be negative')
      }
    }

    // Validate discountAmount if provided
    if (input.discountAmount !== undefined && input.discountAmount !== null) {
      if (Number(input.discountAmount) < 0) {
        throw new Error('Discount amount cannot be negative')
      }
    }

    // Validate items
    for (const item of input.items) {
      if (!item.productId) throw new Error('Product ID is required for each item')
      if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be positive for each item')

      // Support both unitPrice and unitCost (backward compatibility with tests)
      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
        ? item.unitPrice
        : item.unitCost

      if (!unitPrice || Number(unitPrice) <= 0) throw new Error('Unit cost must be positive for each item')

      // Validate per-item discount if provided
      if (item.discountAmount !== undefined && item.discountAmount !== null) {
        if (Number(item.discountAmount) < 0) {
          throw new Error('Discount amount cannot be negative for each item')
        }
      }

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`)
      }

      // Verify product is active
      if (product.status !== ProductStatus.ACTIVE) {
        throw new Error(`Cannot purchase inactive or discontinued product: ${product.name}`)
      }
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Calculate total amount
      let subtotal = 0
      let totalTax = 0
      let totalDiscount = 0

      for (const item of input.items) {
        // Support both unitPrice and unitCost (backward compatibility with tests)
        const unitPrice = ((item.unitPrice !== undefined && item.unitPrice !== null)
          ? item.unitPrice
          : (item.unitCost !== undefined && item.unitCost !== null)
            ? item.unitCost
            : 0) as number
        const quantity = Number(item.quantity)
        const itemSubtotal = Number(unitPrice) * quantity

        // Apply per-item discount
        const itemDiscount = item.discountAmount !== undefined && item.discountAmount !== null
          ? Number(item.discountAmount)
          : 0
        const discountedItemTotal = itemSubtotal - itemDiscount

        subtotal += itemSubtotal
        totalDiscount += itemDiscount
      }

      // Apply fixed discount
      const fixedDiscount = input.discountAmount !== undefined && input.discountAmount !== null
        ? Number(input.discountAmount)
        : 0
      totalDiscount += fixedDiscount

      // Calculate subtotal after all discounts
      const discountedSubtotal = subtotal - totalDiscount

      // Calculate tax on discounted subtotal
      if (input.taxRate !== undefined && input.taxRate !== null) {
        const taxRate = Number(input.taxRate)
        totalTax = discountedSubtotal * taxRate
      }

      // Calculate final total
      const totalAmount = discountedSubtotal + totalTax

      // Create purchase order
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          supplierId: input.supplierId,
          expectedDate: input.expectedDate ?? null,
          notes: input.notes ?? null,
          totalAmount: new Prisma.Decimal(totalAmount),
          createdById: input.createdById,
          updatedById: input.createdById // Initially set to creator
        }
      })

      // Create purchase order items
      const createdItems = []
      for (const item of input.items) {
        // Support both unitPrice and unitCost (backward compatibility with tests)
        // Validate that at least one is provided
        if ((item.unitPrice === undefined || item.unitPrice === null) &&
            (item.unitCost === undefined || item.unitCost === null)) {
          throw new Error('Either unitPrice or unitCost must be provided for each item')
        }

        // Prefer unitPrice when both are provided, otherwise use unitCost
        const unitPrice = ((item.unitPrice !== undefined && item.unitPrice !== null)
          ? item.unitPrice
          : (item.unitCost !== undefined && item.unitCost !== null)
            ? item.unitCost
            : 0) as number

        const quantity = Number(item.quantity)
        const itemSubtotal = unitPrice * quantity

        // Apply per-item discount
        const itemDiscount = item.discountAmount !== undefined && item.discountAmount !== null
          ? Number(item.discountAmount)
          : 0
        const itemTotal = itemSubtotal - itemDiscount

        const purchaseOrderItem = await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(Number(unitPrice)),
            totalPrice: new Prisma.Decimal(itemTotal)
          }
        })
        createdItems.push(purchaseOrderItem)
      }

      return {
        purchaseOrder: {
          ...purchaseOrder,
          totalAmount: purchaseOrder.totalAmount.toNumber() // Convert to number for test compatibility
        },
        items: createdItems.map(item => ({
          ...item,
          unitPrice: item.unitPrice ? item.unitPrice.toNumber() : undefined,
          totalPrice: item.totalPrice.toNumber()
        })),
        totalAmount: totalAmount // Return as number for test compatibility
      }
    })
  }

  // Get purchase order by ID
  static async getPurchaseOrderById(id: string) {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: true,
        updatedBy: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    })

    if (!purchaseOrder) {
      throw new Error('Purchase order not found')
    }

    // Convert Decimal fields to numbers for test compatibility
    return {
      ...purchaseOrder,
      totalAmount: purchaseOrder.totalAmount.toNumber()
    }
  }

  // Update purchase order
  static async updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput) {
    // Check if purchase order exists
    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true
      }
    })

    if (!existing) {
      throw new Error('Purchase order not found')
    }

    // Validate supplier if being updated
    if (input.supplierId !== undefined) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: input.supplierId }
      })

      if (!supplier) {
        throw new Error('Supplier not found')
      }
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Update purchase order
      const updatedPurchaseOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: input.supplierId,
          expectedDate: input.expectedDate ?? null,
          notes: input.notes ?? null,
          updatedById: input.updatedById,
          updatedAt: new Date()
        }
      })

      // Convert Decimal fields to numbers for test compatibility
      return {
        ...updatedPurchaseOrder,
        totalAmount: updatedPurchaseOrder.totalAmount.toNumber()
      }
    })
  }

  // Add items to purchase order
  static async addItemsToPurchaseOrder(purchaseOrderId: string, items: Array<{
    productId: string
    quantity: number
    unitPrice?: number | Prisma.Decimal
    unitCost?: number | Prisma.Decimal
    discountAmount?: number | Prisma.Decimal | null
  }>, addedById: string) {
    // Validate inputs
    if (!purchaseOrderId) throw new Error('Purchase order ID is required')
    if (!items || items.length === 0) throw new Error('Must provide at least one item')
    if (!addedById) throw new Error('Added by ID is required')

    // Verify purchase order exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true
      }
    })

    if (!purchaseOrder) {
      throw new Error('Purchase order not found')
    }

    // Validate items
    for (const item of items) {
      if (!item.productId) throw new Error('Product ID is required for each item')
      if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be positive for each item')

      // Support both unitPrice and unitCost (backward compatibility with tests)
      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
        ? item.unitPrice
        : item.unitCost

      if (!unitPrice || Number(unitPrice) <= 0) throw new Error('Unit cost must be positive for each item')

      // Validate per-item discount if provided
      if (item.discountAmount !== undefined && item.discountAmount !== null) {
        if (Number(item.discountAmount) < 0) {
          throw new Error('Discount amount cannot be negative for each item')
        }
      }

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`)
      }

      // Verify product is active
      if (product.status !== ProductStatus.ACTIVE) {
        throw new Error(`Cannot purchase inactive or discontinued product: ${product.name}`)
      }
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Get current purchase order total
      let totalAmount = Number(purchaseOrder.totalAmount)

      // Add new items
      const createdItems = []
      for (const item of items) {
        // Support both unitPrice and unitCost (backward compatibility with tests)
        // Validate that at least one is provided
        if ((item.unitPrice === undefined || item.unitPrice === null) &&
            (item.unitCost === undefined || item.unitCost === null)) {
          throw new Error('Either unitPrice or unitCost must be provided for each item')
        }

        // Prefer unitPrice when both are provided, otherwise use unitCost
        const unitPrice = ((item.unitPrice !== undefined && item.unitPrice !== null)
          ? item.unitPrice
          : (item.unitCost !== undefined && item.unitCost !== null)
            ? item.unitCost
            : 0) as number

        const quantity = Number(item.quantity)
        const itemSubtotal = unitPrice * quantity

        // Apply per-item discount
        const itemDiscount = item.discountAmount !== undefined && item.discountAmount !== null
          ? Number(item.discountAmount)
          : 0
        const itemTotal = itemSubtotal - itemDiscount

        const purchaseOrderItem = await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(Number(unitPrice)),
            totalPrice: new Prisma.Decimal(itemTotal)
          }
        })
        createdItems.push(purchaseOrderItem)
        totalAmount += itemTotal
      }

      // Update purchase order total
      const updatedPurchaseOrder = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          totalAmount: new Prisma.Decimal(totalAmount),
          updatedById: addedById,
          updatedAt: new Date()
        }
      })

      return {
        purchaseOrder: {
          ...updatedPurchaseOrder,
          totalAmount: updatedPurchaseOrder.totalAmount.toNumber()
        },
        items: createdItems,
        totalAmount: totalAmount
      }
    })
  }

  // Remove items from purchase order
  static async removeItemsFromPurchaseOrder(purchaseOrderId: string, itemIds: string[], removedById: string) {
    // Validate inputs
    if (!purchaseOrderId) throw new Error('Purchase order ID is required')
    if (!itemIds || itemIds.length === 0) throw new Error('Must provide at least one item ID to remove')
    if (!removedById) throw new Error('Removed by ID is required')

    // Verify purchase order exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true
      }
    })

    if (!purchaseOrder) {
      throw new Error('Purchase order not found')
    }

    // Verify items exist and belong to this purchase order
    const itemsToRemove = await prisma.purchaseOrderItem.findMany({
      where: {
        id: { in: itemIds },
        purchaseOrderId
      }
    })

    if (itemsToRemove.length !== itemIds.length) {
      throw new Error('Some items not found or do not belong to this purchase order')
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Delete the items
      await tx.purchaseOrderItem.deleteMany({
        where: {
          id: { in: itemIds }
        }
      })

      // Recalculate total amount
      let totalAmount = 0
      const remainingItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId }
      })

      for (const item of remainingItems) {
        totalAmount += Number(item.unitPrice) * Number(item.quantity)
      }

      // Update purchase order total
      const updatedPurchaseOrder = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          totalAmount: new Prisma.Decimal(totalAmount),
          updatedById: removedById,
          updatedAt: new Date()
        }
      })

      return {
        purchaseOrder: {
          ...updatedPurchaseOrder,
          totalAmount: updatedPurchaseOrder.totalAmount.toNumber()
        },
        removedItemsCount: itemIds.length,
        remainingItemsCount: remainingItems.length,
        totalAmount: totalAmount
      }
    })
  }

  // List purchase orders
  static async listPurchaseOrders(options: {
    supplierId?: string
    createdById?: string
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      supplierId,
      createdById,
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.PurchaseOrderWhereInput = {}

    if (supplierId) {
      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId }
      })

      if (!supplier) {
        throw new Error('Supplier not found')
      }

      where.supplierId = supplierId
    }

    if (createdById) where.createdById = createdById
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { id: true, name: true }
          },
          createdBy: {
            select: { id: true, name: true }
          },
          updatedBy: {
            select: { id: true, name: true }
          },
          items: {
            take: 3, // Limit items in list view
            select: { id: true, quantity: true, totalPrice: true }
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ])

    // Convert Decimal fields to numbers for test compatibility
    const ordersWithNumbers = purchaseOrders.map(order => ({
      ...order,
      totalAmount: order.totalAmount.toNumber()
    }))

    return {
      purchaseOrders: ordersWithNumbers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get purchase order statistics
  static async getPurchaseOrderStatistics(options: {
    supplierId?: string
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      supplierId,
      startDate,
      endDate
    } = options

    const where: Prisma.PurchaseOrderWhereInput = {}
    if (supplierId) where.supplierId = supplierId
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    // Get aggregates
    const result = await prisma.purchaseOrder.aggregate({
      where,
      _sum: {
        totalAmount: true
      },
      _avg: {
        totalAmount: true
      },
      _count: true
    })

    return {
      count: result._count,
      totals: {
        totalAmount: result._sum.totalAmount ? result._sum.totalAmount.toNumber() : 0
      },
      averages: {
        totalAmount: result._avg.totalAmount ? result._avg.totalAmount.toNumber() : 0
      }
    }
  }

  // Create a purchase (alias for createPurchaseOrder for test compatibility)
  static async createPurchase(input: CreatePurchaseOrderInput) {
    const result = await this.createPurchaseOrder(input);
    // Return format expected by tests: direct access to id field
    return {
      ...result.purchaseOrder,
      id: result.purchaseOrder.id,
      items: result.items,
      totalAmount: result.totalAmount
    };
  }

  // Complete purchase (placeholder for future implementation)
  static async completePurchase(id: string) {
    // Check if purchase exists first to throw correct error
    try {
      await this.getPurchaseOrderById(id)
    } catch (error) {
      if (error instanceof Error && error.message === 'Purchase order not found') {
        throw new Error('Purchase not found')
      }
      throw error
    }

    // Now get the purchase for status checking
    const purchase = await this.getPurchaseOrderById(id)

    // Check if already completed
    if (purchase.status === 'COMPLETED') {
      throw new Error('Purchase is already completed')
    }

    // Check if cancelled
    if (purchase.status === 'CANCELLED') {
      throw new Error('Cannot complete a cancelled purchase')
    }

    // Update the purchase status to completed
    const updatedPurchase = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    })

    // Return the updated purchase for test compatibility
    return {
      ...updatedPurchase,
      totalAmount: updatedPurchase.totalAmount.toNumber()
    }
  }

  // Cancel purchase (placeholder for future implementation)
  static async cancelPurchase(id: string) {
    // Check if purchase exists first to throw correct error
    try {
      await this.getPurchaseOrderById(id)
    } catch (error) {
      if (error instanceof Error && error.message === 'Purchase order not found') {
        throw new Error('Purchase not found')
      }
      throw error
    }

    // Now get the purchase for status checking
    const purchase = await this.getPurchaseOrderById(id)

    // Check if already cancelled
    if (purchase.status === 'CANCELLED') {
      throw new Error('Purchase is already cancelled')
    }

    // Check if completed
    if (purchase.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed purchase')
    }

    // Update the purchase status to cancelled
    const updatedPurchase = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    })

    // Return the updated purchase for test compatibility
    return {
      ...updatedPurchase,
      totalAmount: updatedPurchase.totalAmount.toNumber()
    }
  }

  // Receive purchase (placeholder for future implementation)
  static async receivePurchase(id: string) {
    // Check if purchase exists first to throw correct error
    try {
      await this.getPurchaseOrderById(id)
    } catch (error) {
      if (error instanceof Error && error.message === 'Purchase order not found') {
        throw new Error('Purchase not found')
      }
      throw error
    }
    throw new Error('Receive purchase method not implemented')
  }
}

export default PurchaseService