import { NextResponse } from "next/server"
import { CustomerService } from "@/services/customerService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/customers - List customers with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer listing
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
      email: searchParams.get("email") || undefined,
      phone: searchParams.get("phone") || undefined,
      page,
      limit
    }

    const result = await CustomerService.getCustomers(filters)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/customers - Create new customer
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer creation
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const customer = await CustomerService.createCustomer(data)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: customer
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}