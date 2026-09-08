import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"



// GET /api/cash-registers/[id] - Get cash register by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash register retrieval


    const result = await CashRegisterService.getCashRegister((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/cash-registers/[id] - Update cash register
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN role for cash register update


    const data = await request.json()
    const { name, description, isActive } = data

    // Validate required fields
    if (name !== undefined && (name === null || name.trim() === '')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Cash register name cannot be empty",
            code: "INVALID_NAME"
          }
        },
        { status: 400 }
      )
    }

    const result = await CashRegisterService.updateCashRegister((await params).id, {
      name,
      description,
      isActive
    })

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/cash-registers/[id] - Deactivate cash register
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN role for cash register deactivation


    const result = await CashRegisterService.deactivateCashRegister((await params).id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}