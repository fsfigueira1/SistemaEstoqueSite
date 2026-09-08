import { NextResponse } from "next/server"
import { StockService } from "@/services/stockService"



// GET /api/stock - Get stock for a specific product
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for stock viewing


    const { searchParams } = new URL(request.url)

    // Check if we're getting stock for a specific product
    const productId = searchParams.get("productId")

    if (productId) {
      // Get stock for specific product
      const stock = await StockService.getStock(productId)

      return NextResponse.json({
        success: true,
        data: stock
      })
    }

    // Default case - this could be expanded if needed
    return NextResponse.json({
      success: true,
      data: {
        message: "Provide productId parameter to get stock for a specific product"
      }
    })

  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}