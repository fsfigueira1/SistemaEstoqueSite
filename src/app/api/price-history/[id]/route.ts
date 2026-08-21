import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/price-history/[id] - Get price history by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const priceHistory = await PriceHistoryService.getPriceHistoryById(params.id)

    return NextResponse.json({
      success: true,
      data: priceHistory
    })

  } catch (error) {
    return handleApiError(error)
  }
}