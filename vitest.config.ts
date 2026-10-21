import { defineConfig } from 'vitest/config';

// Unit tests for every workspace run from the repo root, so content paths resolve from here.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
