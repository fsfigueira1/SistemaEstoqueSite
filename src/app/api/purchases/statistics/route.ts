import { NextResponse } from "next/server"
import { PurchaseService } from "@/services/purchaseService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/purchases/statistics - Get purchase order statistics with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase statistics
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Build options for PurchaseService
    const options: {
      supplierId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}

    const supplierId = searchParams.get("supplierId")
    if (supplierId) {
      options.supplierId = supplierId
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const result = await PurchaseService.getPurchaseOrderStatistics(options)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}