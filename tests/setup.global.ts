import { cleanupDatabase } from './utils';

// This runs before each test file to ensure a clean state
export async function setup() {
  await cleanupDatabase();
}

// This runs after each test file to ensure clean teardown
export async function teardown() {
  await cleanupDatabase();
}