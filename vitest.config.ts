import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next', 'out', 'tests/debug-test.test.ts', 'tests/service-env-test.test.ts', 'tests/env-test.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    teardownTimeout: 30000,
    testTimeout: 15000, // Increased from 10000ms to 15000ms to accommodate slower tests
    hookTimeout: 15000, // Added hook timeout to prevent beforeEach/afterEach timeouts
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services'],
      exclude: [
        'node_modules',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});