import { defineConfig, devices } from '@playwright/test';

const includePhase1 = process.env.PHASE2_INCLUDE_PHASE1 === '1';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: includePhase1 ? /phase[12]-grc\.spec\.ts/ : /phase2-grc\.spec\.ts/,
  globalSetup: './tests/e2e/phase2-global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.PHASE2_E2E_RESULTS_FILE || '../artifacts/fase-2/e2e-results.json' }],
    ['html', { outputFolder: process.env.PHASE2_PLAYWRIGHT_REPORT_DIR || '../artifacts/fase-2/phase2-playwright-report', open: 'never' }],
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
