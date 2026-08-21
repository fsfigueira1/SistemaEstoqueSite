import { SalePaymentService } from './salePaymentService.ts'
import { prisma, Prisma } from "../lib/prisma.ts"
import { PaymentStatus, PaymentMethod, SaleStatus } from "../generated/prisma/client.ts"

export class PaymentService {
  // Process a payment (create and confirm in one step)
  static async processPayment(input: {
    saleId: string
    amount: number | Prisma.Decimal
    method: PaymentMethod
    transactionId?: string | null
    processingFee?: number | Prisma.Decimal | null
    installmentCount?: number | null
    changeAmount?: number | Prisma.Decimal | null
    processedById: string
  }) {
    console.log('PaymentService.processPayment called with input:', input);
    console.log('About to enter transaction');
    // Validate inputs
    if (!input.saleId) throw new Error('Sale ID is required')
    if (!input.amount || Number(input.amount) <= 0) throw new Error('Amount must be positive')
    if (!input.processedById) throw new Error('Processed by ID is required')

    // Validate change amount
    const changeAmount = Number(input.changeAmount ?? 0)
    if (changeAmount < 0) {
      throw new Error('Change amount cannot be negative')
    }
    if (changeAmount > Number(input.amount)) {
      throw new Error('Change amount cannot be greater than amount')
    }

    // Use transaction to ensure atomicity of the entire operation
    return prisma.$transaction(async (tx: any) => {
      // Verify sale exists and get current status
      const sale = await tx.sale.findUnique({
        where: { id: input.saleId },
        include: {
          cashSession: true,
          payments: true
        }
      })

      if (!sale) {
        throw new Error('Sale not found')
      }

      if (sale.status === SaleStatus.COMPLETED) {
        throw new Error('Cannot add payment to completed sale')
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new Error('Cannot add payment to cancelled sale')
      }

      // Verify cash session is open
      if (sale.cashSession.status !== 'OPEN') {
        throw new Error('Cannot add payment for sale in non-open cash session')
      }

      // Validate payment method
      if (!Object.values(PaymentMethod).includes(input.method)) {
        throw new Error('Invalid payment method')
      }

      // Validate installment count if provided
      if (input.installmentCount !== null && input.installmentCount !== undefined) {
        if (Number(input.installmentCount) <= 0) {
          throw new Error('Installment count must be positive')
        }
        // In a real system, only certain methods might allow installments
        if (input.method !== PaymentMethod.CREDIT_CARD) {
          throw new Error('Only credit card payments can have installments')
        }
      }

      // Validate processing fee if provided
      if (input.processingFee !== null && input.processingFee !== undefined) {
        if (Number(input.processingFee) < 0) {
          throw new Error('Processing fee cannot be negative')
        }
      }

      // Calculate remaining amount to be paid
      const alreadyPaid = await PaymentService.getTotalPaidForSale(input.saleId)
      const remainingAmount = sale.totalAmount.toNumber() - alreadyPaid

      const paymentAmount = Number(input.amount)
      const effectivePayment = paymentAmount - changeAmount

      if (effectivePayment <= 0) {
        throw new Error('Effective payment must be positive')
      }

      if (effectivePayment > remainingAmount) {
        throw new Error('Payment amount exceeds remaining amount')
      }

      // Create the payment as PAID directly (skip PENDING state)
      const payment = await tx.salePayment.create({
        data: {
          saleId: input.saleId,
          amount: input.amount,
          method: input.method,
          transactionId: input.transactionId ?? null,
          processingFee: input.processingFee ?? null,
          installmentCount: input.installmentCount ?? null,
          changeAmount: input.changeAmount ?? null,
          status: PaymentStatus.PAID,
          processedById: input.processedById
        }
      })

      // Create cash movement for cash payments (DEPOSIT)
      if (payment.method === PaymentMethod.CASH) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: sale.cashSessionId,
            type: 'DEPOSIT',
            amount: payment.amount,
            description: 'Cash payment',
            createdById: input.processedById
          }
        })
      }

      // Create cash movement for change (WITHDRAWAL) if applicable
      if (payment.method === PaymentMethod.CASH && changeAmount > 0) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: sale.cashSessionId,
            type: 'WITHDRAWAL',
            amount: new Prisma.Decimal(changeAmount),
            description: 'Change return',
            createdById: input.processedById
          }
        })
      }

      // Return the payment with proper type conversion
    const result = {
        ...payment,
        amount: payment.amount.toNumber(),
        processingFee: payment.processingFee ? payment.processingFee.toNumber() : null,
        changeAmount: payment.changeAmount ? payment.changeAmount.toNumber() : 0,
        processedAt: payment.processedAt ?? new Date()
      };

      console.log('Transaction result:', result);
      console.log('About to return from transaction');
      return result;
    })
  }

  // Create a payment (starts as PENDING)
  static async createPayment(input: {
    saleId: string
    amount: number | Prisma.Decimal
    method: PaymentMethod
    transactionId?: string | null
    processingFee?: number | Prisma.Decimal | null
    installmentCount?: number | null
    changeAmount?: number | Prisma.Decimal | null
    processedById: string
  }) {
    return SalePaymentService.createPayment(input);
  }

  // Confirm payment (mark as PAID)
  static async confirmPayment(id: string, confirmedById: string) {
    return SalePaymentService.confirmPayment(id, confirmedById);
  }

  // Fail payment (mark as FAILED)
  static async failPayment(id: string, failedById: string) {
    return SalePaymentService.failPayment(id, failedById);
  }

  // Refund payment (mark as REFUNDED)
  static async refundPayment(id: string, refundedById: string) {
    return SalePaymentService.refundPayment(id, refundedById);
  }

  // Get payment by ID
  static async getPaymentById(id: string) {
    return SalePaymentService.getPaymentById(id);
  }

  // Get payments for a sale
  static async getPaymentsBySale(saleId: string) {
    return SalePaymentService.getPaymentsForSale(saleId);
  }

  // Get total paid for a sale (effective amount, considering change for CASH)
  static async getTotalPaidForSale(saleId: string) {
    // Verify sale exists
    const sale = await prisma.sale.findUnique({
      where: { id: saleId }
    })

    if (!sale) {
      throw new Error('Sale not found')
    }

    const payments = await prisma.salePayment.findMany({
      where: { saleId, status: PaymentStatus.PAID }
    })

    // Calculate effective amount paid (amount - changeAmount for CASH, amount for others)
    let totalEffectivePaid = 0
    for (const payment of payments) {
      if (payment.method === PaymentMethod.CASH) {
        // For CASH: effective = amount - changeAmount
        totalEffectivePaid += Number(payment.amount) - (Number(payment.changeAmount) || 0)
      } else {
        // For other methods: effective = amount
        totalEffectivePaid += Number(payment.amount)
      }
    }

    return totalEffectivePaid
  }

  // List payments with filters
  static async listPayments(options: {
    saleId?: string
    method?: PaymentMethod
    status?: PaymentStatus
    processedById?: string
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}) {
    return SalePaymentService.listPayments(options);
  }

  // Get payments by method
  static async getPaymentsByMethod(method: PaymentMethod) {
    // Verify valid payment method
    if (!Object.values(PaymentMethod).includes(method)) {
      throw new Error('Invalid payment method');
    }

    const payments = await prisma.salePayment.findMany({
      where: { method, status: PaymentStatus.PAID },
      include: {
        sale: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Convert Decimal values to numbers for test compatibility
    return payments.map((payment: any) => ({
      ...payment,
      amount: payment.amount.toNumber(),
      processingFee: payment.processingFee ? payment.processingFee.toNumber() : null,
      changeAmount: payment.changeAmount ? payment.changeAmount.toNumber() : 0,
      processedAt: payment.createdAt
    }));
  }
}

// Export the SalePaymentService directly for those who need it
export { SalePaymentService };