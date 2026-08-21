import { NextResponse } from "next/server"
import { SalePaymentService } from "@/services/salePaymentService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/sales/[id]/total-paid - Get total amount paid for a sale
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for payment information
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await SalePaymentService.getTotalPaidForSale(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: { totalPaid: result }
    })
  } catch (error) {
    return handleApiError(error)
  }
}