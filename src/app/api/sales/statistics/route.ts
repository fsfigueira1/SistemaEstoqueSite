import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"



// GET /api/sales/statistics - Get sales statistics with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sales statistics


    const { searchParams } = new URL(request.url)

    // Build options for SaleService
    const options: {
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}

    const customerId = searchParams.get("customerId")
    if (customerId) {
      options.customerId = customerId
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const result = await SaleService.getSalesStatistics(options)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}