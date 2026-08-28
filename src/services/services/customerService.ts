import { prisma, Prisma } from "../../lib/lib/prisma"
import { SaleStatus } from "../../generated/prisma/client"

// Define input types for customer operations
type CustomerCreateInput = {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

type CustomerUpdateInput = {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

export class CustomerService {
  // Get all customers with filters
  static async getCustomers(filters: {
    name?: string
    email?: string | null
    phone?: string | null
    page?: number
    limit?: number
  }) {
    const {
      name,
      email,
      phone,
      page = 1,
      limit = 10
    } = filters

    const skip = (page - 1) * limit
    const where: Prisma.CustomerWhereInput = {}

    if (name) {
      where.name = {
        contains: name
      }
    }

    if (email) {
      where.email = email
    }

    if (phone) {
      where.phone = phone
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" }
      }),
      prisma.customer.count({ where })
    ])

    return {
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get customer by ID
  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!customer) {
      throw new Error('Customer not found')
    }

    return customer
  }

  // Create a new customer
  static async createCustomer(data: CustomerCreateInput) {
    // Validate required fields
    if (!data.name) {
      throw new Error('Customer name is required')
    }

    // Validate email if provided
    if (data.email !== null && data.email !== undefined && data.email !== '') {
      const existingCustomer = await prisma.customer.findUnique({
        where: { email: data.email }
      })

      if (existingCustomer) {
        throw new Error('Customer with this email already exists')
      }
    }

    // Validate phone if provided
    if (data.phone !== null && data.phone !== undefined && data.phone !== '') {
      const existingCustomer = await prisma.customer.findFirst({
        where: { phone: data.phone }
      })

      if (existingCustomer) {
        throw new Error('Customer with this phone number already exists')
      }
    }

    const customer = await prisma.customer.create({
      data
    })

    return customer
  }

  // Update customer
  static async updateCustomer(id: string, data: CustomerUpdateInput) {
    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!existingCustomer) {
      throw new Error('Customer not found')
    }

    // Validate email uniqueness if provided
    if (data.email !== null && data.email !== undefined && data.email !== '') {
      const emailConflict = await prisma.customer.findFirst({
        where: {
          email: data.email,
          id: { not: id }
        }
      })

      if (emailConflict) {
        throw new Error('Customer with this email already exists')
      }
    }

    // Validate phone uniqueness if provided
    if (data.phone !== null && data.phone !== undefined && data.phone !== '') {
      const phoneConflict = await prisma.customer.findFirst({
        where: {
          phone: data.phone,
          id: { not: id }
        }
      })

      if (phoneConflict) {
        throw new Error('Customer with this phone number already exists')
      }
    }

    // Prevent updating immutable fields (timestamps are handled by Prisma automatically)
    // No need to validate createdAt/updatedAt as they are managed by Prisma

    const customer = await prisma.customer.update({
      where: { id },
      data
    })

    return customer
  }

  // Delete customer
  static async deleteCustomer(id: string) {
    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!customer) {
      throw new Error('Customer not found')
    }

    // Check for dependent sales
    const dependentSalesCount = await prisma.sale.count({
      where: { customerId: id }
    })

    if (dependentSalesCount > 0) {
      throw new Error(`Cannot delete customer because ${dependentSalesCount} sale(s) are associated with this customer`)
    }

    // Note: Based on schema inspection, Customer only has dependency with Sale
    // No other dependent records found in schema that would prevent deletion

    await prisma.customer.delete({
      where: { id }
    })
  }
}