import { Prisma, StockMovementType } from "../generated/prisma/client"
// Instância compartilhada do PrismaClient (Postgres) — evita abrir conexões extras
import { prisma } from "../lib/prisma"
import { outReason, outReasonError, reasonNote, type StockOutReason } from "../lib/stockReasons"

// Define input types
type StockAdjustmentInput = {
  productId: string
  quantity: number // Always positive, type determines direction
  performedById: string
  reference?: string | null
  notes?: string | null
  /** contagem que DIMINUI o estoque precisa do motivo (src/lib/stockReasons.ts) */
  reason?: StockOutReason | null
}

type StockOperationInput = {
  productId: string
  quantity: number // Always positive
  performedById: string
  reference?: string | null
  notes?: string | null
  /** saída: motivo obrigatório; a explicação vai em notes */
  reason?: StockOutReason | null
}

/** Saída manual: motivo + explicação obrigatórios; devolve o tipo e a observação gravada. */
function outMovement(input: { reason?: StockOutReason | null; notes?: string | null }) {
  const err = outReasonError(input.reason, input.notes)
  const r = outReason(input.reason)
  if (err || !r) throw new Error(err ?? "Escolha o motivo da saída")
  return { type: StockMovementType[r.type], notes: reasonNote(r.id, String(input.notes)) }
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- API antiga (StockService.x) usada em muitas telas e testes
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
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    const out = outMovement(input)

    // Check if sufficient stock exists
    const currentStock = await this.getStock(input.productId)
    if (currentStock.currentStock < input.quantity) {
      throw new Error('Insufficient stock')
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          type: out.type,
          performedById: input.performedById,
          reference: input.reference,
          notes: out.notes,
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
    // quantity = estoque final (contagem); zero é válido (acabou na prateleira)
    if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new Error('Stock cannot be negative')

    // Verify product exists and is active
    const product = await prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) {
      throw new Error('Product not found')
    }
    if (product.status !== 'ACTIVE') {
      throw new Error('Cannot modify stock for inactive or discontinued product')
    }

    // Get current stock
    const currentStock = await this.getStock(input.productId)

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

    // contagem que diminui = saída: precisa do motivo
    const out = difference < 0 ? outMovement(input) : null

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          type: out ? out.type : StockMovementType.ADJUSTMENT_IN,
          performedById: input.performedById,
          reference: input.reference,
          notes: out ? out.notes : input.notes,
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
    /** só um tipo (ex.: LOSS) */
    type?: StockMovementType | `${StockMovementType}`
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
      productId,
      ...(options.type ? { type: options.type as StockMovementType } : {})
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

  /** Ativos com estoque no mínimo ou abaixo (o painel mostra para repor). */
  static async getLowStockProducts() {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { stockQuantity: 'asc' },
      select: { id: true, name: true, sku: true, stockQuantity: true, minStockLevel: true },
    })
    return products.filter((p) => p.stockQuantity <= p.minStockLevel)
  }

  /** Ativos zerados (inativos/descontinuados não entram). */
  static async getOutOfStockProducts() {
    return prisma.product.findMany({
      where: { status: 'ACTIVE', stockQuantity: { lte: 0 } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, stockQuantity: true, minStockLevel: true },
    })
  }
}
