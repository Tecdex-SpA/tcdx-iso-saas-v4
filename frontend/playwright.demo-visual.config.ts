import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /demo-visual-coverage\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.DEMO_BROWSER_RESULTS_FILE || '../artifacts/demo/demo-browser-results.json' }],
    ['html', { outputFolder: process.env.DEMO_BROWSER_REPORT_DIR || '../artifacts/demo/demo-browser-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.DEMO_WEB_BASE_URL,
    locale: 'es-CL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
