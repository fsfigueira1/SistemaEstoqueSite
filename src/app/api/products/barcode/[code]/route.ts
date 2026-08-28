import { NextResponse } from "next/server"
import { ProductService } from "@/services/services/productService"
import { handleApiError } from "@/lib/lib/errorHandler"

// GET /api/products/barcode/[code] - Get product by barcode
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const product = await ProductService.getProductByBarcode(code)

    if (!product) {
      return NextResponse.json({
        success: false,
        error: {
          message: "Produto não encontrado",
          code: "PRODUCT_NOT_FOUND"
        }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    return handleApiError(error)
  }
}