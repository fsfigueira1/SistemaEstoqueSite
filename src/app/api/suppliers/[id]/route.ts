import { NextResponse } from "next/server"
import { SupplierService } from "@/services/supplierService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/suppliers/[id] - Get supplier by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for supplier viewing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const supplier = await SupplierService.getSupplierById(params.id)

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
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/suppliers/[id] - Update supplier
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for supplier updates
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const supplier = await SupplierService.updateSupplier(params.id, data)

    return NextResponse.json({
      success: true,
      data: supplier
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/suppliers/[id] - Delete supplier
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for supplier deletion
    await requireAuthAndRole(["ADMIN"])

    await SupplierService.deleteSupplier(params.id)
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })
  } catch (error) {
    return handleApiError(error)
  }
}