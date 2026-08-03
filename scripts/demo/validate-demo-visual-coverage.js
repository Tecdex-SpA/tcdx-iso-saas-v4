#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const fail = (message) => { throw new Error(message); };
const routes = JSON.parse(read('scripts/demo/demo-visual-routes.json'));
const manifest = JSON.parse(read('scripts/demo/demo-visual-completion.manifest.json'));
const migration = read('database/migrations/20260803_demo_tenant_visual_completion.sql');
const matrix = read('docs/demo/demo-visual-coverage-matrix.md');
const apiCheck = read('scripts/demo/check-demo-visual-api.js');
const browser = read('frontend/tests/e2e/demo-visual-coverage.spec.ts');
const runner = read('scripts/demo/apply-demo-visual-completion.js');
const packageJson = JSON.parse(read('package.json'));

const requiredRoutes = [
  '/dashboard','/cumplimiento-auditoria','/diagnostico','/iso-health','/health',
  '/controles','/soa','/evidencias','/auditorias','/hallazgos','/no-conformidades',
  '/planes-accion','/plan-accion','/acciones-recomendadas','/riesgos','/matriz-riesgo',
  '/activos','/ciclo-vida','/administrar-kpis','/grc-global','/operaciones-grc','/grc',
  '/datos','/datos/semantica','/datos/calidad','/datos/lineage?entityType=metric_definition&entityId=:metric1',
  '/metricas','/encuestas','/tests','/eventos-perdida','/bi','/exportes',
  '/reportes/studio','/reportes/generaciones','/configuracion','/ia-compliance',
];
const routeSet = new Set(routes.map((item) => item.route));
for (const route of requiredRoutes) if (!routeSet.has(route)) fail(`Visible route is not inventoried: ${route}`);

const allowedTypes = new Set(['card','gráfico','tabla','timeline','heatmap','KPI']);
const identities = new Set();
for (const item of routes) {
  if (!item.route?.startsWith('/') || !item.endpoint?.startsWith('/api/')) fail(`Invalid route or endpoint: ${JSON.stringify(item)}`);
  if (!allowedTypes.has(item.type)) fail(`Invalid visual component type: ${item.type}`);
  if (!Number.isInteger(item.minimum) || item.minimum < 1) fail(`Invalid minimum for ${item.endpoint}`);
  if (!fs.existsSync(path.join(root, item.service))) fail(`Service source does not exist: ${item.service}`);
  if (!/^[a-z_][a-z0-9_,]*$/i.test(item.sql)) fail(`Invalid SQL source declaration: ${item.sql}`);
  const identity = `${item.route}|${item.component}|${item.endpoint}`;
  if (identities.has(identity)) fail(`Duplicate coverage row: ${identity}`);
  identities.add(identity);
}

const matrixRows = matrix.split(/\r?\n/).filter((line) => /^\| \/.*POSTGRES_VERIFIED_QA_PENDING \|$/.test(line));
if (matrixRows.length !== routes.length) fail(`Coverage matrix rows=${matrixRows.length}; expected=${routes.length}`);
for (const column of ['ruta','módulo','componente','endpoint','service','fuente SQL','filtro tenant','datos requeridos','datos actuales','brecha','acción de seed','validación API','validación UI','estado']) {
  if (!matrix.includes(column)) fail(`Coverage matrix column is missing: ${column}`);
}
if (/\|\s*(vacío|cero artificial|sin serie|sin relación|sin detalle|no verificable)\s*\|/i.test(matrix)) fail('Coverage matrix contains a forbidden closing state');

if (!/^BEGIN;[\s\S]*COMMIT;\s*$/m.test(migration.trim())) fail('Migration is not transaction-wrapped');
if (/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i.test(migration)) fail('Migration contains destructive SQL');
for (const table of manifest.touchedTables) {
  if (!new RegExp(`(?:INSERT\\s+INTO|UPDATE)\\s+${table}\\b`, 'i').test(migration)) fail(`Manifest has a stale touched table: ${table}`);
}
for (const phrase of ['pg_try_advisory_lock','schemaSignature','writeAttestation','validateAttestation','foreignTenantCounts','retry_from_failed','sanitizeError']) {
  if (!runner.includes(phrase)) fail(`Runner guard is missing: ${phrase}`);
}
for (const phrase of ['admin.demo@tcdx.demo','auditor.demo@tcdx.demo','response.status !== 200','seriesMinimum','tenantId']) {
  if (!apiCheck.includes(phrase)) fail(`API validation contract is missing: ${phrase}`);
}
for (const phrase of ['serverErrors','aria-busy','tbody tr','svg path','representative','iso-9001','iso-27001']) {
  if (!browser.includes(phrase)) fail(`Browser validation contract is missing: ${phrase}`);
}
for (const file of ['docs/demo/demo-browser-e2e-evidence.md','docs/demo/visual-evidence/.gitkeep']) {
  if (!fs.existsSync(path.join(root, file))) fail(`Required evidence artifact is missing: ${file}`);
}
for (const script of ['demo:visual:preflight','demo:visual:dry-run','demo:visual:apply','demo:visual:validate','demo:visual:postgres-check','demo:visual:browser-e2e']) {
  if (!packageJson.scripts?.[script]) fail(`npm script is missing: ${script}`);
}

const summary = {
  status: 'VERIFIED_DEMO_VISUAL_STATIC',
  routes: routeSet.size,
  components: routes.length,
  endpoints: new Set(routes.map((item) => item.endpoint)).size,
  services: new Set(routes.map((item) => item.service)).size,
  sqlSources: new Set(routes.flatMap((item) => item.sql.split(','))).size,
  touchedTables: manifest.touchedTables.length,
  qa: 'pending',
};
process.stdout.write(`${JSON.stringify(summary)}\n`);
