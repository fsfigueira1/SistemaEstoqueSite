import { NextResponse } from "next/server"
import { PurchaseService } from "@/services/purchaseService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/purchases/[id] - Get purchase order by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase viewing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const purchaseOrder = await PurchaseService.getPurchaseOrderById(params.id)

    return NextResponse.json({
      success: true,
      data: purchaseOrder
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/purchases/[id] - Update purchase order
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase updates
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const purchaseOrder = await PurchaseService.updatePurchaseOrder(params.id, data)

    return NextResponse.json({
      success: true,
      data: purchaseOrder
    })
  } catch (error) {
    return handleApiError(error)
  }
}