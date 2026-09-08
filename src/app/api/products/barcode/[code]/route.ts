import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"


// GET /api/products/barcode/[code] - Get product by barcode
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const product = await ProductService.getProductByBarcode(decodeURIComponent(code).trim())

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
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
