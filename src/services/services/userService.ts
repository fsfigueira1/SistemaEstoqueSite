import { prisma } from "../../lib/lib/prisma"
import { Role, UserStatus } from "../../generated/prisma/client"

// Define input types for user operations
type UserCreateInput = {
  name: string
  email: string
  password: string
  role?: Role
  status?: UserStatus
}

type UserUpdateInput = {
  name?: string
  email?: string
  password?: string
  role?: Role
  status?: UserStatus
}

export class UserService {
  // Get all users with filters
  static async getUsers(filters: {
    role?: Role
    status?: UserStatus
    search?: string
    page?: number
    limit?: number
  }) {
    const {
      role,
      status,
      search,
      page = 1,
      limit = 10
    } = filters

    const skip = (page - 1) * limit
    const where: {
      role?: Role
      status?: UserStatus
      OR?: Array<{
        name?: { contains: string }
        email?: { contains: string }
      }>
    } = {}

    if (role !== undefined) where.role = role
    if (status !== undefined) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" }
      }),
      prisma.user.count({ where })
    ])

    // Convert passwords to exclude from results for security
    const usersWithoutPassword = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword)

    return {
      users: usersWithoutPassword,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get user by ID
  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    return user
  }

  // Get user by email
  static async getUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return user // May be null if not found
  }

  // Create new user
  static async createUser(data: UserCreateInput) {
    // Validate required fields
    if (!data.name || !data.email || !data.password) {
      throw new Error('Missing required fields: name, email, and password are required')
    }

    // Validate email format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format')
    }

    // Validate password length
    if (data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Hash password (in a real implementation, you would use bcrypt)
    // For now, we'll store it as-is to maintain compatibility with existing code
    // TODO: Implement proper password hashing
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role ?? 'USER',
        status: data.status ?? 'ACTIVE'
      }
    })

    // Return user without password for security
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  // Update user
  static async updateUser(id: string, data: UserUpdateInput) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      throw new Error('User not found')
    }

    // Validate email format if provided
    if (data.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(data.email)) {
        throw new Error('Invalid email format')
      }

      // Check if another user already has this email
      if (data.email !== existingUser.email) {
        const duplicateUser = await prisma.user.findUnique({
          where: { email: data.email }
        })
        if (duplicateUser) {
          throw new Error('User with this email already exists')
        }
      }
    }

    // Validate password length if provided
    if (data.password !== undefined && data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        status: data.status
      }
    })

    // Return user without password for security
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  // Deactivate user (set to INACTIVE)
  static async deactivateUser(id: string) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      throw new Error('User not found')
    }

    // Prevent deactivation of last admin user
    if (existingUser.role === 'ADMIN' && existingUser.status === 'ACTIVE') {
      const adminCount = await prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      })
      if (adminCount <= 1) {
        throw new Error('Cannot deactivate the last active admin user')
      }
    }

    return prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  // Activate user (set to ACTIVE)
  static async activateUser(id: string) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      throw new Error('User not found')
    }

    return prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  // Change user role
  static async changeUserRole(id: string, role: Role) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      throw new Error('User not found')
    }

    // Prevent removing role from last admin user
    if (existingUser.role === 'ADMIN' && role !== 'ADMIN' && existingUser.status === 'ACTIVE') {
      const adminCount = await prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      })
      if (adminCount <= 1) {
        throw new Error('Cannot remove admin role from the last active admin user')
      }
    }

    return prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  // Get user statistics
  static async getUserStatistics() {
    const [totalUsers, activeUsers, inactiveUsers, adminUsers, managerUsers, regularUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'INACTIVE' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'MANAGER' } }),
      prisma.user.count({ where: { role: 'USER' } })
    ])

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      byRole: {
        admin: adminUsers,
        manager: managerUsers,
        user: regularUsers
      }
    }
  }
}

export default UserService