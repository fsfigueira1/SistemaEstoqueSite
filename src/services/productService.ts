import { prisma, Prisma } from "../lib/prisma"
import { ProductStatus } from "../generated/prisma/client.ts"

// Define input types for product operations
type ProductCreateInput = {
  name: string
  description?: string | null
  sku: string
  barcode?: string | null
  categoryId: string
  supplierId?: string | null
  costPrice: number | Prisma.Decimal
  salePrice: number | Prisma.Decimal
  stockQuantity?: number
  minStockLevel?: number
  maxStockLevel?: number
  unit?: string
  status?: ProductStatus
  isFeatured?: boolean
}

type ProductUpdateInput = {
  name?: string
  description?: string | null
  sku?: string
  barcode?: string | null
  categoryId?: string
  supplierId?: string | null
  costPrice?: number | Prisma.Decimal
  salePrice?: number | Prisma.Decimal
  stockQuantity?: number
  minStockLevel?: number
  maxStockLevel?: number
  unit?: string
  status?: ProductStatus
  isFeatured?: boolean
}

export class ProductService {
  // Get all products with filters
  static async getProducts(filters: {
    categoryId?: string
    supplierId?: string
    search?: string
    status?: ProductStatus
    page?: number
    limit?: number
  }) {
    const {
      categoryId,
      supplierId,
      search,
      status,
      page = 1,
      limit = 10
    } = filters

    const skip = (page - 1) * limit
    type StrFilter = { contains: string; mode?: "insensitive" }
    const where: {
      categoryId?: string
      supplierId?: string
      status?: ProductStatus
      OR?: Array<{
        name?: StrFilter
        sku?: StrFilter
        barcode?: StrFilter
      }>
    } = {}

    if (categoryId) where.categoryId = categoryId
    if (supplierId) where.supplierId = supplierId
    if (status !== undefined) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } }
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          supplier: true
        },
        skip,
        take: limit,
        orderBy: { name: "asc" }
      }),
      prisma.product.count({ where })
    ])

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get product by ID
  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        stockMovements: {
          orderBy: { createdAt: "desc" }
        }
      }
    })

    if (!product) {
      throw new Error('Product not found')
    }

    return product
  }

  // Get product by SKU
  static async getProductBySku(sku: string) {
    return prisma.product.findUnique({
      where: { sku },
      include: {
        category: true,
        supplier: true
      }
    })
  }

  // Get product by barcode
  static async getProductByBarcode(barcode: string) {
    return prisma.product.findUnique({
      where: { barcode },
      include: {
        category: true,
        supplier: true
      }
    })
  }

  // Create new product
  static async createProduct(data: ProductCreateInput) {
    // Validate required fields
    if (!data.name || !data.sku || !data.categoryId) {
      throw new Error('Missing required fields: name, sku, and categoryId are required')
    }

    // Validate prices are not negative
    if (Number(data.costPrice) < 0) {
      throw new Error('Cost price cannot be negative')
    }
    if (Number(data.salePrice) < 0) {
      throw new Error('Sale price cannot be negative')
    }

    // Validate stock levels
    if (data.minStockLevel !== undefined && data.minStockLevel < 0) {
      throw new Error('Minimum stock level cannot be negative')
    }
    if (data.maxStockLevel !== undefined && data.maxStockLevel < 0) {
      throw new Error('Maximum stock level cannot be negative')
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined &&
        data.minStockLevel > data.maxStockLevel) {
      throw new Error('Minimum stock level cannot be greater than maximum stock level')
    }

    // Validate stockQuantity if provided
    if (data.stockQuantity !== undefined && data.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative')
    }

    const product = await prisma.product.create({
      data
    })

    // Convert Decimal values to numbers for consistency with test expectations
    return {
      ...product,
      costPrice: product.costPrice.toNumber(),
      salePrice: product.salePrice.toNumber()
    }
  }

  // Update product
  static async updateProduct(id: string, data: ProductUpdateInput) {
    // Validate prices are not negative if provided
    if (data.costPrice !== undefined && Number(data.costPrice) < 0) {
      throw new Error('Cost price cannot be negative')
    }
    if (data.salePrice !== undefined && Number(data.salePrice) < 0) {
      throw new Error('Sale price cannot be negative')
    }

    // Validate stock levels if provided
    if (data.minStockLevel !== undefined && data.minStockLevel < 0) {
      throw new Error('Minimum stock level cannot be negative')
    }
    if (data.maxStockLevel !== undefined && data.maxStockLevel < 0) {
      throw new Error('Maximum stock level cannot be negative')
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined &&
        data.minStockLevel > data.maxStockLevel) {
      throw new Error('Minimum stock level cannot be greater than maximum stock level')
    }

    // Validate stockQuantity if provided
    if (data.stockQuantity !== undefined && data.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative')
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({ where: { id } })
    if (!existingProduct) {
      throw new Error('Product not found')
    }

    // Prevent deactivation if product has sales history (optional business rule)
    // Note: This check could be expensive, so we might want to make it configurable
    if (data.status === ProductStatus.INACTIVE || data.status === ProductStatus.DISCONTINUED) {
      // In a real implementation, we might check for recent sales
      // For now, we'll allow deactivation but note that physical deletion is not allowed
    }

    const product = await prisma.product.update({
      where: { id },
      data
    })

    // Convert Decimal values to numbers for consistency with test expectations
    return {
      ...product,
      costPrice: product.costPrice.toNumber(),
      salePrice: product.salePrice.toNumber()
    }
  }

  // Deactivate product (set to INACTIVE or DISCONTINUED)
  static async deactivateProduct(id: string, reason: 'INACTIVE' | 'DISCONTINUED' = 'INACTIVE') {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({ where: { id } })
    if (!existingProduct) {
      throw new Error('Product not found')
    }

    // Prevent deactivation if product has recent sales (business rule)
    // In a real system, we might check for sales in the last 30 days
    // For now, we'll allow it but note that physical deletion is prohibited

    return prisma.product.update({
      where: { id },
      data: {
        status: reason === 'INACTIVE' ? ProductStatus.INACTIVE : ProductStatus.DISCONTINUED
      }
    })
  }

  // Activate product (set to ACTIVE)
  static async activateProduct(id: string) {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({ where: { id } })
    if (!existingProduct) {
      throw new Error('Product not found')
    }

    return prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ACTIVE }
    })
  }

  // Get low stock products
  static async getLowStockProducts() {
    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE
      },
      include: {
        category: true,
        supplier: true
      }
    })

    return products.filter((product: any) => product.stockQuantity <= product.minStockLevel)
  }

  // Get product stock movements
  static async getStockMovements(productId: string, limit = 50) {
    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new Error('Product not found')
    }

    return prisma.stockMovement.findMany({
      where: { productId },
      take: limit,
      orderBy: { createdAt: "desc" }
    })
  }
}

export default ProductService