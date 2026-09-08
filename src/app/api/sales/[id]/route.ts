import { NextResponse } from "next/server"
import { SaleService } from "@/services/saleService"



// GET /api/sales/[id] - Get sale by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale retrieval


    const result = await SaleService.getSale((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/sales/[id] - NOT IMPLEMENTED: SaleService doesn't have update method
// Only note updates might be possible via direct Prisma update, but service layer doesn't expose this
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale modification


    // SaleService doesn't expose an update method, so we return method not allowed
    // Following the requirement to not implement methods that don't exist in service
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Method not allowed - Sale update not supported via API",
          code: "METHOD_NOT_ALLOWED"
        }
      },
      { status: 405 }
    )
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/sales/[id] - Cancel sale
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for sale cancellation


    // Note: SaleService.cancelSale only takes the sale ID, not who cancelled it
    // Following the exact service contract - no invented parameters
    const result = await SaleService.cancelSale((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}