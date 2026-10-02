import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against mock mode (no real Supabase, no login).
 *   npm run e2e            run headless at iPhone size
 *   npm run e2e:ui         Playwright UI
 * Screenshots land in e2e/screenshots/ (git-ignored).
 */
const PORT = 5180;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone',
      // iPhone 13 viewport/touch, rendered with Chromium (no WebKit download needed).
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: `npx vite --mode mock --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
