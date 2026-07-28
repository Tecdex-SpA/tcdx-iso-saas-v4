#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

const requiredFiles = [
  'database/migrations/20260728_phase3_operational_grc.sql',
  'database/migrations/20260729_phase3_operational_onboarding.sql',
  'backend/src/routes/phase3.routes.js',
  'backend/src/services/grc/phase3.service.js',
  'backend/src/services/grc/phase3Rules.js',
  'backend/src/services/grc/phase3Core.test.js',
  'backend/src/services/grc/phase3Postgres.integration.test.js',
  'frontend/src/components/phase3/Phase3Workspace.tsx',
  'frontend/src/components/phase3/Phase3Activation.tsx',
  'frontend/src/components/phase3/Phase3Import.tsx',
  'frontend/src/components/phase3/Phase3Nav.tsx',
  'frontend/src/app/operaciones-grc/activacion/page.tsx',
  'frontend/src/app/operaciones-grc/importar/page.tsx',
  'scripts/phase3/check-phase3-postgres.sh',
  'docs/product/connectors-operational-status.md',
];
const missingFiles = requiredFiles.filter(relative => !exists(relative));
if (missingFiles.length) throw new Error(`Phase 3 missing files: ${missingFiles.join(', ')}`);

const routes = read('backend/src/routes/phase3.routes.js');
const service = read('backend/src/services/grc/phase3.service.js');
const migration = read('database/migrations/20260729_phase3_operational_onboarding.sql');
const workspace = read('frontend/src/components/phase3/Phase3Workspace.tsx');
const activation = read('frontend/src/components/phase3/Phase3Activation.tsx');
const imports = read('frontend/src/components/phase3/Phase3Import.tsx');
const api = read('frontend/src/components/phase3/phase3Api.ts');
const phase2Service = read('backend/src/services/grc/phase2.service.js');
const phase2Workspace = read('frontend/src/components/phase2/Phase2Workspace.tsx');

const shellRoutes = [
  'frontend/src/app/operaciones-grc/page.tsx',
  'frontend/src/app/unidades/page.tsx',
  'frontend/src/app/procesos/page.tsx',
  'frontend/src/app/servicios/page.tsx',
  'frontend/src/app/bia/page.tsx',
  'frontend/src/app/continuidad/page.tsx',
  'frontend/src/app/continuidad/pruebas/page.tsx',
  'frontend/src/app/crisis/page.tsx',
  'frontend/src/app/indicadores/page.tsx',
  'frontend/src/app/riesgo-cuantitativo/page.tsx',
  'frontend/src/app/operaciones-grc/activacion/page.tsx',
  'frontend/src/app/operaciones-grc/importar/page.tsx',
];
for (const routeFile of shellRoutes) {
  if (!exists(routeFile)
    || !/(Phase3Workspace|Phase3Activation|Phase3Import)/.test(read(routeFile))) {
    throw new Error(`Phase 3 route is not integrated with the official shell: ${routeFile}`);
  }
}
for (const [name, source] of [
  ['workspace', workspace],
  ['activation', activation],
  ['imports', imports],
]) {
  if (!source.includes('<AppLayout>')) {
    throw new Error(`Phase 3 ${name} does not render AppLayout`);
  }
}

const routeMarkers = [
  "router.get('/lookups'",
  "router.get('/summary'",
  "router.get('/readiness'",
  "router.get('/360/:entityType/:id'",
  "router.get('/templates/:entityType'",
  "router.post('/imports/preview'",
  "router.get('/imports/:id'",
  "router.post('/imports/:id/confirm'",
  "router.post('/imports/:id/rollback'",
  "router.patch('/organizations/:id'",
  "router.patch('/processes/:id'",
  "router.patch('/services/:id'",
  "router.patch('/bia/:id'",
  "router.patch('/continuity/plans/:id'",
  "router.patch('/continuity/tests/:id'",
  "router.patch('/crisis/:id'",
  "router.patch('/metrics/:id'",
  "router.patch('/quantitative-risks/:id'",
];
const missingRoutes = routeMarkers.filter(marker => !routes.includes(marker));
if (missingRoutes.length) throw new Error(`Phase 3 route gaps: ${missingRoutes.join(', ')}`);

