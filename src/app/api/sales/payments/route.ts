import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"

// GET /api/sales/payments - List payments with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment listing
    // TODO: implement authentication check via cookie or middleware
    // For now, we assume middleware handles authentication.

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      )
    }
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: "Invalid limit" },
        { status: 400 }
      )
    }

    // Build options for SalePaymentService
    const options: Record<string, unknown> = {}

    const saleId = searchParams.get("saleId")
    if (saleId) {
      options.saleId = saleId
    }

    const statusParam = searchParams.get("status")
    if (statusParam) {
      // Validate status value
      const validStatuses = ["PENDING", "PROCESSED", "CONFIRMED", "FAILED", "REFUNDED"]
      if (validStatuses.includes(statusParam)) {
        options.status = statusParam
      }
    }

    const paymentMethodId = searchParams.get("paymentMethodId")
    if (paymentMethodId) {
      options.paymentMethodId = paymentMethodId
    }

    const createdById = searchParams.get("createdById")
    if (createdById) {
      options.createdById = createdById
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const result = await SalePaymentService.listPayments({
      ...options,
      page,
      limit
    })

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/sales/payments - Create new payment
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment creation
    // TODO: implement authentication check via cookie or middleware
    // For now, we assume middleware handles authentication.

    const data = await request.json()
    const result = await SalePaymentService.createPayment(data)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}