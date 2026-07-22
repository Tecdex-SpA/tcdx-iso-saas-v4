#!/usr/bin/env node
const fs = require('fs');

const matrix = JSON.parse(fs.readFileSync('config/security/authorization-matrix.json', 'utf8'));
const exceptions = JSON.parse(fs.readFileSync('config/phase0/contract-exceptions.json', 'utf8')).exceptions || [];
function hasExactTenantException(item) {
  return exceptions.some(exception =>
    exception.method === item.method
    && exception.endpoint === item.endpoint
    && exception.sourceFile === item.sourceFile
    && exception.findingCategory === 'endpoint_without_tenant_scope_signal'
  );
}
const failures = (matrix.authorization || []).filter(item =>
  item.publicEndpoint !== 'true'
  && item.roleSignal !== 'true'
  && !(item.authSignal === 'true' && item.tenantSignal === 'true')
  && !(item.authSignal === 'true' && hasExactTenantException(item))
);
if (failures.length) {
  for (const item of failures.slice(0, 50)) {
    console.error(`Missing permission signal: ${item.method} ${item.endpoint} (${item.sourceFile})`);
  }
  process.exit(1);
}
console.log(`phase0 permissions VERIFIED endpoints=${matrix.authorization.length} failures=0`);
