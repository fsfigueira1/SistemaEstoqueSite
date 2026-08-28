import { PrismaClient, Prisma } from "../../generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

// Initialize PrismaClient with SQLite adapter
// Use test database when in test environment
const databaseUrl = process.env.NODE_ENV === 'test'
  ? "file:./test.db"
  : "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
import { prisma } from "../../lib/lib/prisma"
// const prisma = new PrismaClient({ adapter }) - REMOVED to use shared instance;

// Define input types
type CreateAuditLogInput = {
  userId?: string | null
  action: string
  entity: string
  entityId: string
  metadata?: Prisma.JsonObject | null
}

export class AuditService {
  // Create an audit log entry
  static async createAuditLog(input: CreateAuditLogInput) {
    // Validate inputs
    if (!input.action || input.action.trim() === '') {
      throw new Error('Action is required')
    }
    if (!input.entity || input.entity.trim() === '') {
      throw new Error('Entity is required')
    }
    if (!input.entityId || input.entityId.trim() === '') {
      throw new Error('Entity ID is required')
    }

    // Validate user if provided
    if (input.userId !== null && input.userId !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId }
      })

      if (!user) {
        throw new Error('User not found')
      }

      if (user.status === 'INACTIVE') {
        throw new Error('User is inactive')
      }
    }

    // Create the audit log entry
    return prisma.auditLog.create({
      data: {
        user: input.userId ? { connect: { id: input.userId } } : undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    })
  }

  // Get audit log by ID
  static async getAuditLogById(id: string) {
    const auditLog = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: true
      }
    })

    if (!auditLog) {
      throw new Error('Audit log not found')
    }

    return auditLog
  }

  // Get audit logs for an entity
  static async getAuditLogsForEntity(options: {
    entity: string
    entityId?: string
    userId?: string
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  }) {
    const {
      entity,
      entityId = null,
      userId = null,
      page = 1,
      limit = 10,
      startDate = null,
      endDate = null
    } = options

    // Validate entity type
    const validEntities = ['PRODUCT', 'SALE', 'PURCHASE', 'PAYMENT', 'STOCK', 'CASH_SESSION', 'CASH_REGISTER', 'USER', 'CATEGORY', 'SUPPLIER', 'CUSTOMER']
    if (!validEntities.includes(entity)) {
      throw new Error('Invalid entity type')
    }

    const skip = (page - 1) * limit
    const where: Prisma.AuditLogWhereInput = { entity }

    if (entityId) where.entityId = entityId
    if (userId) where.userId = userId
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      auditLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get audit logs by user
  static async getAuditLogsByUser(options: {
    userId: string
    entity?: string
    action?: string
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  }) {
    const {
      userId,
      entity = null,
      action = null,
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.AuditLogWhereInput = { userId }

    if (entity) where.entity = entity
    if (action) where.action = action
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      auditLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get audit logs
  static async getAuditLogs(options: {
    entity?: string
    entityId?: string
    userId?: string
    action?: string
    page?: number
    limit?: number
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      entity,
      entityId = null,
      userId = null,
      action = null,
      page = 1,
      limit = 10,
      startDate = null,
      endDate = null
    } = options

    const skip = (page - 1) * limit
    const where: Prisma.AuditLogWhereInput = {}

    if (entity) where.entity = entity
    if (entityId) where.entityId = entityId
    if (userId) where.userId = userId
    if (action) where.action = action
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      auditLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  // Get audit log statistics
  static async getStatistics(options: {
    entity?: string
    userId?: string
    action?: string
    startDate?: Date
    endDate?: Date
  } = {}) {
    const {
      entity,
      userId,
      action,
      startDate,
      endDate
    } = options

    const where: Prisma.AuditLogWhereInput = {}
    if (entity) where.entity = entity
    if (userId) where.userId = userId
    if (action) where.action = action
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt as Record<string, unknown>),
        lte: endDate
      }
    }

    // Count by entity
    const entityCounts = await prisma.auditLog.groupBy({
      by: ['entity'],
      where,
      _count: true
    })

    // Count by action
    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true
    })

    // Count by user
    const userCounts = await prisma.auditLog.groupBy({
      by: ['userId'],
      where,
      _count: true
    })

    // Total count
    const totalCount = await prisma.auditLog.count({ where })

    return {
      byEntity: entityCounts.reduce((acc: Record<string, number>, curr: { entity: string; _count: number }) => {
        acc[curr.entity] = curr._count
        return acc
      }, {} as Record<string, number>),
      byAction: actionCounts.reduce((acc: Record<string, number>, curr: { action: string; _count: number }) => {
        acc[curr.action] = curr._count
        return acc
      }, {} as Record<string, number>),
      byUser: userCounts.reduce((acc: Record<string, number>, curr: { userId: string | null; _count: number }) => {
        acc[curr.userId ?? 'unknown'] = curr._count
        return acc
      }, {} as Record<string, number>),
      total: totalCount
    }
  }

  // Clean up old audit logs (archival)
  static async cleanupOldLogs(options: {
    olderThanDate: Date
    entity?: string
    dryRun?: boolean
  }) {
    const { olderThanDate, entity, dryRun = false } = options

    const where: Prisma.AuditLogWhereInput = { createdAt: { lt: olderThanDate } }
    if (entity) where.entity = entity

    // First, count how many would be deleted
    const countToDelete = await prisma.auditLog.count({ where })

    if (dryRun) {
      return {
        wouldDelete: countToDelete,
        cutoffDate: olderThanDate,
        entity
      }
    }

    // Actually delete
    const deleted = await prisma.auditLog.deleteMany({
      where
    })

    return {
      deletedCount: deleted.count,
      cutoffDate: olderThanDate,
      entity
    }
  }
}

export default AuditService