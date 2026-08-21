import { NextResponse } from "next/server"
import { SupplierService } from "@/services/supplierService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/suppliers - List suppliers with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for supplier listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build filters
    const filters = {
      name: searchParams.get("name") || undefined,
      page,
      limit
    }

    const result = await SupplierService.getSuppliers(filters)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/suppliers - Create new supplier
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for supplier creation
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const supplier = await SupplierService.createSupplier(data)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: supplier
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}