#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const targets = [
  'database/migrations/20260729_phase4_commercial_product.sql',
  'scripts/phase4/apply-phase4-migration.js',
  'scripts/phase4/check-phase4-contracts.js',
  'backend/src/services/commercial/commercialCatalog.js',
  'backend/src/services/commercial/entitlementResolver.service.js',
  'backend/src/services/commercial/commercialAdmin.service.js',
  'backend/src/middleware/commercialEntitlement.middleware.js',
  'backend/src/routes/admin-saas-commercial.routes.js',
  'frontend/src/hooks/useTenantEntitlements.ts',
  'frontend/src/components/commercial/Phase4CommercialPanel.tsx',
];
const secretPatterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/, /\bsk-[A-Za-z0-9_-]{20,}\b/, /postgres(?:ql)?:\/\/[^/\s:@]+:[^@\s/]+@/i];
const debtPattern = /\b(?:TODO|FIXME|HACK)\b/;
const fixedIdentityPattern = /70000000-0000-0000-0000-0000000007\d{2}|admin\.demo@tcdx\.local|tcdx\.local/i;
const findings = [];
for (const relative of targets) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  if (debtPattern.test(source)) findings.push(`${relative}: debt marker`);
  if (fixedIdentityPattern.test(source)) findings.push(`${relative}: fixed identity`);
  if (secretPatterns.some((pattern) => pattern.test(source))) findings.push(`${relative}: possible embedded secret`);
}
if (findings.length) throw new Error(`Phase 4 security scan failed: ${findings.join(', ')}`);
process.stdout.write(`Phase 4 security scan: VERIFIED files=${targets.length}\n`);
