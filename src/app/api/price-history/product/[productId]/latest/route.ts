import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/price-history/product/[productId]/latest - Get latest price for a product
export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await PriceHistoryService.getLatestPrice(params.productId)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    return handleApiError(error)
  }
}