import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"

// GET /api/cash-sessions/[id]/summary - Get cash session summary
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await CashSessionService.getCashSessionSummary((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}