import { NextResponse } from "next/server"
import { CategoryService } from "@/services/categoryService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/categories/[id] - Get category by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for category viewing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const category = await CategoryService.getCategoryById(params.id)

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Category not found",
            code: "NOT_FOUND"
          }
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/categories/[id] - Update category
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for category updates
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const category = await CategoryService.updateCategory(params.id, data)

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/categories/[id] - Delete category
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for category deletion
    await requireAuthAndRole(["ADMIN"])

    await CategoryService.deleteCategory(params.id)
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })
  } catch (error) {
    return handleApiError(error)
  }
}