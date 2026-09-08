import { NextResponse } from "next/server"
import { CashMovementService } from "@/services/cashMovementService"



// GET /api/cash-movements/statistics - Get cash movement statistics
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash movement statistics


    const { searchParams } = new URL(request.url)

    // Build options for CashMovementService
    const options: {
      cashSessionId?: string
      startDate?: Date
      endDate?: Date
    } = {}

    const cashSessionId = searchParams.get("cashSessionId")
    if (cashSessionId) {
      options.cashSessionId = cashSessionId
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const result = await CashMovementService.getStatistics(options)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}