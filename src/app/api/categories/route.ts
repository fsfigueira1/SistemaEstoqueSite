import { NextResponse } from "next/server"
import { CategoryService } from "@/services/categoryService"

// GET /api/categories - List categories with filters
export async function GET(request: Request) {
  try {
    // Capture request URL info BEFORE processing to avoid interference
    const requestUrl = request.url
    const { searchParams } = new URL(requestUrl)

    // Validate pagination
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      )
    }
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: "Invalid limit" },
        { status: 400 }
      )
    }

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}

// POST /api/categories - Create new category
export async function POST(request: Request) {
  try {
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}