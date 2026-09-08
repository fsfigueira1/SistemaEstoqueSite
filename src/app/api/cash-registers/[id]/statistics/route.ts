import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"



// GET /api/cash-registers/[id]/statistics - Get cash register statistics
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash register statistics


    const result = await CashRegisterService.getCashRegisterStatistics((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}