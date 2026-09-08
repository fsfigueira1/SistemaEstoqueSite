import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"



// GET /api/sales/[id]/payments - Get all payments for a specific sale
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment retrieval


    const result = await SalePaymentService.getPaymentsForSale((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// POST /api/sales/[id]/payments - Create a new payment for a sale (starts as PENDING)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment creation


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

    const result = await SalePaymentService.createPayment({
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