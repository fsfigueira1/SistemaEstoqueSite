import { prisma, Prisma } from "../lib/prisma.ts"

// Define input types for category operations
type CategoryCreateInput = {
  name: string
  description?: string | null
  icon?: string | null
  color?: string | null
}

type CategoryUpdateInput = {
  name?: string
  description?: string | null
  icon?: string | null
  color?: string | null
}

export class CategoryService {
  // Get all categories with filters
  static async getCategories(filters: {
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
    const where: Prisma.CategoryWhereInput = {}

    if (name) {
      where.name = {
        contains: name, mode: "insensitive" as const
      }
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" }
      }),
      prisma.category.count({ where })
    ])

    return {
      categories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get category by ID
  static async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id }
    })

    if (!category) {
      throw new Error('Category not found')
    }

    return category
  }

  // Create a new category
  static async createCategory(data: CategoryCreateInput) {
    // Validate required fields
    if (!data.name) {
      throw new Error('Category name is required')
    }

    // Validate name uniqueness if provided
    if (data.name !== null && data.name !== undefined && data.name !== '') {
      const existingCategory = await prisma.category.findFirst({
        where: { name: data.name }
      })

      if (existingCategory) {
        throw new Error('Category with this name already exists')
      }
    }

    const category = await prisma.category.create({
      data
    })

    return category
  }

  // Update category
  static async updateCategory(id: string, data: CategoryUpdateInput) {
    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      throw new Error('Category not found')
    }

    // Validate name uniqueness if provided
    if (data.name !== null && data.name !== undefined && data.name !== '') {
      const nameConflict = await prisma.category.findFirst({
        where: {
          name: data.name,
          id: { not: id }
        }
      })

      if (nameConflict) {
        throw new Error('Category with this name already exists')
      }
    }

    // Prevent updating immutable fields (timestamps are handled by Prisma automatically)
    // No need to validate createdAt/updatedAt as they are managed by Prisma

    const category = await prisma.category.update({
      where: { id },
      data
    })

    return category
  }

  // Delete category
  static async deleteCategory(id: string) {
    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id }
    })

    if (!category) {
      throw new Error('Category not found')
    }

    // Check for dependent products
    const dependentProductsCount = await prisma.product.count({
      where: { categoryId: id }
    })

    if (dependentProductsCount > 0) {
      throw new Error(`Cannot delete category because ${dependentProductsCount} product(s) are associated with this category`)
    }

    await prisma.category.delete({
      where: { id }
    })
  }
}