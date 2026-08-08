import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', testMatch: /phase5-c3\.spec\.ts/, timeout: 90_000,
  expect: { timeout: 20_000 }, fullyParallel: false, forbidOnly: true, retries: 0, workers: 1, reporter: 'line',
  use: { baseURL: process.env.WEB_BASE_URL, locale: 'es-CL', trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
