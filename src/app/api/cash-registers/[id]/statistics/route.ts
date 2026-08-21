import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/cash-registers/[id]/statistics - Get cash register statistics
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash register statistics
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await CashRegisterService.getCashRegisterStatistics(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}