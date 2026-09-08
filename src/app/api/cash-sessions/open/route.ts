import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"



// GET /api/cash-sessions/open - Get open cash session for a cash register
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for getting open cash session


    const { searchParams } = new URL(request.url)
    const cashRegisterId = searchParams.get("cashRegisterId")

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

    const result = await CashSessionService.getOpenCashSession(cashRegisterId)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}