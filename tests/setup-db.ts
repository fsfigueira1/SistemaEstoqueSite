import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { prisma } from './setup';

// Ensure test database is initialized with schema from dev.db
// We don't modify dev.db, we only read from it
async function setupTestDatabase() {
  if (existsSync('./dev.db')) {
    // Do NOT disconnect the shared PrismaClient singleton
    // The singleton must remain connected for the entire test suite
    // Just ensure we can connect (which will be a no-op if already connected)
    try {
      await prisma.$connect();
    } catch (e) {
      // Ignore if already connected
    }
  }

  // Check if test.db exists and has the correct schema
  // If not, recreate it from dev.db (which has all migrations applied)
  let shouldRecreate = false;

  if (!existsSync('./test.db')) {
    console.log('test.db does not exist, creating from dev.db');
    shouldRecreate = true;
  } else {
    // Check if test.db has the PurchaseOrder.status column (latest migration)
    try {
      await prisma.$connect();
      const result = await prisma.$queryRaw`PRAGMA table_info(PurchaseOrder)`;
      const columns = result as Array<{name: string}>;
      const hasStatus = columns.some(c => c.name === 'status');
      if (!hasStatus) {
        console.log('test.db missing PurchaseOrder.status column, recreating from dev.db');
        shouldRecreate = true;
      }
    } catch (e) {
      console.warn('Could not check test.db schema, will recreate:', (e as Error).message);
      shouldRecreate = true;
    }
  }

  if (shouldRecreate) {
    // ALWAYS delete and recreate test.db from current dev.db to ensure latest schema
    let deleteRetries = 10;
    while (deleteRetries > 0) {
      try {
        if (existsSync('./test.db')) {
          unlinkSync('./test.db');
        }
        // Also clean up WAL/SHM files
        for (const suffix of ['-wal', '-shm']) {
          const walPath = `./test.db${suffix}`;
          if (existsSync(walPath)) {
            try {
              unlinkSync(walPath);
            } catch (e) {
              // Ignore
            }
          }
        }
        break; // Success or file doesn't exist
      } catch (e) {
        deleteRetries--;
        if (deleteRetries === 0) {
          console.error('Failed to delete test.db after multiple attempts:', (e as Error).message);
          throw e;
        }
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, 10 - deleteRetries) * 100));
      }
    }

    // Create test.db by copying the current dev.db (which has all migrations applied)
    copyFileSync('./dev.db', './test.db');
    console.log('Created test.db from dev.db with latest schema');
  } else {
    console.log('test.db already has latest schema, reusing');
  }

  // Minimal cleanup - just ensure we can connect
  // The beforeEach hook in each test file will do the full cleanup
  try {
    await prisma.$connect();
    // Quick verification that we can query
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    // Ignore errors during verification
  }
}

await setupTestDatabase();