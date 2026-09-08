import { NextResponse } from "next/server"
import { PurchaseService } from "@/services/purchaseService"

// GET /api/purchases - List purchase orders with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase listing
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/purchases - Create new purchase order
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase creation
    // TODO: implement authentication check via cookie or middleware
    // For now, we assume middleware handles authentication.

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}