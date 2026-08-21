import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"
import { validatePaginationParams } from "@/lib/pagination"

// GET /api/products - List products with filters
export async function GET(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product listing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const { searchParams } = new URL(request.url)

    // Validate pagination
    const { page, limit } = validatePaginationParams(
      searchParams.get("page"),
      searchParams.get("limit")
    )

    // Build filters
    const filters = {
      categoryId: searchParams.get("categoryId") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      search: searchParams.get("search") || undefined,
      status: (() => {
        const statusValue = searchParams.get("status")
        return (statusValue === "ACTIVE" || statusValue === "INACTIVE" || statusValue === "DISCONTINUED")
          ? statusValue as "ACTIVE" | "INACTIVE" | "DISCONTINUED"
          : undefined
      })(),
      page,
      limit
    }

    const result = await ProductService.getProducts(filters)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/products - Create new product
export async function POST(request: Request) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product creation
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const product = await ProductService.createProduct(data)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: product
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}