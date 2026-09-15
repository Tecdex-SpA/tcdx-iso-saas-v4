const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const diagnosticRoutes = read('src/routes/diagnostic.routes.js');
const diagnosticService = read('src/services/diagnostic.service.js');
const isoExpressDiagnostic = read('src/services/isoExpressDiagnostic.service.js');
const controlsRoutes = read('src/routes/controls.routes.js');
const dashboardControlsRoutes = read('src/routes/dashboard-controls.routes.js');
const documentIntegrationsRoutes = read('src/routes/document-integrations.routes.js');
const evidencesRoutes = read('src/routes/evidences.routes.js');
const evidenceLibraryService = read('src/services/evidenceLibrary.service.js');
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
assert.match(controlsRoutes, /UPDATE tenant_controls/);
assert.match(controlsRoutes, /recordControlSoAAssessment\(\{[\s\S]*endpoint: 'PUT \/api\/controls\/:id'/);
const putControlSection = controlsRoutes.slice(
  controlsRoutes.indexOf("router.put('/:id'"),
  controlsRoutes.indexOf('router._private')
);
assert.doesNotMatch(putControlSection, /legacyResult/);
assert.doesNotMatch(putControlSection, /legacy_control_id/);
assert.doesNotMatch(putControlSection, /legacy_control_updated_without_tenant_control_identity/);
assert.doesNotMatch(putControlSection, /compatibility_endpoint/);
assert.doesNotMatch(putControlSection, /UPDATE\s+controls\b/);
assert.match(controlsRoutes, /function normalizeWorkbenchHealthProjection/);
assert.match(controlsRoutes, /score === null/);
assert.match(controlsRoutes, /veh\.standard_code = \$3/);
assert.doesNotMatch(controlsRoutes, /row\.score\s*[<>]=?\s*80/);
assert.doesNotMatch(controlsRoutes, /row\.health_score/);
assert.doesNotMatch(controlsRoutes, /tc\.health_status AS tenant_health_status[\s\S]{0,500}derived_health_status/);

assert.match(dashboardControlsRoutes, /operational_controls AS/);
assert.match(dashboardControlsRoutes, /FROM operational_controls oc[\s\S]*LEFT JOIN latest_health lh/);
assert.match(dashboardControlsRoutes, /COALESCE\(oc\.tenant_status, 'pendiente'\) AS status/);
assert.doesNotMatch(dashboardControlsRoutes, /FROM latest_health lh[\s\S]{0,250}INNER JOIN tenant_controls/);

assert.match(evidencesRoutes, /async function cleanupUploadedEvidenceFile/);
assert.match(evidencesRoutes, /await cleanupUploadedEvidenceFile\(req\.file\)[\s\S]*tenant_id es obligatorio/);
assert.match(evidencesRoutes, /await cleanupUploadedEvidenceFile\(req\.file\)[\s\S]*No autorizado para este tenant/);
assert.match(evidencesRoutes, /catch \(err\) \{[\s\S]*await cleanupUploadedEvidenceFile\(req\.file\)/);

const manualUploadFilesSection = evidenceLibraryService.slice(
  evidenceLibraryService.indexOf('async function manualUploadFiles'),
  evidenceLibraryService.indexOf('async function manualUploadZip')
);
const manualUploadZipSection = evidenceLibraryService.slice(
  evidenceLibraryService.indexOf('async function manualUploadZip'),
  evidenceLibraryService.indexOf('function defaultSourceActions')
);
assert.doesNotMatch(manualUploadFilesSection, /ensureManualUploadSource|touchDocumentSourceSync|tenant_document_sources/);
assert.doesNotMatch(manualUploadZipSection, /ensureManualUploadSource|touchDocumentSourceSync|tenant_document_sources/);
assert.match(manualUploadFilesSection, /sourceId:\s*null/);
assert.match(manualUploadZipSection, /sourceId:\s*null/);
assert.match(evidenceLibraryService, /provider\s*=\s*'manual_upload'|MANUAL_UPLOAD_PROVIDER/);
assert.match(evidenceLibraryService, /cleanupWrittenManualUploadFile/);
assert.match(documentIntegrationsRoutes, /async function tableExists/);
assert.match(documentIntegrationsRoutes, /const hasDocumentSources = await tableExists\('tenant_document_sources'\)/);
assert.match(documentIntegrationsRoutes, /function pathInside/);
assert.match(documentIntegrationsRoutes, /function tenantManualUploadRoot/);
assert.match(documentIntegrationsRoutes, /doc\.provider === 'manual_upload' && !pathInside\(tenantManualUploadRoot\(tenantId\), resolvedLocalPath\)/);
assert.match(documentIntegrationsRoutes, /DOCUMENT_STORAGE_PATH_INVALID/);

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
