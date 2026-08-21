import { NextResponse } from "next/server"
import { CategoryService } from "@/services/categoryService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/categories - List categories with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for category listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build filters
    const filters = {
      name: searchParams.get("name") || undefined,
      page,
      limit
    }

    const result = await CategoryService.getCategories(filters)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/categories - Create new category
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for category creation
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const category = await CategoryService.createCategory(data)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: category
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}