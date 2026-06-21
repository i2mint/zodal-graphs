import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    // headless tests run in node; component tests opt into happy-dom via a per-file pragma.
    environment: 'node',
  },
});
