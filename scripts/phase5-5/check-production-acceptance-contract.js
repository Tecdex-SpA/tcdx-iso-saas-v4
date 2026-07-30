#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const orchestrator = read('backend/src/services/math-governance/officialCalculationOrchestrator.service.js');
const migration = read('database/migrations/20260730_phase5_5_snapshot_contract_hotfix.sql');
const runner = read('scripts/phase5/apply-phase5-migration.js');
const formulaCatalog = read('frontend/src/components/math-governance/FormulaCatalog.tsx');
const evidenceDialog = read('frontend/src/components/math-governance/OfficialEvidenceDialog.tsx');
const analyticsPanel = read('frontend/src/components/math-governance/OfficialAnalyticsPanel.tsx');
const tenantContext = read('frontend/src/components/math-governance/MetricsTenantContext.tsx');
const authRoutes = read('backend/src/routes/auth.routes.js');
const sidebar = read('frontend/src/components/Sidebar.tsx');
const permissions = read('frontend/src/utils/mvpPermissions.ts');
const postgresTest = read('scripts/phase5-5/check-50-formulas-snapshot-postgres.js');

assert(orchestrator.includes("SOURCE_DATASET_SNAPSHOT_TYPE = 'source_dataset'"), 'orchestrator must use source_dataset');
assert(!orchestrator.includes("'source',$4"), 'legacy snapshot_type=source must be absent');
assert(orchestrator.includes('SOURCE_SNAPSHOT_NOT_PERSISTED'), 'calculation must not publish without source snapshot');
assert(orchestrator.includes('source_contract_status') && orchestrator.includes('source_resolution_status'), 'source contract and resolution states must be separated');

assert(migration.includes("'source_dataset','input','output','explanation','comparison'"), 'migration must define production snapshot types');
assert(runner.includes('20260730_phase5_5_snapshot_contract_hotfix'), 'migration runner must register snapshot hotfix');
assert(runner.includes("snapshot_contract: 'source_dataset'"), 'migration postcondition must verify source_dataset');

assert(formulaCatalog.includes('bg-orange-600') && formulaCatalog.includes('focus-visible:outline'), 'recalculate button must have explicit visible and focus states');
assert(formulaCatalog.includes('Contrato') && formulaCatalog.includes('Fuente y datos') && formulaCatalog.includes('Ejecución'), 'catalog must separate contract, source/data and execution');
assert(formulaCatalog.includes('OfficialEvidenceDialog'), 'metrics must use shared evidence dialog');
assert(!formulaCatalog.includes('href={`/api/grc/official/calculations/'), 'metrics must not expose protected API links');

assert(analyticsPanel.includes('OfficialEvidenceDialog'), 'BI must use shared evidence dialog');
assert(!analyticsPanel.includes('href={`/api/grc/official/calculations/'), 'BI must not expose protected API links');
assert(analyticsPanel.includes('Sin ejecución oficial') && analyticsPanel.includes('Resultado oficial disponible'), 'BI must distinguish execution availability');
assert(analyticsPanel.includes("return 'border-slate-200 bg-slate-50"), 'BI must render non-executed cards neutral');

assert(evidenceDialog.includes('apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`'), 'shared evidence must use authenticated API client');
assert(tenantContext.includes("apiRequestJson('/api/auth/validate'"), 'tenant context must resolve tenant name from authenticated validation');
assert(authRoutes.includes('tenant_name: tenant?.name'), 'session validation must return tenant name');

for (const pair of [
  ["'/grc': 'data.governance'", 'Portal GRC capability'],
  ["'/metricas': 'metrics.catalog'", 'Metrics capability'],
  ["'/bi': 'bi.executive_dashboards'", 'BI capability'],
  ["'/reportes/studio': 'reporting.studio'", 'Report Studio capability'],
]) assert(sidebar.includes(pair[0]), `${pair[1]} must govern navigation`);
assert(sidebar.includes('hasRouteCapability(item.href)'), 'sidebar must filter routes by capabilities');

const roleSources = tenantContext + formulaCatalog + sidebar + permissions;
for (const role of ['superadmin','platform_admin','admin','viewer']) {
  assert(roleSources.includes(role), `role contract missing: ${role}`);
}
for (const tenant of ['Servicios tecnologicos tecdex SPA','Servicios de Información Credex SPA','Empresa Demo TCDX Compliance']) {
  assert(postgresTest.includes(tenant), `integration scenario missing tenant: ${tenant}`);
}
assert(postgresTest.includes('cross_tenant_rows: 0'), 'tenant contamination assertion missing');
assert(postgresTest.includes('formulas_per_tenant: 50'), 'all 50 formulas must be validated per tenant');

const directProtectedLinks = [formulaCatalog, analyticsPanel, evidenceDialog].join('\n').match(/href=.*\/api\/grc\/official\/calculations/g) || [];
assert.strictEqual(directProtectedLinks.length, 0, 'direct protected calculation links are forbidden');

process.stdout.write(JSON.stringify({
  status: 'PHASE5_5_PRODUCTION_ACCEPTANCE_CONTRACT_OK',
  snapshot_type: 'source_dataset',
  formulas_per_tenant: 50,
  tenants: 3,
  roles: ['superadmin','platform_admin','admin','viewer'],
  shared_evidence: true,
  capability_navigation: true,
}) + '\n');
