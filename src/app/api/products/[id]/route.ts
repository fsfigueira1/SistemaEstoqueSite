import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"



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
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN or MANAGER role for product updates


    const data = await request.json()

    // Support both Portuguese (nome, codigo, categoriaId, preco, custo, estoque, estoqueMinimo)
    // and English (name, sku, categoryId, salePrice, costPrice, stockQuantity, minStockLevel) field names
    const productData = {
      name: data.name || data.nome,
      sku: data.sku || data.codigo,
      categoryId: data.categoryId || data.categoriaId,
      salePrice: data.salePrice ?? data.preco,
      costPrice: data.costPrice ?? data.custo,
      stockQuantity: data.stockQuantity ?? data.estoque,
      minStockLevel: data.minStockLevel ?? data.estoqueMinimo,
      maxStockLevel: data.maxStockLevel,
      unit: data.unit,
      description: data.description,
      barcode: data.barcode,
      supplierId: data.supplierId,
      status: data.status,
      isFeatured: data.isFeatured,
    }

    const product = await ProductService.updateProduct((await params).id, productData)

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

// DELETE /api/products/[id] - Delete product (deactivate)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication - Require ADMIN role for product deletion


    await ProductService.deactivateProduct((await params).id)
    return NextResponse.json({
      success: true,
      data: { deactivated: true }
    })
  } catch (error) { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}