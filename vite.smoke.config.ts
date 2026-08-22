import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/provider-smoke.smoke.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
  },
});
