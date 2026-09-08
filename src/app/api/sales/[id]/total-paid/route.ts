import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"



// GET /api/sales/[id]/total-paid - Get total amount paid for a sale
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment information


    const result = await SalePaymentService.getTotalPaidForSale((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: { totalPaid: result }
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}