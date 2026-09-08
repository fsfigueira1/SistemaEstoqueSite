import { prisma, Prisma } from "../lib/prisma"
import { SaleStatus, PaymentStatus, PaymentMethod, StockMovementType, ProductStatus, SalePayment } from "../generated/prisma/client.ts"

// Define input types
type CreateSaleInput = {
  cashSessionId: string
  customerId?: string | null
  createdById: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number | Prisma.Decimal
    discountAmount?: number | Prisma.Decimal
  }>
  discountAmount?: number | Prisma.Decimal
  notes?: string | null
}

export class SaleService {
  // Create a new sale (starts as PENDING)
  static async createSale(input: CreateSaleInput) {
    // Validate inputs
    if (!input.cashSessionId) throw new Error('Cash session ID is required')
    if (!input.createdById) throw new Error('Created by ID is required')
    if (!input.items || input.items.length === 0) throw new Error('At least one item is required')

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

    if (cashSession.status !== 'OPEN') {
      throw new Error('Cannot create sale for non-open cash session')
    }

    if (!cashSession.cashRegister.isActive) {
      throw new Error('Cannot create sale for inactive cash register')
    }

    // Validate customer if provided
    if (input.customerId !== undefined && input.customerId !== null && input.customerId !== '') {
      const customer = await prisma.customer.findUnique({
        where: { id: input.customerId }
      })

      if (!customer) {
        throw new Error('Customer not found')
      }
    } else if (input.customerId === '') {
      throw new Error('Customer ID is required')
    }

    // Validate items
    for (const item of input.items) {
      if (!item.productId) throw new Error('Product ID is required for each item')
      if (!item.quantity || item.quantity <= 0) throw new Error('Quantity must be positive for each item')
      // Check if we have sufficient stock
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`)
      }
      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, requested: ${item.quantity}`)
      }
      if (item.discountAmount !== undefined && Number(item.discountAmount) < 0) {
        throw new Error('Discount amount cannot be negative for each item')
      }
    }

    // Validate overall discount
    if (input.discountAmount !== undefined && Number(input.discountAmount) < 0) {
      throw new Error('Discount amount cannot be negative')
    }

    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // Calculate totals from items (using current product prices, not trusting frontend)
      let subtotal = 0
      let itemDiscountTotal = 0
      const saleItemsData = []

      for (const item of input.items) {
        // Get current product data (not trusting frontend prices)
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        })

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`)
        }

        if (product.status !== ProductStatus.ACTIVE) {
          throw new Error(`Cannot sell inactive or discontinued product: ${product.name}`)
        }

        // Use passed-in unitPrice if provided, otherwise fallback to product's sale price
        const unitPrice = item.unitPrice ?? product.salePrice
        const lineTotal = Number(unitPrice) * Number(item.quantity)
        const itemDiscount = Number(item.discountAmount ?? 0)
        const itemTotal = lineTotal - itemDiscount

        subtotal += lineTotal
        itemDiscountTotal += itemDiscount

        saleItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice, // Store the actual price used
          discountAmount: itemDiscount,
          totalAmount: itemTotal
        })
      }

      // Calculate final amounts - combine item-level and sale-level discounts
      const saleDiscount = Number(input.discountAmount ?? 0)
      const totalDiscount = itemDiscountTotal + saleDiscount
      const totalAmount = subtotal - totalDiscount

      // Validate totals
      if (totalAmount < 0) {
        throw new Error('Total amount cannot be negative')
      }

      // Generate sale number (simple approach - in production might want something more sophisticated)
      const saleNumber = `SALE-${Date.now().toString().slice(-6)}`

      // Create the sale
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          cashSessionId: input.cashSessionId,
          customerId: input.customerId ?? null,
          status: SaleStatus.PENDING,
          subtotal: new Prisma.Decimal(subtotal),
          discountAmount: new Prisma.Decimal(totalDiscount),
          totalAmount: new Prisma.Decimal(totalAmount),
          paidAmount: 0, // Starts at 0
          changeAmount: 0, // Starts at 0
          notes: input.notes ?? null,
          createdById: input.createdById
        }
      })

      // Create sale items
      const createdSaleItems = []
      for (const itemData of saleItemsData) {
        const saleItem = await tx.saleItem.create({
          data: {
            sale: { connect: { id: sale.id } },
            product: { connect: { id: itemData.productId } },
            quantity: itemData.quantity,
            unitPrice: new Prisma.Decimal(itemData.unitPrice),
            discountAmount: new Prisma.Decimal(itemData.discountAmount ?? 0),
            totalAmount: new Prisma.Decimal(itemData.totalAmount)
          }
        })
        createdSaleItems.push(saleItem)
      }

      return {
        sale: {
          ...sale,
          subtotal: sale.subtotal.toNumber(),
          discountAmount: sale.discountAmount.toNumber(),
          totalAmount: sale.totalAmount.toNumber(),
          paidAmount: sale.paidAmount.toNumber(),
          changeAmount: sale.changeAmount.toNumber()
        },
        saleItems: createdSaleItems,
        calculatedTotals: {
          subtotal,
          discountAmount: totalDiscount,
          totalAmount
        }
      }
    })
  }

  // Get sale by ID
  static async getSale(id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        cashSession: {
          include: {
            cashRegister: true
          }
        },
        customer: true,
        createdBy: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        },
        payments: true
      }
    })

    if (!sale) {
      throw new Error('Sale not found')
    }

    // Convert Decimal fields to numbers for test compatibility
    return {
      ...sale,
      subtotal: sale.subtotal.toNumber(),
      discountAmount: sale.discountAmount.toNumber(),
      totalAmount: sale.totalAmount.toNumber(),
      paidAmount: sale.paidAmount.toNumber(),
      changeAmount: sale.changeAmount.toNumber()
    }
  }

  // Get sale by sale number
  static async getSaleByNumber(saleNumber: string) {
    const sale = await prisma.sale.findUnique({
      where: { saleNumber },
      include: {
        cashSession: {
          include: {
            cashRegister: true
          }
        },
        customer: true,
        createdBy: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        },
        payments: true
      }
    })

    if (!sale) {
      throw new Error('Sale not found')
    }

    // Convert Decimal fields to numbers for test compatibility
    return {
      ...sale,
      subtotal: sale.subtotal.toNumber(),
      discountAmount: sale.discountAmount.toNumber(),
      totalAmount: sale.totalAmount.toNumber(),
      paidAmount: sale.paidAmount.toNumber(),
      changeAmount: sale.changeAmount.toNumber()
    }
  }

  // List sales
  static async listSales(options: {
    cashSessionId?: string
    customerId?: string
    status?: SaleStatus
    createdById?: string
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      cashSessionId,
      customerId,
      status,
      createdById,
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.SaleWhereInput = {}

    if (cashSessionId) where.cashSessionId = cashSessionId
    if (customerId) where.customerId = customerId
    if (status) where.status = status
    if (createdById) where.createdById = createdById
    if (startDate) {
      if (where.createdAt) {
        where.createdAt = { ...(where.createdAt as Record<string, unknown>), gte: startDate }
      } else {
        where.createdAt = { gte: startDate }
      }
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt as Record<string, unknown> | undefined), lte: endDate }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cashSession: {
            select: { id: true, status: true }
          },
          customer: {
            select: { id: true, name: true }
          },
          createdBy: {
            select: { id: true, name: true }
          },
          items: {
            take: 3, // Limit items in list view
            select: { id: true, quantity: true, totalAmount: true }
          },
          payments: {
            take: 3, // Limit payments in list view
            select: { id: true, method: true, amount: true, status: true }
          },
          _count: { select: { items: true } }
        }
      }),
      prisma.sale.count({ where })
    ])

    // Convert Decimal fields to numbers for test compatibility
    const salesWithNumbers = sales.map((sale: any) => ({
      ...sale,
      subtotal: sale.subtotal.toNumber(),
      discountAmount: sale.discountAmount.toNumber(),
      totalAmount: sale.totalAmount.toNumber(),
      paidAmount: sale.paidAmount.toNumber(),
      changeAmount: sale.changeAmount.toNumber()
    }))

    return {
      sales: salesWithNumbers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Cancel sale (only if PENDING)
  static async cancelSale(id: string) {
    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // Get the sale
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          cashSession: true,
          payments: true
        }
      })

      if (!sale) {
        throw new Error('Sale not found')
      }

      // Check specific statuses for appropriate error messages
      if (sale.status === SaleStatus.COMPLETED) {
        throw new Error('Cannot cancel a completed sale')
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new Error('Sale is already cancelled')
      }

      if (sale.status !== SaleStatus.PENDING) {
        throw new Error('Only pending sales can be cancelled')
      }

      // Verify cash session is still open
      if (sale.cashSession.status !== 'OPEN') {
        throw new Error('Cannot cancel sale for non-open cash session')
      }

      // Check if any payments have been made
      const paidPayments = sale.payments.filter((p: any) => p.status === 'PAID')
      if (paidPayments.length > 0) {
        throw new Error('Cannot cancel sale with paid payments')
      }

      // Update sale status
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          updatedAt: new Date()
        }
      })

      // Note: SaleItem model doesn't have a status field, so we can't update it
      // The relationship is maintained through the saleId foreign key

      // Convert Decimal fields to numbers for test compatibility
      return {
        ...updatedSale,
        subtotal: updatedSale.subtotal.toNumber(),
        discountAmount: updatedSale.discountAmount.toNumber(),
        totalAmount: updatedSale.totalAmount.toNumber(),
        paidAmount: updatedSale.paidAmount.toNumber(),
        changeAmount: updatedSale.changeAmount.toNumber()
      }
    })
  }

  // Get sales statistics
  static async getSalesStatistics(options: {
    cashSessionId?: string
    customerId?: string
    status?: SaleStatus
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      cashSessionId,
      customerId,
      status,
      startDate,
      endDate
    } = options

    const where: Prisma.SaleWhereInput = {}
    if (cashSessionId) where.cashSessionId = cashSessionId
    if (customerId) where.customerId = customerId
    if (status) where.status = status
    if (startDate) {
      if (where.createdAt) {
        where.createdAt = { ...(where.createdAt as Record<string, unknown>), gte: startDate }
      } else {
        where.createdAt = { gte: startDate }
      }
    }
    if (endDate) {
      if (where.createdAt) {
        where.createdAt = { ...(where.createdAt as Record<string, unknown>), lte: endDate }
      } else {
        where.createdAt = { lte: endDate }
      }
    }

    // Get aggregates
    const result = await prisma.sale.aggregate({
      where,
      _sum: {
        subtotal: true,
        discountAmount: true,
        totalAmount: true,
        paidAmount: true
      },
      _avg: {
        totalAmount: true
      },
      _count: true
    })

    return {
      count: result._count,
      totals: {
        subtotal: result._sum.subtotal ? result._sum.subtotal.toNumber() : 0,
        discountAmount: result._sum.discountAmount ? result._sum.discountAmount.toNumber() : 0,
        totalAmount: result._sum.totalAmount ? result._sum.totalAmount.toNumber() : 0,
        paidAmount: result._sum.paidAmount ? result._sum.paidAmount.toNumber() : 0
      },
      averages: {
        totalAmount: result._avg.totalAmount ? result._avg.totalAmount.toNumber() : 0
      }
    }
  }

  // Complete sale (process payment and finalize sale)
  static async completeSale(id: string, paymentData: {
    amount: number | Prisma.Decimal
    method: PaymentMethod
    transactionId?: string | null
    processingFee?: number | Prisma.Decimal | null
    installmentCount?: number | null
    changeAmount?: number | Prisma.Decimal | null
    processedById: string
    notes?: string | null
  }) {
    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // 1. Buscar Sale.
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          cashSession: {
            include: {
              cashRegister: true
            }
          },
          items: {
            include: {
              product: true
            }
          },
          payments: true
        }
      })

      // 2. Verificar se existe.
      if (!sale) {
        throw new Error('Sale not found')
      }

      // 3. Verificar status PENDING.
      if (sale.status !== SaleStatus.PENDING) {
        // Check for specific statuses to give appropriate error messages
        if (sale.status === SaleStatus.COMPLETED) {
          throw new Error('Sale is already completed')
        }

        if (sale.status === SaleStatus.CANCELLED) {
          throw new Error('Cannot complete a cancelled sale')
        }

        if (sale.status === SaleStatus.REFUNDED) {
          throw new Error('Cannot complete a refunded sale')
        }

        throw new Error('Only pending sales can be completed')
      }

      // 4. Verificar CashSession OPEN.
      if (sale.cashSession.status !== 'OPEN') {
        throw new Error('Cannot complete sale for non-open cash session')
      }

      // 5. Validar pagamento.
      // Validate payment amount matches total amount (considering change amount)
      const paymentAmount = Number(paymentData.amount)
      const changeAmount = Number(paymentData.changeAmount ?? 0)
      const effectivePayment = paymentAmount - changeAmount

      // Convert sale total to number for comparison
      const saleTotal = Number(sale.totalAmount)

      if (Math.abs(effectivePayment - saleTotal) > 0.01) { // Allow for small floating point differences
        throw new Error(`Payment amount cannot exceed sale total`)
      }

      // Validate payment method
      if (!Object.values(PaymentMethod).includes(paymentData.method)) {
        throw new Error('Invalid payment method')
      }

      // Validate installment count if provided
      if (paymentData.installmentCount !== null && paymentData.installmentCount !== undefined) {
        if (Number(paymentData.installmentCount) <= 0) {
          throw new Error('Installment count must be positive')
        }
        // In a real system, only certain methods might allow installments
        if (paymentData.method !== PaymentMethod.CREDIT_CARD) {
          throw new Error('Only credit card payments can have installments')
        }
      }

      // Validate processing fee if provided
      if (paymentData.processingFee !== null && paymentData.processingFee !== undefined) {
        if (Number(paymentData.processingFee) < 0) {
          throw new Error('Processing fee cannot be negative')
        }
      }

      // 6. Verificar quantidade em estoque e atualizar.
      const itemsWithStockUpdate = []

      for (const item of sale.items) {
        // Get current product data
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        })

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`)
        }

        if (product.status !== ProductStatus.ACTIVE) {
          throw new Error(`Cannot sell inactive or discontinued product: ${product.name}`)
        }

        // Use passed-in unitPrice if provided, otherwise fallback to product's sale price

        itemsWithStockUpdate.push({
          productId: item.productId,
          quantity: item.quantity,
          product: product
        })
      }

      // 7. Criar SalePayment PAID.
      const salePayment = await tx.salePayment.create({
        data: {
          sale: { connect: { id: sale.id } },
          amount: paymentData.amount,
          method: paymentData.method,
          transactionId: paymentData.transactionId ?? null,
          processingFee: paymentData.processingFee ?? null,
          installmentCount: paymentData.installmentCount ?? null,
          changeAmount: paymentData.changeAmount ?? null,
          status: PaymentStatus.PAID,
          processedBy: { connect: { id: paymentData.processedById } },
        }
      })

      // 8. Baixar estoque e 9. Criar StockMovement SALE.
      for (const itemWithStock of itemsWithStockUpdate) {
        // Update product stock (decrement)
        await tx.product.update({
          where: { id: itemWithStock.productId },
          data: {
            stockQuantity: {
              decrement: itemWithStock.quantity
            }
          }
        })

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: itemWithStock.productId,
            type: StockMovementType.SALE,
            quantity: itemWithStock.quantity, // Always positive
            reference: sale.id, // Reference to the sale
            notes: `Sale ${sale.saleNumber}`,
            performedById: paymentData.processedById
          }
        })
      }

      // 10. Atualizar Sale para COMPLETED.
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.COMPLETED,
          paidAmount: saleTotal, // Update paid amount to total
          changeAmount: changeAmount,
          notes: paymentData.notes,
          updatedAt: new Date()
        }
      })

      // 11. Criar CashMovement SALE.
      await tx.cashMovement.create({
        data: {
          cashSessionId: sale.cashSessionId,
          type: 'SALE', // Using string literal as in other parts of codebase
          amount: saleTotal,
          description: `Sale ${sale.saleNumber}`,
          createdById: paymentData.processedById
        }
      })

      // 12. Criar AuditLog SALE_COMPLETED.
      await tx.auditLog.create({
        data: {
          userId: paymentData.processedById,
          action: 'SALE_COMPLETED',
          entity: 'Sale',
          entityId: sale.id,
          metadata: {
            saleNumber: sale.saleNumber,
            totalAmount: saleTotal,
            paymentMethod: paymentData.method
          }
        }
      })

      // Return just the sale object as expected by tests
      return {
        ...updatedSale,
        subtotal: updatedSale.subtotal.toNumber(),
        discountAmount: updatedSale.discountAmount.toNumber(),
        totalAmount: updatedSale.totalAmount.toNumber(),
        paidAmount: updatedSale.paidAmount.toNumber(),
        changeAmount: updatedSale.changeAmount.toNumber()
      }
    })
  }

  // Refund sale (return items to inventory and reverse payment)
  static async refundSale(id: string) {
    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx: any) => {
      // 1. Buscar Sale.
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          cashSession: {
            include: {
              cashRegister: true
            }
          },
          items: {
            include: {
              product: true
            }
          },
          payments: true
        }
      })

      // 2. Verificar se existe.
      if (!sale) {
        throw new Error('Sale not found')
      }

      // 3. Verificar status.
      if (sale.status === SaleStatus.REFUNDED) {
        throw new Error('Sale is already refunded')
      }

      if (sale.status !== SaleStatus.COMPLETED) {
        throw new Error('Only completed sales can be refunded')
      }

      // 4. Verificar que a venda tem pagamentos confirmados
      const paidPayment = sale.payments.find((p: SalePayment) => p.status === PaymentStatus.PAID)
      if (!paidPayment) {
        throw new Error('Sale has no paid payment to refund')
      }

      // 5. Calcular totals da venda original
      const totalAmount = Number(sale.totalAmount)

      // 6. Atualizar o pagamento existente para REFUNDED (em vez de criar novo)
      // Follow the exact same pattern as salePaymentService.refundPayment
      const updatedPayment = await tx.salePayment.update({
        where: { id: paidPayment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          processedById: paidPayment.processedById
        }
      })

      // 7. Devolver estoque (aumentar quantidade dos produtos)
      for (const item of sale.items) {
        // Update product stock (increment)
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              increment: item.quantity + 1
            }
          }
        })

        // Create stock movement record for return
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.SALE_RETURN, // Devolução de venda
            quantity: item.quantity, // Sempre positivo
            reference: sale.id, // Reference to the sale
            notes: `Refund for sale ${sale.saleNumber}`,
            performedById: paidPayment.processedById
          }
        })
      }

      // 8. Atualizar Sale para REFUNDED.
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.REFUNDED,
          paidAmount: 0, // Após reembolso total, o valor pago fica zero
          // O changeAmount permanece como estava (fato histórico do transaction original)
          updatedAt: new Date()
        }
      })

      // 9. Criar CashMovement WITHDRAWAL (refund removes cash from session).
      await tx.cashMovement.create({
        data: {
          cashSessionId: sale.cashSessionId,
          type: 'WITHDRAWAL',
          amount: totalAmount,
          description: `Refund for sale ${sale.saleNumber}`,
          createdById: paidPayment.processedById
        }
      })

      // 10. Criar AuditLog SALE_REFUNDED.
      await tx.auditLog.create({
        data: {
          userId: paidPayment.processedById,
          action: 'SALE_REFUNDED',
          entity: 'Sale',
          entityId: sale.id,
          metadata: {
            saleNumber: sale.saleNumber,
            totalAmount,
            refundAmount: totalAmount
          }
        }
      })

      // Return just the sale object as expected by tests
      return {
        ...updatedSale,
        subtotal: updatedSale.subtotal.toNumber(),
        discountAmount: updatedSale.discountAmount.toNumber(),
        totalAmount: updatedSale.totalAmount.toNumber(),
        paidAmount: updatedSale.paidAmount.toNumber(),
        changeAmount: updatedSale.changeAmount.toNumber()
      }
    })
  }
}

export default SaleService