const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const diagnosticRoutes = read('src/routes/diagnostic.routes.js');
const diagnosticService = read('src/services/diagnostic.service.js');
const isoExpressDiagnostic = read('src/services/isoExpressDiagnostic.service.js');
const controlsRoutes = read('src/routes/controls.routes.js');
const controlCatalogLifecycle = read('src/services/controlCatalogLifecycle.service.js');
const controlsPage = fs.readFileSync(path.resolve(root, '../frontend/src/app/controles/page.tsx'), 'utf8');
const isoExpressService = require('../services/isoExpressDiagnostic.service');
const controlsRouter = require('./controls.routes');

assert.match(diagnosticService, /semanticHasTargetLabel/);
assert.match(diagnosticService, /s\.target_label' : 'NULL::text AS target_label'/);
assert.doesNotMatch(diagnosticService, /s\.target_label AS target_label/);

assert.match(diagnosticRoutes, /tenantControlId:\s*control\.id/);
assert.match(diagnosticRoutes, /isoCode:\s*current\.active_standard_code \|\| current\.iso/);
assert.doesNotMatch(diagnosticRoutes, /isoCode:\s*control\.iso/);

assert.match(isoExpressDiagnostic, /function normalizeStandardCode/);
assert.match(isoExpressDiagnostic, /iso_standard_versions/);
assert.match(isoExpressDiagnostic, /standardVersionIdentityPredicate/);
assert.doesNotMatch(isoExpressDiagnostic, /includes\(['"]27001/);
assert.doesNotMatch(isoExpressDiagnostic, /LIKE '%27001%'/);
assert.doesNotMatch(isoExpressDiagnostic, /LIKE '%9001%'/);
assert.doesNotMatch(isoExpressDiagnostic, /standard_code = 'ISO42001'/);
assert.match(isoExpressDiagnostic, /fetchActiveTenantStandardOptions/);
assert.match(isoExpressDiagnostic, /tenant_standard_active:\s*true/);
assert.match(controlCatalogLifecycle, /iso_standard_versions/);
assert.doesNotMatch(controlCatalogLifecycle, /LIKE '%27001%'/);
assert.doesNotMatch(controlCatalogLifecycle, /LIKE '%9001%'/);

assert.match(controlsRoutes, /insertActionPlan/);
assert.match(controlsRoutes, /publishControlOrchestration\(req,\s*tenant_id,\s*'nonconformity'/);
assert.match(controlsRoutes, /publishControlOrchestration\(req,\s*tenant_id,\s*'finding'/);
assert.match(controlsRoutes, /publishControlOrchestration\(req,\s*tenant_id,\s*'action'/);
assert.match(controlsRoutes, /function normalizeWorkbenchHealthProjection/);
assert.match(controlsRoutes, /score === null/);
assert.match(controlsRoutes, /veh\.standard_code = \$3/);
assert.doesNotMatch(controlsRoutes, /row\.score\s*[<>]=?\s*80/);
assert.doesNotMatch(controlsRoutes, /row\.health_score/);
assert.doesNotMatch(controlsRoutes, /tc\.health_status AS tenant_health_status[\s\S]{0,500}derived_health_status/);

assert.match(controlsPage, /nonconformity-draft/);
assert.match(controlsPage, /nonconformityAiDrafts/);
assert.match(controlsPage, /formatCompactIsoCode/);
assert.doesNotMatch(controlsPage, /27001\|9001\|42001/);
assert.match(controlsPage, /type HealthFilter = 'todos' \| 'saludable' \| 'atencion' \| 'deteriorado' \| 'sin_datos'/);
assert.match(controlsPage, /Health \{getEffectiveHealthScore\(item\) \?\? 'N\/A'\}/);

const { normalizeStandardCode } = isoExpressService._private;
assert.equal(normalizeStandardCode('ISO_27001_2022'), 'ISO270012022');
assert.equal(normalizeStandardCode(' iso/iec 42001 '), 'ISO42001');
assert.equal(normalizeStandardCode('iso-new-standard:2099'), 'ISONEWSTANDARD2099');

const { normalizeWorkbenchHealthProjection, summarizeWorkbenchHealth } = controlsRouter._private;
assert.deepEqual(
  normalizeWorkbenchHealthProjection({ effective_health_status: 'saludable', effective_health_score: null }),
  { effective_health_status: 'sin_datos', effective_health_score: null }
);
assert.deepEqual(
  normalizeWorkbenchHealthProjection({ effective_health_status: 'sin_datos', effective_health_score: 100 }),
  { effective_health_status: 'sin_datos', effective_health_score: null }
);
assert.deepEqual(
  normalizeWorkbenchHealthProjection({ effective_health_status: 'saludable', effective_health_score: 95 }),
  { effective_health_status: 'saludable', effective_health_score: 95 }
);
assert.deepEqual(
  normalizeWorkbenchHealthProjection({ effective_health_status: 'atencion', effective_health_score: 70 }),
  { effective_health_status: 'atencion', effective_health_score: 70 }
);
assert.deepEqual(
  normalizeWorkbenchHealthProjection({ effective_health_status: 'deteriorado', effective_health_score: 40 }),
  { effective_health_status: 'deteriorado', effective_health_score: 40 }
);
assert.deepEqual(
  normalizeWorkbenchHealthProjection({ effective_health_status: 'critico', effective_health_score: 10 }),
  { effective_health_status: 'critico', effective_health_score: 10 }
);

const controls = [
  { tenant_id: 'tenant-a', effective_health_status: 'saludable', effective_health_score: 95 },
  { tenant_id: 'tenant-a', effective_health_status: 'atencion', effective_health_score: 70 },
  { tenant_id: 'tenant-a', effective_health_status: 'deteriorado', effective_health_score: 40 },
  { tenant_id: 'tenant-a', effective_health_status: 'critico', effective_health_score: 10 },
  { tenant_id: 'tenant-a', effective_health_status: 'saludable', effective_health_score: null },
];
const healthSummary = summarizeWorkbenchHealth(controls);
assert.equal(healthSummary.healthy_controls, 1);
assert.equal(
  controls.filter((item) => normalizeWorkbenchHealthProjection(item).effective_health_status === 'saludable').length,
  healthSummary.healthy_controls
);
assert.equal(healthSummary.attention_controls, 1);
assert.equal(healthSummary.deteriorated_controls, 2);
assert.equal(healthSummary.unmeasured_controls, 1);
assert.equal(healthSummary.average_health_score, 53.75);
assert.equal(summarizeWorkbenchHealth([
  { tenant_id: 'tenant-b', effective_health_status: 'sin_datos', effective_health_score: null },
]).average_health_score, null);

console.log('GRC runtime repair contract tests: OK');
