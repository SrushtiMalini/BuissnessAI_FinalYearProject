import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/lib/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setupLocalStorage.ts'],
    testTimeout: 15000,
  },
});
