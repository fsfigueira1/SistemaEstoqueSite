import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"
import { requireAuthAndRole } from "@/lib/authUtils"
import { handleApiError } from "@/lib/errorHandler"

// GET /api/products/[id] - Get product by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product viewing
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const product = await ProductService.getProductById(params.id)

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Product not found",
            code: "NOT_FOUND"
          }
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product updates
    await requireAuthAndRole(["ADMIN", "MANAGER"])

    const data = await request.json()
    const product = await ProductService.updateProduct(params.id, data)

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/products/[id] - Delete product (deactivate)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication - Require ADMIN role for product deletion
    await requireAuthAndRole(["ADMIN"])

    await ProductService.deactivateProduct(params.id)
    return NextResponse.json({
      success: true,
      data: { deactivated: true }
    })
  } catch (error) {
    return handleApiError(error)
  }
}