import { NextResponse } from "next/server"
import { CategoryService } from "@/services/categoryService"

// GET /api/categories/[id] - Get category by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const category = await CategoryService.getCategoryById((await params).id)

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/categories/[id] - Update category
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const data = await request.json()
    const category = await CategoryService.updateCategory((await params).id, data)

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/categories/[id] - Delete category
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await CategoryService.deleteCategory((await params).id)
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}