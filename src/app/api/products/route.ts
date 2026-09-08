import { NextResponse } from "next/server"
import { ProductService } from "@/services/productService"

// GET /api/products - List products with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

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
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "10")
    }

    // Validate pagination
    if (isNaN(filters.page) || filters.page < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      )
    }
    if (isNaN(filters.limit) || filters.limit < 1) {
      return NextResponse.json(
        { error: "Invalid limit" },
        { status: 400 }
      )
    }

    const result = await ProductService.getProducts(filters)

    // Return standardized success response
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}

// POST /api/products - Create new product
export async function POST(request: Request) {
  try {
    const data = await request.json()
    // Aceita nomes em português (nome, codigo/codigoBarras, categoriaId, preco, custo,
    // estoque, estoqueMinimo) e inglês (name, sku, barcode, categoryId, ...).
    // "codigo" no formulário é o código de barras escaneável; se não vier um SKU
    // separado, o próprio código de barras vira o SKU.
    const barcode =
      (data.barcode ?? data.codigoBarras ?? data.codigo ?? '').toString().trim() || null
    const sku =
      (data.sku ?? data.codigoInterno ?? data.codigo ?? barcode ?? '').toString().trim()

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

    const product = await ProductService.createProduct(productData)

    // Return standardized success response with 201 status
    return NextResponse.json(
      {
        success: true,
        data: product
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}