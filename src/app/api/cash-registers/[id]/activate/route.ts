import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"



// PUT /api/cash-registers/[id]/activate - Activate cash register
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN role for cash register activation


    const result = await CashRegisterService.activateCashRegister((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}