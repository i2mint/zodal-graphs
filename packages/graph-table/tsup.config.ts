import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/headless.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@tanstack/react-table'],
});
