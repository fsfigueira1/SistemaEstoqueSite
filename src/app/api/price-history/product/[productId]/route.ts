import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"

// GET /api/price-history/product/[productId] - Get price history for a specific product
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history
    // TODO: implement authentication check via cookie or middleware
    // For now, we assume middleware handles authentication.

    const { searchParams } = new URL(request.url)

    // Validate pagination
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
      (await params).productId,
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}