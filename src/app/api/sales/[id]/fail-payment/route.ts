import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"



// POST /api/sales/[id]/fail-payment - Fail a pending payment for a sale
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment modification


    const data = await request.json()
    const { failedById } = data

    if (!failedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Failed by ID is required",
            code: "MISSING_FAILED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    // We need to get the pending payment ID first for this sale
    // Since there might be multiple payments, we'll get payments for the sale and find the pending one
    const payments = await SalePaymentService.getPaymentsForSale((await params).id)
    const pendingPayment = payments.find(payment => payment.status === "PENDING")

    if (!pendingPayment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "No pending payment found for this sale",
            code: "NO_PENDING_PAYMENT"
          }
        },
        { status: 404 }
      )
    }

    const result = await SalePaymentService.failPayment(pendingPayment.id, failedById)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}