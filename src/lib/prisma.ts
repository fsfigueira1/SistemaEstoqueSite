// Shared PrismaClient instance to prevent SQLite_BUSY errors with multiple connections
import { PrismaClient, Prisma } from "../generated/prisma/client.ts"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

// Determine database URL based on environment
const databaseUrl = process.env.NODE_ENV === 'test'
  ? "file:./test.db"
  : "file:./dev.db";

// Create adapter and PrismaClient instance
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

export { prisma };

// Export Prisma namespace for types
export { Prisma };

// Export types for convenience
export * from "../generated/prisma/client";