#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  listImportDefinitions,
} = require('../../backend/src/services/imports/importDefinitions');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

const required = [
  'backend/src/routes/imports.routes.js',
  'backend/src/services/imports/importDefinitions.js',
  'backend/src/services/imports/excelWorkbook.js',
  'backend/src/services/imports/excelWorkbook.test.js',
  'backend/src/services/imports/universalImport.service.js',
  'database/migrations/20260730_universal_excel_import.sql',
  'frontend/src/components/phase3/UniversalImportCenter.tsx',
  'frontend/src/app/importaciones/page.tsx',
  'frontend/src/app/operaciones-grc/importar/page.tsx',
  'docs/product/universal-import-domain-inventory.md',
  'docs/product/universal-excel-import-engine.md',
  'docs/operations/excel-import-runbook.md',
  'docs/qa/excel-import-validation-report.md',
];
const missing = required.filter(relative => !exists(relative));
if (missing.length) throw new Error(`Universal import missing files: ${missing.join(', ')}`);

const routes = read('backend/src/routes/imports.routes.js');
const workbook = read('backend/src/services/imports/excelWorkbook.js');
const service = read('backend/src/services/imports/universalImport.service.js');
const migration = read('database/migrations/20260730_universal_excel_import.sql');
const frontend = read('frontend/src/components/phase3/UniversalImportCenter.tsx');
const app = read('backend/src/app.js');
const runner = read('scripts/phase3/apply-phase3-migration.js');

const routeMarkers = [
  "router.get('/definitions'",
  "router.get('/definitions/:entityType'",
  "router.get('/templates/:entityType.xlsx'",
  "router.get('/catalogs/:entityType.xlsx'",
  "router.post('/preview'",
  "router.get('/history'",
  "router.get('/:batchId'",
  "router.post('/:batchId/confirm'",
  "router.post('/:batchId/rollback'",
  "router.get('/:batchId/errors.xlsx'",
];
const missingRoutes = routeMarkers.filter(marker => !routes.includes(marker));
if (missingRoutes.length) throw new Error(`Universal import route gaps: ${missingRoutes.join(', ')}`);

const securityMarkers = [
  'IMPORT_MACRO_REJECTED',
  'IMPORT_EXTERNAL_LINK_REJECTED',
  'IMPORT_FORMULA_REJECTED',
  'IMPORT_FORMULA_INJECTION_REJECTED',
  'IMPORT_ZIP_BOMB_REJECTED',
  'maximumUncompressedSize',
  'checkCRC32: true',
  'neutralizeSpreadsheetText',
  'multer.memoryStorage()',
  'operations.import',
  'assertModuleEnabled',
  'request_id',
];
const securitySource = `${routes}\n${workbook}\n${service}`;
const missingSecurity = securityMarkers.filter(marker => !securitySource.includes(marker));
if (missingSecurity.length) {
  throw new Error(`Universal import security gaps: ${missingSecurity.join(', ')}`);
}

for (const table of [
  'grc_import_template_versions',
  'grc_import_files',
  'grc_import_cell_errors',
  'grc_import_audit_events',
]) {
  if (!migration.includes(table)) throw new Error(`Universal import migration missing ${table}`);
}
if (!runner.includes('20260730_universal_excel_import')) {
  throw new Error('Universal import migration is not integrated into privileged runner');
}
if (!app.includes("app.use('/api/imports', importsRoutes)")) {
  throw new Error('Universal import API is not mounted');
}

const uiMarkers = [
  'Descargar plantilla Excel',
  'Descargar catálogos',
  'Previsualizar y validar',
  'Descargar archivo con errores',
  'Confirmar importación',
  'Revertir este lote',
  'Historial de lotes',
  'No se aceptan .xls, .xlsm ni .xlsb',
];
const missingUi = uiMarkers.filter(marker => !frontend.includes(marker));
if (missingUi.length) throw new Error(`Universal import UI gaps: ${missingUi.join(', ')}`);

const definitions = listImportDefinitions();
const operational = definitions.filter(item => item.availability === 'importable_now');
if (definitions.length < 30 || operational.length < 10) {
  throw new Error(`Insufficient domain inventory: total=${definitions.length} operational=${operational.length}`);
}
for (const wave of [1, 2, 3]) {
  if (!definitions.some(item => item.wave === wave)) {
    throw new Error(`Universal import inventory missing wave ${wave}`);
  }
}
for (const definition of operational) {
  if (!definition.fields.length || !definition.naturalKey.length) {
    throw new Error(`Operational definition incomplete: ${definition.entityType}`);
  }
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /postgres(?:ql)?:\/\/[^/\s:@]+:[^@\s/]+@/i,
];
const debt = /\b(?:TODO|FIXME|HACK)\b/;
for (const relative of required.filter(item => /\.(js|ts|tsx|sql|md)$/.test(item))) {
  const source = read(relative);
  if (debt.test(source)) throw new Error(`Debt marker in ${relative}`);
  if (secretPatterns.some(pattern => pattern.test(source))) {
    throw new Error(`Possible secret in ${relative}`);
  }
}

process.stdout.write(
  `Universal Excel import contracts: VERIFIED definitions=${definitions.length} `
  + `operational=${operational.length} routes=${routeMarkers.length}\n`
);
