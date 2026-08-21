import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/cash-sessions/[id]/summary - Get cash session summary
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash session summary
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await CashSessionService.getCashSessionSummary(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}