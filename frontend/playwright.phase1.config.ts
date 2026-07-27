import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /phase1-grc\.spec\.ts/,
  globalSetup: './tests/e2e/phase1-global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.PHASE1_E2E_RESULTS_FILE || '../artifacts/fase-1/e2e-results.json' }],
    ['html', { outputFolder: process.env.PHASE1_PLAYWRIGHT_REPORT_DIR || '../artifacts/fase-1/phase1-playwright-report', open: 'never' }],
  ],
  use: {
    locale: 'es-CL',
    baseURL: process.env.WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
