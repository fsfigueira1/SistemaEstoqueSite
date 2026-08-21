import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// PUT /api/cash-registers/[id]/activate - Activate cash register
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for cash register activation
    await requireAuthAndRole(["ADMIN"])

    const result = await CashRegisterService.activateCashRegister(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}