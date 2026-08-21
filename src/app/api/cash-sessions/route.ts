import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"
import { CashSessionStatus } from "@/generated/prisma/client"

// GET /api/cash-sessions - List cash sessions with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash session listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build options for CashSessionService
    const options: {
      cashRegisterId?: string
      status?: CashSessionStatus // Using CashSessionStatus to match service expectation
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
    return handleApiError(error)
  }
}

// POST /api/cash-sessions/open - Open a new cash session
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for opening cash session
    await requireAuthAndRole(["ADMIN", "MANAGER"])

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

    if (openingAmount === undefined || Number(openingAmount) < 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Opening amount is required and cannot be negative",
            code: "INVALID_OPENING_AMOUNT"
          }
        },
        { status: 400 }
      )
    }

    const result = await CashSessionService.openCashSession({
      cashRegisterId,
      openedById,
      openingAmount
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
    return handleApiError(error)
  }
}