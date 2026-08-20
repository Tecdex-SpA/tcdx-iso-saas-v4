import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /documentation-(capture|readiness|transactional|transactional-fix|controls-evidence|findings-actions|nonconformities-remediation|audits|ai-auditor|ai-compliance|dashboard-health|soa|demo-enrichment)\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.DOC_RESULTS_FILE || '../artifacts/documentation/results.json' }],
    ['html', { outputFolder: process.env.DOC_REPORT_DIR || '../artifacts/documentation/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.DOC_WEB_BASE_URL,
    locale: 'es-CL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1920, height: 1080 },
      screen: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    },
  }],
});
