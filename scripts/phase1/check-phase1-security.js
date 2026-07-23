#!/usr/bin/env node
const fs = require('fs');
const { execFileSync } = require('child_process');

const mode = process.argv[2];
if (!['permissions', 'tenant'].includes(mode)) {
  console.error('Usage: check-phase1-security.js permissions|tenant');
  process.exit(1);
}

const read = file => fs.readFileSync(file, 'utf8');
const route = read('backend/src/routes/grc.routes.js');
const service = read('backend/src/services/grc/grc.service.js');
const adapters = read('backend/src/services/grc/grcRuntimeAdapters.js');
const migration = read('database/migrations/20260722_phase1_grc_core.sql');
const findings = [];

if (mode === 'permissions') {
  const required = [
    'workflow.read', 'workflow.manage', 'workflow.transition', 'evidence.request.read',
    'evidence.request.manage', 'evidence.review', 'readiness.read', 'readiness.generate',
    'framework.read', 'framework.manage', 'audit.plan.read', 'audit.plan.manage',
    'audit.workpaper.manage', 'audit.review', 'audit.report.generate',
    'grc.scheduler.run', 'grc.escalation.manage', 'grc.export.generate',
  ];
  required.forEach(permission => {
    if (!migration.includes(`'${permission}'`)) findings.push(`missing_permission:${permission}`);
  });
  const protectedMarkers = [
    "authorized(req, 'workflow", "authorized(req, 'evidence", "authorized(req, 'readiness",
    "authorized(req, 'framework", "authorized(req, 'audit", "authorized(req, 'grc.scheduler.run'",
    "authorized(req, 'grc.escalation.manage'", "authorized(req, 'grc.export.generate'",
  ];
  protectedMarkers.forEach(marker => {
    if (!route.includes(marker)) findings.push(`missing_route_authority:${marker}`);
  });
  if (!service.includes('user_has_permission($1::uuid, $2::text)')) findings.push('missing_backend_permission_authority');
  if (!service.includes('row.required_permission')) findings.push('missing_transition_permission_authority');
  if (!route.includes('service.assertModuleEnabled(context.tenantId)')) findings.push('missing_feature_flag_authority');
}

if (mode === 'tenant') {
  if (!route.includes('req.resolvedTenantId || req.user?.tenant_id')) findings.push('resolved_tenant_not_authoritative');
  if (!route.includes('service.assertModuleEnabled(context.tenantId)')) findings.push('feature_flag_not_tenant_scoped');
  const adapterQueries = [...adapters.matchAll(/query:\s*'([^']+)'/g)].map(match => match[1]);
  if (adapterQueries.length !== 8) findings.push(`adapter_count:${adapterQueries.length}`);
  adapterQueries.forEach((query, index) => {
    if (!query.includes('tenant_id = $1::uuid') && !query.includes('a.tenant_id = $1::uuid')) findings.push(`adapter_without_tenant:${index}`);
  });
  const requiredScopedTables = [
    'grc_workflow_instances', 'grc_workflow_approvals', 'grc_scheduler_runs',
    'grc_escalation_policies', 'grc_escalation_events', 'grc_exports',
    'grc_audit_workpapers', 'grc_audit_supervisor_reviews',
  ];
  requiredScopedTables.forEach(table => {
    const expressions = service.split('\n').filter(line => line.includes(table));
    if (!expressions.length) findings.push(`unused_scoped_table:${table}`);
  });
  if (!service.includes("WHERE tenant_id = $1::uuid AND id = $2::uuid")) findings.push('missing_id_plus_tenant_predicate');
  if (!(service + adapters).includes("WHERE tenant_id = $1::uuid AND entity_type = $2")) findings.push('missing_entity_plus_tenant_predicate');
}

const report = {
  status: findings.length ? 'FAILED' : `VERIFIED_LOCAL_${mode.toUpperCase()}`,
  checkedAt: new Date().toISOString(),
  analyzedSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  mode,
  findingsCount: findings.length,
  findings,
};
fs.mkdirSync('artifacts/fase-1', { recursive: true });
fs.writeFileSync(`artifacts/fase-1/phase1-${mode}-check.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Phase 1 ${mode}: ${report.status} findings=${findings.length}`);
if (findings.length) process.exit(1);
