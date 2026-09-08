import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { SaleStatus } from "@/generated/prisma/client"

// GET /api/sales - List sales with filters and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Build options for SaleService
    const options: {
      cashSessionId?: string
      customerId?: string
      status?: SaleStatus
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/sales - Create new sale
export async function POST(request: Request) {
  try {
    const data = await request.json()
    // In a real app, you would get the user from session or token.
    // Since we removed auth, we'll set a default creator ID or require it in data.
    // For now, we'll assume the data includes createdById or we can use a default.
    // We'll check if createdById is provided, if not, we can use a default (e.g., "1" for admin).
    // But note: the SaleService.createSale expects createdById.
    // We'll get it from data, or if not present, we can use a placeholder.
    // However, to keep it simple, we'll require it in the data.
    const { createdById, ...saleData } = data
    let finalCreatedById = createdById
    if (!finalCreatedById) {
      // Default to a known user ID (e.g., the admin user from seed)
      finalCreatedById = "1" // This assumes the admin user has id "1"
    }

    const result = await SaleService.createSale({
      ...saleData,
      createdById: finalCreatedById
    })

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}