import { NextResponse } from "next/server"
import { PriceHistoryService } from "@/services/priceHistoryService"



// GET /api/price-history/[id] - Get price history by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for viewing price history


    const priceHistory = await PriceHistoryService.getPriceHistoryById((await params).id)

    return NextResponse.json({
      success: true,
      data: priceHistory
    })

  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}