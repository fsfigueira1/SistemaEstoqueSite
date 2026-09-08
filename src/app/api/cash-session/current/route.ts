import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"

// GET /api/cash-session/current - Get the currently open cash session (if any)
export async function GET() {
  try {
    // Get any open cash session (we assume only one cash register in desktop mode)
    const openSessions = await CashSessionService.listCashSessions({
      status: "OPEN",
      limit: 1
    })

    if (openSessions.cashSessions.length > 0) {
      // Return the first open session
      const session = openSessions.cashSessions[0]
      return NextResponse.json({
        success: true,
        data: session
      })
    }

    // No open session
    return NextResponse.json({
      success: false,
      data: null
    })
  } catch (error) {
    console.error("Cash session current API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}