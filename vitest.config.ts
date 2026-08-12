import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    // Dependencies live on D: through a Windows junction to keep C: small.
    // Serial files avoid Vite worker RPC timeouts under concurrent junction I/O.
    fileParallelism: false,
  },
});
