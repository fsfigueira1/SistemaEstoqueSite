// Shared PrismaClient instance to prevent SQLite_BUSY errors with multiple connections
import { PrismaClient, Prisma } from "@/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { getDatabaseUrl } from "./db-path"

// Get database URL using our Electron-aware function
const databaseUrl = process.env.NODE_ENV === 'test'
  ? "file:./test.db"
  : getDatabaseUrl();

// Create adapter and PrismaClient instance
// Type assertion to resolve Prisma adapter type mismatch (known issue with better-sqlite3 adapter)
const adapter = new PrismaBetterSqlite3({ url: databaseUrl }) as any;
const prisma = new PrismaClient({ adapter });

export { prisma };

// Export Prisma namespace for types
export { Prisma };

// Export types for convenience
export * from "@/generated/prisma/client"