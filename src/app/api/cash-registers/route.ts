import { NextResponse } from "next/server"
import { CashRegisterService } from "@/services/cashRegisterService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/cash-registers - List cash registers with filters and pagination
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for cash register listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build options for CashRegisterService
    const options: {
      activeOnly?: boolean
      search?: string
    } = {}

    const activeOnlyParam = searchParams.get("activeOnly")
    if (activeOnlyParam !== null) {
      options.activeOnly = activeOnlyParam.toLowerCase() === 'true'
    }

    const searchParam = searchParams.get("search")
    if (searchParam) {
      options.search = searchParam
    }

    const result = await CashRegisterService.listCashRegisters({
      ...options,
      page,
      limit
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

// POST /api/cash-registers - Create new cash register
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN role for cash register creation
    await requireAuthAndRole(["ADMIN"])

    const data = await request.json()
    const { name, description, isActive } = data

    // Validate required fields
    if (!name || name.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Cash register name is required",
            code: "INVALID_NAME"
          }
        },
        { status: 400 }
      )
    }

    const result = await CashRegisterService.createCashRegister({
      name,
      description,
      isActive
    })

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}