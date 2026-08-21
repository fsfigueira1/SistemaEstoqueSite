import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"
import { SaleStatus } from "@/generated/prisma/client"

// GET /api/sales - List sales with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sales listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build options for SaleService
    const options: {
      cashSessionId?: string
      customerId?: string
      status?: SaleStatus // Using SaleStatus to match service expectation
      createdById?: string
      startDate?: Date
      endDate?: Date
    } = {}

    const cashSessionId = searchParams.get("cashSessionId")
    if (cashSessionId) {
      options.cashSessionId = cashSessionId
    }

    const customerId = searchParams.get("customerId")
    if (customerId) {
      options.customerId = customerId
    }

    const statusParam = searchParams.get("status")
    if (statusParam) {
      // Validate status value
      const validStatuses = ["PENDING", "COMPLETED", "CANCELLED", "REFUNDED"] as const
      if (validStatuses.includes(statusParam as SaleStatus)) {
        options.status = statusParam as SaleStatus
      }
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

    const result = await SaleService.listSales({
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

// POST /api/sales - Create new sale
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale creation
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const result = await SaleService.createSale(data)

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