import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"



// GET /api/sales/[id]/receipt - Get receipt data for printing
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for receipt access


    const sale = await SaleService.getSale((await params).id)

    // Get store info from environment or use defaults
    const storeName = process.env.STORE_NAME || 'Laçolaria'
    const storeAddress = process.env.STORE_ADDRESS || ''
    const storePhone = process.env.STORE_PHONE || ''

    // Format payment method label
    const paymentMethodLabels: Record<string, string> = {
      CASH: 'DINHEIRO',
      PIX: 'PIX',
      CREDIT_CARD: 'CARTÃO CRÉDITO',
      DEBIT_CARD: 'CARTÃO DÉBITO',
    }

    // Get payment method from payments
    const payment = sale.payments?.[0]
    const paymentMethod = payment?.method || 'CASH'
    const paymentMethodLabel = paymentMethodLabels[paymentMethod] || paymentMethod

    // Calculate interest if card payment
    const isCardPayment = paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD'
    let interest = 0
    if (isCardPayment) {
      // Assuming 3.5% interest for card payments
      interest = sale.subtotal * 0.035
    }

    // Get installments from payment
    const installments = payment?.installmentCount || 1
    const installmentValue = installments > 1 ? sale.totalAmount / installments : undefined

    // Format items for receipt
    const items = sale.items?.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber ? item.unitPrice.toNumber() : Number(item.unitPrice),
      total: item.totalAmount.toNumber ? item.totalAmount.toNumber() : Number(item.totalAmount),
    })) || []

    // Map Prisma PaymentMethod to frontend payment method type for the ReceiptPrint component
    const frontendPaymentMethod =
      paymentMethod === 'CASH' ? 'dinheiro' :
      paymentMethod === 'PIX' ? 'pix' :
      'cartao'

    const receiptData = {
      saleId: sale.saleNumber,
      date: sale.createdAt,
      items,
      subtotal: sale.subtotal,
      paymentMethod: frontendPaymentMethod,
      interest,
      total: sale.totalAmount,
      installments,
      installmentValue,
      storeName,
      storeAddress,
      storePhone,
      customerName: sale.customer?.name || 'Consumidor Final',
      cashRegisterName: sale.cashSession?.cashRegister?.name || 'Caixa Principal',
      operatorName: sale.createdBy?.name || 'Sistema',
    }

    return NextResponse.json({
      success: true,
      data: receiptData
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}