import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/cash-registers/[id] - Get cash register by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash register retrieval
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await CashRegisterService.getCashRegister(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/cash-registers/[id] - Update cash register
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for cash register update
    await requireAuthAndRole(["ADMIN"])

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

    const result = await CashRegisterService.updateCashRegister(params.id, {
      name,
      description,
      isActive
    })

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/cash-registers/[id] - Deactivate cash register
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for cash register deactivation
    await requireAuthAndRole(["ADMIN"])

    const result = await CashRegisterService.deactivateCashRegister(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}