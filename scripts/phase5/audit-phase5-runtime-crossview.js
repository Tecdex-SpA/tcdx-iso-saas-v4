#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { chromium } = require(require.resolve('@playwright/test', {
  paths: [path.join(__dirname, '..', '..', 'frontend')],
}));

const repoRoot = path.join(__dirname, '..', '..');
const baseUrl = process.env.PHASE5_RUNTIME_BASE_URL || 'https://tcdx-iso.tecdex.net';
const tenantFilter = process.env.PHASE5_RUNTIME_TENANT || 'tenant-1';
const shouldRecalculate = process.env.PHASE5_RUNTIME_RECALCULATE === '1';

const tenants = [
  {
    key: 'tenant-1',
    dir: 'tenant-1',
    email: 'admin.demo@tcdx.local',
    passwordEnv: 'PHASE5_TENANT1_PASSWORD',
    role: 'admin',
    writable: true,
  },
  {
    key: 'tenant-2',
    dir: 'tenant-2',
    email: 'admin.demo@tcdx.demo',
    passwordEnv: 'PHASE5_TENANT2_PASSWORD',
    role: 'admin',
    writable: true,
  },
  {
    key: 'tenant-3-credex',
    dir: 'tenant-3-credex',
    email: 'andres.barouh@credex.cl',
    passwordEnv: 'PHASE5_TENANT3_PASSWORD',
    role: 'admin-readonly',
    writable: false,
  },
].filter((tenant) => tenantFilter === 'all' || tenant.key === tenantFilter);

const relevantApi = [
  '/api/auth/login',
  '/api/user/me',
  '/api/me/modules',
  '/api/kpis/admin/',
  '/api/kpi/effective-health-summary/',
  '/api/kpis/effective-health-summary/',
  '/api/metrics/official/dashboard',
  '/api/metrics/official/catalog',
  '/api/metrics/official/export',
  '/api/health/dashboard',
  '/api/dashboard/',
  '/api/dashboard-controls/',
  '/api/action-plans/',
  '/api/audits/',
  '/api/assets/risk-summary/',
];

const sensitiveKey = /(authorization|token|password|secret|cookie|set-cookie|jwt|bearer|credential)/i;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKey.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitize(child);
    }
  }
  return output;
}

async function responseBody(response) {
  const contentType = response.headers()['content-type'] || '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return sanitize(await response.json());
  } catch {
    return undefined;
  }
}

function isRelevant(url) {
  return relevantApi.some((entry) => url.includes(entry));
}

