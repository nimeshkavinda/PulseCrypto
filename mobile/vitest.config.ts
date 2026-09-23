import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@pulsecrypto/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.ts'),
    },
  },
});
