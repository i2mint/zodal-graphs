/**
 * Browser check for linked views: the lenses rendered together in headless Chromium (vitest
 * browser mode, playwright provider), so the real DOM paths happy-dom stubs out (the visx brush
 * gesture, React Flow's event wiring, sigma's WebGL canvas) are exercised. Run with
 * `pnpm test:browser` after `pnpm build`; CI installs Chromium first.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: false,
    include: ['tests/browser/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
