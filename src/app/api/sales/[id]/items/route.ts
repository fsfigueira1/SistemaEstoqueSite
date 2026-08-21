import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// POST /api/sales/[id]/items - NOT IMPLEMENTED: SaleService doesn't have add/remove items methods
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale modification
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    // SaleService doesn't expose add/remove items methods, so we return method not allowed
    // Following the requirement to not implement methods that don't exist in service
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Method not allowed - Sale item modification not supported via API",
          code: "METHOD_NOT_ALLOWED"
        }
      },
      { status: 405 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/sales/[id]/items - NOT IMPLEMENTED: SaleService doesn't have add/remove items methods
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale modification
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    // SaleService doesn't expose add/remove items methods, so we return method not allowed
    // Following the requirement to not implement methods that don't exist in service
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Method not allowed - Sale item modification not supported via API",
          code: "METHOD_NOT_ALLOWED"
        }
      },
      { status: 405 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}