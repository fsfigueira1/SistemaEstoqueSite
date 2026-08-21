import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/price-history - List price history with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build filters
    const filters: {
      productId?: string;
      startDate?: Date;
      endDate?: Date;
      changedById?: string;
    } = {};

    const productId = searchParams.get("productId")
    if (productId) {
      filters.productId = productId
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      filters.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      filters.endDate = new Date(endDateParam)
    }

    const changedById = searchParams.get("changedById")
    if (changedById) {
      filters.changedById = changedById
    }

    const result = await PriceHistoryService.getPriceHistory({
      ...filters,
      page,
      limit
    })

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    return handleApiError(error)
  }
}