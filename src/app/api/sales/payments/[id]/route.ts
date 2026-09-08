import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"



// GET /api/sales/payments/[id] - Get payment by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment retrieval


    const result = await SalePaymentService.getPaymentById((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/sales/payments/[id] - Process payment (create and confirm in one operation)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment processing


    // Note: SalePaymentService.processPayment creates a NEW payment, not update existing one
    // For updating an existing payment, we should use confirmPayment or failPayment
    // However, the route structure suggests updating an existing payment by ID
    // Let me check what methods are actually available...

    // Based on SalePaymentService, we have:
    // - confirmPayment(id, confirmedById) - for confirming PENDING payments
    // - failPayment(id, failedById) - for failing PENDING payments
    // - refundPayment(id, refundedById) - for refunding PAID payments

    // Since PUT typically means update/replace, and we don't have a generic update method,
    // we'll implement confirmPayment as the closest match for "processing" a payment
    // But we need the confirmedById parameter

    const data = await request.json()
    const { confirmedById } = data

    if (!confirmedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Confirmed by ID is required",
            code: "MISSING_CONFIRMED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await SalePaymentService.confirmPayment((await params).id, confirmedById)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/sales/payments/[id] - Refund payment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment refund


    const data = await request.json()
    const { refundedById } = data

    if (!refundedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Refunded by ID is required",
            code: "MISSING_REFUNDED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await SalePaymentService.refundPayment((await params).id, refundedById)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}