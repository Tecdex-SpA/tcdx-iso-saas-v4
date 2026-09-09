const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const findingsRoutes = fs.readFileSync(path.join(root, 'src/routes/findings.routes.js'), 'utf8');
const actionPlansRoutes = fs.readFileSync(path.join(root, 'src/routes/action-plans.routes.js'), 'utf8');
const evidencesRoutes = fs.readFileSync(path.join(root, 'src/routes/evidences.routes.js'), 'utf8');
const isoOperationalExecution = fs.readFileSync(path.join(root, 'src/services/isoOperationalExecution.service.js'), 'utf8');
const grcRuntimeAdapters = fs.readFileSync(path.join(root, 'src/services/grc/grcRuntimeAdapters.js'), 'utf8');
const controlsRoutes = fs.readFileSync(path.join(root, 'src/routes/controls.routes.js'), 'utf8');
const diagnosticAcceptance = fs.readFileSync(path.join(root, 'src/services/diagnosticAcceptance.service.js'), 'utf8');

assert.match(findingsRoutes, /const \{ resolveTenantControl \} = require\('\.\.\/utils\/tenantControlIdentity'\)/);
assert.match(findingsRoutes, /tenant_control_id:\s*resolvedControl\.tenant_control_id_moderno/);
assert.match(findingsRoutes, /resolvedControl\.tenant_control_id_moderno,\s*\n\s*nonconformity_id/s);
assert.doesNotMatch(findingsRoutes, /created_by:\s*getUserId\(req\.user\),\s*\n\s*tenant_control_id:\s*resolvedControl\.controls_id_legacy/);
assert.doesNotMatch(findingsRoutes, /resolvedControl\.controls_id_legacy,\s*\n\s*nonconformity_id/s);

assert.match(actionPlansRoutes, /const \{ resolveTenantControl \} = require\('\.\.\/utils\/tenantControlIdentity'\)/);
assert.match(actionPlansRoutes, /TENANT_CONTROL_ID_AMBIGUOUS/);
assert.doesNotMatch(actionPlansRoutes, /resolveSoAControlReference/);

assert.match(evidencesRoutes, /const \{ resolveTenantControl \} = require\('\.\.\/utils\/tenantControlIdentity'\)/);
assert.match(evidencesRoutes, /control_id es ambiguo para este tenant; envía tenant_control_id/);
assert.match(evidencesRoutes, /if \(!tenantControlId && catalogControlId\) \{[\s\S]*LIMIT 2[\s\S]*TENANT_CONTROL_ID_AMBIGUOUS/);
assert.doesNotMatch(evidencesRoutes, /const resolveCatalogControlId/);

assert.match(isoOperationalExecution, /tenantControl\.tenant_control_id,\s*\n\s*target\.nonconformity_id/s);
assert.match(isoOperationalExecution, /direct_tc\.id = f\.tenant_control_id/);
assert.match(isoOperationalExecution, /c\.id = f\.tenant_control_id[\s\S]*c\.tenant_id = f\.tenant_id/);
assert.match(isoOperationalExecution, /CASE WHEN count\(\*\) = 1 THEN \(array_agg\(tc\.id\)\)\[1\] ELSE NULL END AS tenant_control_id/);
assert.doesNotMatch(isoOperationalExecution, /tenantControl\.legacy_control_id,\s*\n\s*target\.nonconformity_id/s);

assert.match(controlsRoutes, /'Hallazgo generado desde Workbench de Controles[\s\S]*control\.tenant_control_id,\s*\n\s*getUserId\(req\.user\)/);
assert.doesNotMatch(controlsRoutes, /INSERT INTO findings[\s\S]{0,900}control\.controls_id_legacy \|\| control\.tenant_control_id/);
assert.doesNotMatch(controlsRoutes, /INSERT INTO action_plans[\s\S]{0,1200}control\.controls_id_legacy \|\| control\.tenant_control_id/);

assert.match(diagnosticAcceptance, /INSERT INTO findings[\s\S]*control\.tenant_control_id,\s*\n\s*\]/);
assert.doesNotMatch(diagnosticAcceptance, /resolveLegacyFindingControlId/);

assert.match(grcRuntimeAdapters, /control:\s*\{[\s\S]*query:\s*'SELECT \* FROM tenant_controls WHERE tenant_id = \$1::uuid AND id = \$2::uuid'/);

console.log('control identity route contract tests: OK');
