import { NextResponse } from "next/server"
import { CustomerService } from "@/services/customerService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/customers/[id] - Get customer by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer viewing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const customer = await CustomerService.getCustomerById(params.id)

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Customer not found",
            code: "NOT_FOUND"
          }
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: customer
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer updates
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const customer = await CustomerService.updateCustomer(params.id, data)

    return NextResponse.json({
      success: true,
      data: customer
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/customers/[id] - Delete customer
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for customer deletion
    await requireAuthAndRole(["ADMIN"])

    await CustomerService.deleteCustomer(params.id)
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })
  } catch (error) {
    return handleApiError(error)
  }
}