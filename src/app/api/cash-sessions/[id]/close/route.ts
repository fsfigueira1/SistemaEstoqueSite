import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// POST /api/cash-sessions/[id]/close - Close cash session
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for closing cash session
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const { closedById, countedAmount } = data

    // Validate required fields
    if (!closedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Closed by ID is required",
            code: "MISSING_CLOSED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    if (countedAmount === undefined || Number(countedAmount) < 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Counted amount is required and cannot be negative",
            code: "INVALID_COUNTED_AMOUNT"
          }
        },
        { status: 400 }
      )
    }

    const result = await CashSessionService.closeCashSession({
      cashSessionId: params.id,
      closedById,
      countedAmount
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