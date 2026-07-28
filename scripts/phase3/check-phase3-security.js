#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const targets = [
  'backend/src/routes/phase2.routes.js',
  'backend/src/routes/phase3.routes.js',
  'backend/src/services/grc/phase2.service.js',
  'backend/src/services/grc/phase3.service.js',
  'backend/src/services/grc/phase3Rules.js',
  'frontend/src/app/portal-proveedor/page.tsx',
  'frontend/src/components/phase2/Phase2Workspace.tsx',
  'frontend/src/components/phase3/Phase3Activation.tsx',
  'frontend/src/components/phase3/UniversalImportCenter.tsx',
  'frontend/src/components/phase3/Phase3Nav.tsx',
  'frontend/src/components/phase3/Phase3Workspace.tsx',
  'frontend/src/components/phase3/phase3Api.ts',
  'database/migrations/20260729_phase3_operational_onboarding.sql',
  'database/migrations/20260730_universal_excel_import.sql',
  'backend/src/routes/imports.routes.js',
  'backend/src/services/imports/importDefinitions.js',
  'backend/src/services/imports/excelWorkbook.js',
  'backend/src/services/imports/universalImport.service.js',
  'scripts/phase3/apply-phase3-migration.js',
  'scripts/phase3/check-phase3-postgres.sh',
  'docs/product/connectors-operational-status.md',
  'tests/fixtures/phase3-master-schema.sql',
];

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /postgres(?:ql)?:\/\/[^/\s:@]+:[^@\s/]+@/i,
];
const debtPattern = /\b(?:TODO|FIXME|HACK)\b/;
const findings = [];

for (const relative of targets) {
  const absolute = path.join(root, relative);
  const source = fs.readFileSync(absolute, 'utf8');
  if (debtPattern.test(source)) findings.push(`${relative}: debt marker`);
  if (secretPatterns.some(pattern => pattern.test(source))) {
    findings.push(`${relative}: possible embedded secret`);
  }
}

if (findings.length) {
  throw new Error(`Phase 3 security scan failed: ${findings.join(', ')}`);
}

process.stdout.write(`Phase 3 security scan: VERIFIED files=${targets.length}\n`);
