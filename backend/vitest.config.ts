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
    // Integration test files share ONE database and each rebuilds the `global`
    // schema from scratch. Run in parallel they drop it out from under each
    // other, which shows up as an unrelated file failing intermittently — a
    // flake that costs far more to chase than the few seconds saved here.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
