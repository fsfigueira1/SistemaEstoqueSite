import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"

// GET /api/price-history - List price history with filters and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

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

    // Pagination
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      )
    }
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: "Invalid limit" },
        { status: 400 }
      )
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}