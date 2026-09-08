import { NextResponse } from "next/server"
import { SupplierService } from "@/services/supplierService"

// GET /api/suppliers - List suppliers with filters and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Build filters
    const filters = {
      name: searchParams.get("name") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "10")
    }

    // Validate pagination
    if (isNaN(filters.page) || filters.page < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      )
    }
    if (isNaN(filters.limit) || filters.limit < 1) {
      return NextResponse.json(
        { error: "Invalid limit" },
        { status: 400 }
      )
    }

    const result = await SupplierService.getSuppliers(filters)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/suppliers - Create new supplier
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await SupplierService.createSupplier(data)

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