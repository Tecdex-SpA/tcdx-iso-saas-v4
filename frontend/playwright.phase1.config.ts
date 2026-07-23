import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /phase1-grc\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: '../artifacts/fase-1/e2e-results.json' }],
    ['html', { outputFolder: 'playwright-report-phase1', open: 'never' }],
  ],
  use: {
    baseURL: process.env.WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
