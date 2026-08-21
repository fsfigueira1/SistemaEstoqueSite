import { NextResponse } from "next/server"
import { PurchaseService } from "@/services/purchaseService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/purchases - List purchase orders with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build options for PurchaseService
    const options: {
      supplierId?: string;
      createdById?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}

    const supplierId = searchParams.get("supplierId")
    if (supplierId) {
      options.supplierId = supplierId
    }

    const createdById = searchParams.get("createdById")
    if (createdById) {
      options.createdById = createdById
    }

    const startDateParam = searchParams.get("startDate")
    if (startDateParam) {
      options.startDate = new Date(startDateParam)
    }

    const endDateParam = searchParams.get("endDate")
    if (endDateParam) {
      options.endDate = new Date(endDateParam)
    }

    const result = await PurchaseService.listPurchaseOrders({
      ...options,
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

// POST /api/purchases - Create new purchase order
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase creation
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const result = await PurchaseService.createPurchaseOrder(data)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}