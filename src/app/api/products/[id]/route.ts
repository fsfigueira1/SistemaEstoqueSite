import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"
import { friendlyError } from "@/lib/friendlyError"



// GET /api/products/[id] - Get product by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product viewing


    const product = await ProductService.getProductById((await params).id)

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
  } catch (error) { return NextResponse.json({ error: friendlyError(error).message }, { status: 500 }); }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product updates


    const data = await request.json()

    // "codigo" do formulário = código de barras escaneável; SKU separado é opcional.
    const barcode =
      (data.barcode ?? data.codigoBarras ?? data.codigo ?? '').toString().trim() || null
    const sku =
      (data.sku ?? data.codigoInterno ?? data.codigo ?? barcode ?? '').toString().trim() || undefined

    const productData = {
      name: data.name || data.nome,
      sku,
      categoryId: data.categoryId || data.categoriaId,
      salePrice: data.salePrice ?? data.preco,
      costPrice: data.costPrice ?? data.custo,
      stockQuantity: data.stockQuantity ?? data.estoque,
      minStockLevel: data.minStockLevel ?? data.estoqueMinimo,
      maxStockLevel: data.maxStockLevel,
      unit: data.unit,
      description: data.description,
      barcode,
      supplierId: data.supplierId,
      status: data.status,
      isFeatured: data.isFeatured,
    }

    const product = await ProductService.updateProduct((await params).id, productData)

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) { return NextResponse.json({ error: friendlyError(error).message }, { status: 500 }); }
}

// DELETE /api/products/[id] - Exclui o produto de vez (hard delete).
// Se o produto tiver histórico, retorna 409 e o cliente oferece "Descontinuar".
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const force = new URL(request.url).searchParams.get("force") === "1"
    const result = await ProductService.deleteProduct((await params).id, { force })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const code = (error as { code?: string })?.code
    // HAS_HISTORY: a tela usa o código para oferecer "Descontinuar"; o nome fica curto.
    const message =
      code === "HAS_HISTORY" ? "Produto tem vendas — marque como Descontinuado" : friendlyError(error).message
    const status = code === "HAS_HISTORY" ? 409 : 500
    return NextResponse.json(
      { success: false, error: { message, code: code ?? "DELETE_FAILED" } },
      { status }
    )
  }
}