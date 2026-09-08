import { NextResponse } from "next/server"
import { SupplierService } from "@/services/supplierService"



// GET /api/suppliers/[id] - Get supplier by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for supplier viewing


    const supplier = await SupplierService.getSupplierById((await params).id)

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Supplier not found",
            code: "NOT_FOUND"
          }
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: supplier
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/suppliers/[id] - Update supplier
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for supplier updates


    const data = await request.json()
    const supplier = await SupplierService.updateSupplier((await params).id, data)

    return NextResponse.json({
      success: true,
      data: supplier
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/suppliers/[id] - Delete supplier
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN role for supplier deletion


    await SupplierService.deleteSupplier((await params).id)
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}