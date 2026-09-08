import { NextResponse } from "next/server"
import { PurchaseService } from "@/services/purchaseService"



// POST /api/purchases/[id]/items - Add items to purchase order
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for modifying purchase orders


    const data = await request.json()
    const { items, addedById } = data

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Items array is required and must contain at least one item",
            code: "INVALID_ITEMS"
          }
        },
        { status: 400 }
      )
    }

    if (!addedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Added by ID is required",
            code: "MISSING_ADDED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await PurchaseService.addItemsToPurchaseOrder(
      (await params).id,
      items,
      addedById
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/purchases/[id]/items - Remove items from purchase order
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for modifying purchase orders


    const data = await request.json()
    const { itemIds, removedById } = data

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Item IDs array is required and must contain at least one ID",
            code: "INVALID_ITEM_IDS"
          }
        },
        { status: 400 }
      )
    }

    if (!removedById) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Removed by ID is required",
            code: "MISSING_REMOVED_BY_ID"
          }
        },
        { status: 400 }
      )
    }

    const result = await PurchaseService.removeItemsFromPurchaseOrder(
      (await params).id,
      itemIds,
      removedById
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}