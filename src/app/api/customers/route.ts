import { NextResponse } from "next/server"
import { CustomerService } from "@/services/customerService"

// GET /api/customers - List customers with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer listing
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/customers - Create new customer
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer creation
    // TODO: implement authentication check via cookie or middleware
    // For now, we assume middleware handles authentication.

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}