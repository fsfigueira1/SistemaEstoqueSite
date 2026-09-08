import { NextResponse } from "next/server"
import { CustomerService } from "@/services/customerService"



// GET /api/customers/[id] - Get customer by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer viewing


    const customer = await CustomerService.getCustomerById((await params).id)

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
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for customer updates


    const data = await request.json()
    const customer = await CustomerService.updateCustomer((await params).id, data)

    return NextResponse.json({
      success: true,
      data: customer
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/customers/[id] - Delete customer
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN role for customer deletion


    await CustomerService.deleteCustomer((await params).id)
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}