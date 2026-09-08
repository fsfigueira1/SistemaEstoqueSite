import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"



// POST /api/sales/[id]/process-payment - Process a payment for a sale (creates and confirms payment)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment processing


    const data = await request.json()
    const {
      amount,
      method,
      transactionId,
      processingFee,
      installmentCount,
      changeAmount,
      processedById
    } = data

    // Validate required fields
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Payment amount must be positive",
            code: "INVALID_AMOUNT"
          }
        },
        { status: 400 }
      )
    }

    if (!processedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Processed by ID is required",
            code: "MISSING_PROCESSED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await SalePaymentService.processPayment({
      saleId: (await params).id,
      amount,
      method,
      transactionId,
      processingFee,
      installmentCount,
      changeAmount,
      processedById
    })

    // Return standardized success response with 201 status (created)
    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    )
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}