async function login(request, tenant) {
  const password = process.env[tenant.passwordEnv];
  if (!password) {
    throw new Error(`Missing required env var ${tenant.passwordEnv}`);
  }
  const response = await request.post(`${baseUrl}/api/auth/login`, {
    data: { email: tenant.email, password },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok() || typeof payload.token !== 'string') {
    throw new Error(`Login failed for ${tenant.key}: HTTP ${response.status()}`);
  }
  return payload.token;
}

async function capturePage(page, relativePath, screenshotPath, waitForText) {
  await page.goto(`${baseUrl}${relativePath}`, { waitUntil: 'domcontentloaded' });
  if (waitForText) {
    await page.getByText(waitForText, { exact: false }).first().waitFor({ timeout: 25_000 }).catch(() => undefined);
  }
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

async function postOfficialRecalculate(request, token) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const response = await request.post(`${baseUrl}/api/metrics/official/dashboard/recalculate`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      period: {
        key: now.toISOString().slice(0, 7),
        start: start.toISOString(),
        end: now.toISOString(),
        timezone: 'America/Santiago',
      },
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status(), ok: response.ok(), body: sanitize(body) };
}

async function main() {
  if (!tenants.length) throw new Error(`No tenant selected by PHASE5_RUNTIME_TENANT=${tenantFilter}`);

  const browser = await chromium.launch({ headless: true });
  const summary = [];

  try {
    for (const tenant of tenants) {
      const artifactDir = path.join(repoRoot, 'artifacts', 'phase5-human-runtime', tenant.dir);
      ensureDir(artifactDir);

      const context = await browser.newContext({
        baseURL: baseUrl,
        locale: 'es-CL',
        viewport: { width: 1440, height: 1200 },
        ignoreHTTPSErrors: false,
      });
      const network = [];
      context.on('response', async (response) => {
        const url = response.url();
        if (!isRelevant(url)) return;
        network.push({
          url: url.replace(baseUrl, ''),
          method: response.request().method(),
          status: response.status(),
          ok: response.ok(),
          body: await responseBody(response),
        });
      });

      const token = await login(context.request, tenant);
      await context.addInitScript((authToken) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('token', authToken);
      }, token);

      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await capturePage(
        page,
        '/administrar-kpis',
        path.join(artifactDir, '40_runtime_admin_kpis_current.png'),
        'Administr'
      );
      await fs.promises.writeFile(
        path.join(artifactDir, '40_runtime_admin_kpis_current_network.json'),
        JSON.stringify({ tenant: tenant.key, route: '/administrar-kpis', network: sanitize(network), console_errors: consoleErrors }, null, 2)
      );

      const beforeDashboardNetworkLength = network.length;
      await capturePage(
        page,
        '/dashboard?view=kpi',
        path.join(artifactDir, '41_runtime_dashboard_kpi_current.png'),
        'KPI'
      );
      await fs.promises.writeFile(
        path.join(artifactDir, '41_runtime_dashboard_kpi_current_network.json'),
        JSON.stringify({
          tenant: tenant.key,
          route: '/dashboard?view=kpi',
          network: sanitize(network.slice(beforeDashboardNetworkLength)),
          console_errors: consoleErrors,
        }, null, 2)
      );

      const beforeMetricsNetworkLength = network.length;
      await capturePage(
        page,
        '/metricas',
        path.join(artifactDir, '42_runtime_metricas_current.png'),
        'Indicadores oficiales'
      );
      await fs.promises.writeFile(
        path.join(artifactDir, '42_runtime_metricas_current_network.json'),
        JSON.stringify({
          tenant: tenant.key,
          route: '/metricas',
          network: sanitize(network.slice(beforeMetricsNetworkLength)),
          console_errors: consoleErrors,
        }, null, 2)
      );

      const beforeBiNetworkLength = network.length;
      await capturePage(
        page,
        '/bi',
        path.join(artifactDir, '43_runtime_bi_current.png'),
        'Business Intelligence'
      );
      await fs.promises.writeFile(
        path.join(artifactDir, '43_runtime_bi_current_network.json'),
        JSON.stringify({
          tenant: tenant.key,
          route: '/bi',
          network: sanitize(network.slice(beforeBiNetworkLength)),
          console_errors: consoleErrors,
        }, null, 2)
      );

      if (shouldRecalculate && tenant.writable) {
        const recalculateResult = await postOfficialRecalculate(context.request, token);
        await fs.promises.writeFile(
          path.join(artifactDir, '44_runtime_dashboard_recalculate_response.json'),
          JSON.stringify({ tenant: tenant.key, route: '/api/metrics/official/dashboard/recalculate', response: recalculateResult }, null, 2)
        );

        const beforeAfterRecalcNetworkLength = network.length;
        await capturePage(
          page,
          '/dashboard?view=kpi',
          path.join(artifactDir, '45_runtime_dashboard_kpi_after_recalculate.png'),
          'KPI'
        );
        await fs.promises.writeFile(
          path.join(artifactDir, '45_runtime_dashboard_kpi_after_recalculate_network.json'),
          JSON.stringify({
            tenant: tenant.key,
            route: '/dashboard?view=kpi',
            after: 'official_dashboard_recalculate',
            network: sanitize(network.slice(beforeAfterRecalcNetworkLength)),
            console_errors: consoleErrors,
          }, null, 2)
        );

        const beforeAfterMetricasNetworkLength = network.length;
        await capturePage(
          page,
          '/metricas',
          path.join(artifactDir, '46_runtime_metricas_after_recalculate.png'),
          'Indicadores oficiales'
        );
        await fs.promises.writeFile(
          path.join(artifactDir, '46_runtime_metricas_after_recalculate_network.json'),
          JSON.stringify({
            tenant: tenant.key,
            route: '/metricas',
            after: 'official_dashboard_recalculate',
            network: sanitize(network.slice(beforeAfterMetricasNetworkLength)),
            console_errors: consoleErrors,
          }, null, 2)
        );
      }

      summary.push({
        tenant: tenant.key,
        dir: path.relative(repoRoot, artifactDir),
        screenshots: [
          '40_runtime_admin_kpis_current.png',
          '41_runtime_dashboard_kpi_current.png',
          '42_runtime_metricas_current.png',
          '43_runtime_bi_current.png',
        ],
        network_files: [
          '40_runtime_admin_kpis_current_network.json',
          '41_runtime_dashboard_kpi_current_network.json',
          '42_runtime_metricas_current_network.json',
          '43_runtime_bi_current_network.json',
          ...(shouldRecalculate && tenant.writable
            ? [
                '44_runtime_dashboard_recalculate_response.json',
                '45_runtime_dashboard_kpi_after_recalculate_network.json',
                '46_runtime_metricas_after_recalculate_network.json',
              ]
            : []),
        ],
        console_errors: consoleErrors.length,
      });

      await context.clearCookies();
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const outputDir = path.join(repoRoot, 'artifacts', 'phase5-human-runtime', 'final-crossview');
  ensureDir(outputDir);
  const outputFile = path.join(outputDir, '40_runtime_crossview_audit_summary.json');
  await fs.promises.writeFile(outputFile, JSON.stringify({ baseUrl, tenants: summary }, null, 2));
  process.stdout.write(JSON.stringify({ status: 'PHASE5_RUNTIME_CROSSVIEW_AUDIT_CAPTURED', output: path.relative(repoRoot, outputFile), tenants: summary }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
