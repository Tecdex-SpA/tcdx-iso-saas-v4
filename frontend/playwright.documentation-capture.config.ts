import { defineConfig, devices } from '@playwright/test';

// Documentation captures emulate a 1920x1080 Chromium window at 67% browser zoom.
// The effective CSS viewport is therefore ~2866x1612. deviceScaleFactor=2 keeps the
// same responsive layout while producing ~5732x3224 PNGs for crisp PDF embedding.
const DOC_ZOOM = 0.67;
const PHYSICAL_WIDTH = 1920;
const PHYSICAL_HEIGHT = 1080;
const EFFECTIVE_WIDTH = Math.round(PHYSICAL_WIDTH / DOC_ZOOM);
const EFFECTIVE_HEIGHT = Math.round(PHYSICAL_HEIGHT / DOC_ZOOM);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /documentation-(capture|readiness|transactional|transactional-fix|controls-evidence|findings-actions|nonconformities-remediation|audits|ai-auditor|ai-compliance|dashboard-health|soa|demo-enrichment|v6-core)\.spec\.ts/,
  timeout: 180_000,
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
      viewport: { width: EFFECTIVE_WIDTH, height: EFFECTIVE_HEIGHT },
      screen: { width: EFFECTIVE_WIDTH, height: EFFECTIVE_HEIGHT },
      deviceScaleFactor: 2,
    },
  }],
});
