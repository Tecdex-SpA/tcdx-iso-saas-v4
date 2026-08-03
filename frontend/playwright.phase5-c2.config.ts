import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /phase5-c2-semantic\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.PHASE5_5_E2E_RESULTS_FILE || '../artifacts/phase5-c2/browser-e2e-results.json' }],
    ['html', { outputFolder: process.env.PHASE5_5_PLAYWRIGHT_REPORT_DIR || '../artifacts/phase5-c2/playwright-report', open: 'never' }],
  ],
  use: {
    locale: 'es-CL',
    baseURL: process.env.WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