const firstDynamic = routes.indexOf("router.post('/:entityType/:id/transitions'");
for (const marker of ['/lookups', '/summary', '/readiness', '/360/', '/templates/', '/imports/']) {
  if (routes.indexOf(marker) < 0 || routes.indexOf(marker) > firstDynamic) {
    throw new Error(`Static route is not ordered before dynamic route: ${marker}`);
  }
}

const backendMarkers = [
  'PHASE3_DUPLICATE',
  'PHASE3_UUID_INVALID',
  'safePayloadSummary',
  'activationReadiness',
  'getEntity360',
  'linked_context',
  'createImportPreview',
  'confirmImport',
  'rollbackImport',
  'PHASE3_IMPORT_CONFIRMATION_REQUIRED',
  'owner_email',
  'import_batch_id',
  'requires_human_review: true',
  'request_id: req.requestId',
];
const missingBackend = backendMarkers.filter(marker => !`${routes}\n${service}`.includes(marker));
if (missingBackend.length) throw new Error(`Phase 3 backend contract gaps: ${missingBackend.join(', ')}`);

const uiMarkers = [
  '<AppLayout>',
  'Ver detalle',
  'Ver vista 360',
  'Editar',
  'summaryLabels',
  'Phase3Glossary',
  'LookupSelect',
  'form.reset()',
  'aria-busy="true"',
  'role="alert"',
  'No hay registros para los filtros actuales',
  'Asistente de activación',
  'Datos listos para operar',
  'Previsualizar y validar',
  'Confirmar importación',
  'Revertir lote de forma segura',
  'Errores por columna',
];
const uiSource = `${workspace}\n${activation}\n${imports}`;
const missingUi = uiMarkers.filter(marker => !uiSource.includes(marker));
if (missingUi.length) throw new Error(`Phase 3 UI contract gaps: ${missingUi.join(', ')}`);

const translations = [
  'Unidades', 'Unidades sin responsable', 'Procesos críticos sin BIA',
  'Incumplimientos de RTO', 'Incumplimientos de RPO', 'Indicadores críticos',
  'No conformidades abiertas', 'Exposición anualizada',
];
const missingTranslations = translations.filter(label => !workspace.includes(label));
if (missingTranslations.length) {
  throw new Error(`Phase 3 translation gaps: ${missingTranslations.join(', ')}`);
}

if (!api.includes('normalizePhase3Payload') || !api.includes("return [key, null]")) {
  throw new Error('Phase 3 optional UUID normalization is missing');
}
const formCapture = workspace.indexOf('const form = event.currentTarget');
const submitAwait = workspace.indexOf('await phase3Mutation(config.endpoint, body)', formCapture);
const safeReset = workspace.indexOf('form.reset()', submitAwait);
const submitCatch = workspace.indexOf('} catch (cause)', safeReset);
if (formCapture < 0 || submitAwait < formCapture || safeReset < submitAwait || submitCatch < safeReset) {
  throw new Error('Phase 3 form must capture the form before await and reset only on success');
}
if (!migration.includes('grc_phase3_import_batches')
  || !migration.includes('grc_phase3_import_rows')
  || !migration.includes("'operations.import'")) {
  throw new Error('Phase 3 import migration contract is incomplete');
}
if (!phase2Service.includes('CONNECTOR_NOT_AVAILABLE')
  || !phase2Workspace.includes('No hay conectores externos habilitados')) {
  throw new Error('Connector honest-state gate is missing');
}

const frontendFiles = fs.readdirSync(path.join(root, 'frontend/src'), { recursive: true })
  .filter(file => typeof file === 'string' && /\.(ts|tsx)$/.test(file));
for (const relative of frontendFiles) {
  const source = read(path.join('frontend/src', relative));
  if (source.includes('event.currentTarget.reset()')) {
    throw new Error(`Unsafe async form reset remains in frontend/src/${relative}`);
  }
}

const scanFiles = requiredFiles.filter(relative => /\.(js|ts|tsx|sql)$/.test(relative));
const debt = scanFiles.filter(relative => /\b(TODO|FIXME|HACK)\b/.test(read(relative)));
if (debt.length) throw new Error(`Phase 3 debt marker found: ${debt.join(', ')}`);

process.stdout.write(
  `Phase 3 contracts: VERIFIED routes=${routeMarkers.length} `
  + `ui=${uiMarkers.length} files=${requiredFiles.length}\n`
);
