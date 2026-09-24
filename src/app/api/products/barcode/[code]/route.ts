import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"
import { friendlyError } from "@/lib/friendlyError"


// GET /api/products/barcode/[code] - Get product by barcode
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const raw = decodeURIComponent(code).trim()
    // Tenta pelo código de barras; se não achar, tenta pelo SKU (lojas pequenas
    // costumam escanear o próprio código interno do produto).
    const product =
      (await ProductService.getProductByBarcode(raw)) ??
      (await ProductService.getProductBySku(raw))

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
  } catch (error) { return NextResponse.json({ error: friendlyError(error).message }, { status: 500 }); }
}
