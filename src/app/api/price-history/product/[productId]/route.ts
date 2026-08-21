import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/price-history/product/[productId] - Get price history for a specific product
export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build options object
    const options: {
      startDate?: Date;
      endDate?: Date;
      changedById?: string;
    } = {};

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const changedById = searchParams.get("changedById")
    if (changedById) {
      options.changedById = changedById
    }

    const result = await PriceHistoryService.getPriceHistoryByProduct(
      params.productId,
      {
        ...options,
        page,
        limit
      }
    )

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    return handleApiError(error)
  }
}