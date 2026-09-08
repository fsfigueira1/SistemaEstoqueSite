import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"
import { CashSessionStatus } from "@/generated/prisma/client"

// GET /api/cash-sessions - List cash sessions with filters and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Build options for CashSessionService
    const options: {
      cashRegisterId?: string
      status?: CashSessionStatus
    } = {}

    const cashRegisterId = searchParams.get("cashRegisterId")
    if (cashRegisterId) {
      options.cashRegisterId = cashRegisterId
    }

    const statusParam = searchParams.get("status")
    if (statusParam) {
      // Validate status value
      const validStatuses = ["OPEN", "CLOSED"] as const
      if (validStatuses.includes(statusParam as CashSessionStatus)) {
        options.status = statusParam as CashSessionStatus
      }
    }

    // Pagination
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

    const result = await CashSessionService.listCashSessions({
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

// POST /api/cash-sessions/open - Open a new cash session
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { cashRegisterId, openedById, openingAmount } = data

    // Validate required fields
    if (!cashRegisterId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Cash register ID is required",
            code: "MISSING_CASH_REGISTER_ID"
          }
        },
        { status: 400 }
      )
    }

    if (!openedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Opened by ID is required",
            code: "MISSING_OPENED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    // openingAmount is optional, default to 0
    const amount = openingAmount !== undefined ? Number(openingAmount) : 0
    if (amount < 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Opening amount cannot be negative",
            code: "INVALID_OPENING_AMOUNT"
          }
        },
        { status: 400 }
      )
    }

    const result = await CashSessionService.openCashSession({
      cashRegisterId,
      openedById,
      openingAmount: amount
    })

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