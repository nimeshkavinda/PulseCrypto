import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
  },
  resolve: {
    // Test against shared sources directly so a fresh clone does not need a prior shared build.
    alias: {
      '@pulsecrypto/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
