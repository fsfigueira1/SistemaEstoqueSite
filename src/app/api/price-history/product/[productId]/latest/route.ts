import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"



// GET /api/price-history/product/[productId]/latest - Get latest price for a product
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history


    const result = await PriceHistoryService.getLatestPrice((await params).productId)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}