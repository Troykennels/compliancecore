import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // Generous: the integration tests spawn the real migration runner and
    // provision tenant schemas; DB round-trip latency varies a lot by host.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
