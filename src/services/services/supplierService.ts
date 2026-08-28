import { prisma, Prisma } from "../../lib/lib/prisma"

// Define input types for supplier operations
type SupplierCreateInput = {
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

type SupplierUpdateInput = {
  name?: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

export class SupplierService {
  // Get all suppliers with filters
  static async getSuppliers(filters: {
    name?: string
    page?: number
    limit?: number
  }) {
    const {
      name,
      page = 1,
      limit = 10
    } = filters

    const skip = (page - 1) * limit
    const where: Prisma.SupplierWhereInput = {}

    if (name) {
      where.name = {
        contains: name
      }
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" }
      }),
      prisma.supplier.count({ where })
    ])

    return {
      suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get supplier by ID
  static async getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    })

    if (!supplier) {
      throw new Error('Supplier not found')
    }

    return supplier
  }

  // Create a new supplier
  static async createSupplier(data: SupplierCreateInput) {
    // Validate required fields
    if (!data.name) {
      throw new Error('Supplier name is required')
    }

    // Validate name uniqueness if provided
    if (data.name !== null && data.name !== undefined && data.name !== '') {
      const existingSupplier = await prisma.supplier.findFirst({
        where: { name: data.name }
      })

      if (existingSupplier) {
        throw new Error('Supplier with this name already exists')
      }
    }

    const supplier = await prisma.supplier.create({
      data
    })

    return supplier
  }

  // Update supplier
  static async updateSupplier(id: string, data: SupplierUpdateInput) {
    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id }
    })

    if (!existingSupplier) {
      throw new Error('Supplier not found')
    }

    // Validate name uniqueness if provided
    if (data.name !== null && data.name !== undefined && data.name !== '') {
      const nameConflict = await prisma.supplier.findFirst({
        where: {
          name: data.name,
          id: { not: id }
        }
      })

      if (nameConflict) {
        throw new Error('Supplier with this name already exists')
      }
    }

    // Prevent updating immutable fields (timestamps are handled by Prisma automatically)
    // No need to validate createdAt/updatedAt as they are managed by Prisma

    const supplier = await prisma.supplier.update({
      where: { id },
      data
    })

    return supplier
  }

  // Delete supplier
  static async deleteSupplier(id: string) {
    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    })

    if (!supplier) {
      throw new Error('Supplier not found')
    }

    // Check for dependent products
    const dependentProductsCount = await prisma.product.count({
      where: { supplierId: id }
    })

    // Check for dependent purchase orders
    const dependentPurchaseOrdersCount = await prisma.purchaseOrder.count({
      where: { supplierId: id }
    })

    const totalDependencies = dependentProductsCount + dependentPurchaseOrdersCount

    if (totalDependencies > 0) {
      throw new Error(`Cannot delete supplier because ${totalDependencies} record(s) are associated with this supplier (${dependentProductsCount} product(s) and ${dependentPurchaseOrdersCount} purchase order(s))`)
    }

    await prisma.supplier.delete({
      where: { id }
    })
  }
}