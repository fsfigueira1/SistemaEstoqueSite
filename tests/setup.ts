// Shared PrismaClient instance - import from the main lib to avoid multiple connections
import { prisma } from "../src/lib/prisma";

// Export Prisma namespace for types
import { Prisma } from "../src/generated/prisma/client";

export { prisma };
export { Prisma };

// Export types for convenience
export * from "../src/generated/prisma/client";

/**
 * Ensure migrations are run only once
 * Called automatically when module is imported
 */
export async function ensureMigrations() {
  // Migrations should already be handled by the main application
  // In test environment, we rely on the existing dev.db or create fresh test.db
  // For consistency with other services, we'll use the same approach
}

// Run migrations automatically when this module is imported
// Using top-level await equivalent with Promise.then()
ensureMigrations().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});