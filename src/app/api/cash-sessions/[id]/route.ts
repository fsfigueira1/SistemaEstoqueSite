import { NextResponse } from "next/server"
import { CashSessionService } from "@/services/cashSessionService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/cash-sessions/[id] - Get cash session by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash session retrieval
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const result = await CashSessionService.getCashSession(params.id)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/cash-sessions/[id] - NOT IMPLEMENTED: CashSessionService doesn't have general update method
export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash session modification
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    // CashSessionService doesn't expose a general update method, so we return method not allowed
    // Following the requirement to not implement methods that don't exist in service
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Method not allowed - Cash session update not supported via API",
          code: "METHOD_NOT_ALLOWED"
        }
      },
      { status: 405 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/cash-sessions/[id] - NOT IMPLEMENTED: CashSessionService doesn't have delete method
// Sessions are closed rather than deleted for audit trail purposes
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash session deletion
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    // CashSessionService doesn't expose a delete method, so we return method not allowed
    // Following the requirement to not implement methods that don't exist in service
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Method not allowed - Cash session deletion not supported via API (use close instead)",
          code: "METHOD_NOT_ALLOWED"
        }
      },
      { status: 405 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}