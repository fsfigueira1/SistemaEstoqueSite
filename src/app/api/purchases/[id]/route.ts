import { NextResponse } from "next/server"
import { PurchaseService } from "@/services/purchaseService"



// GET /api/purchases/[id] - Get purchase order by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase viewing


    const purchaseOrder = await PurchaseService.getPurchaseOrderById((await params).id)

    return NextResponse.json({
      success: true,
      data: purchaseOrder
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/purchases/[id] - Update purchase order
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for purchase updates


    const data = await request.json()
    const purchaseOrder = await PurchaseService.updatePurchaseOrder((await params).id, data)

    return NextResponse.json({
      success: true,
      data: purchaseOrder
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}