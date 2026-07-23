#!/usr/bin/env node
const fs = require('fs');
const { execFileSync } = require('child_process');

const files = {
  migration: 'database/migrations/20260722_phase1_grc_core.sql',
  operationalMigration: 'database/migrations/20260723_phase1r_operational_closeout.sql',
  service: 'backend/src/services/grc/grc.service.js',
  bootstrap: 'backend/src/services/grc/grcBootstrap.service.js',
  rules: 'backend/src/services/grc/grcRules.js',
  route: 'backend/src/routes/grc.routes.js',
  rbac: 'backend/src/middleware/rbac.middleware.js',
  app: 'backend/src/app.js',
  panel: 'frontend/src/components/grc/GrcPhase1Panel.tsx',
  e2e: 'frontend/tests/e2e/phase1-grc.spec.ts',
  approvals: 'backend/src/services/grc/grcApprovalRules.js',
  adapters: 'backend/src/services/grc/grcRuntimeAdapters.js',
  scheduler: 'backend/src/services/grc/grcSchedulerRules.js',
  schedulerRunner: 'backend/src/services/grc/grcSchedulerRunner.js',
  exporter: 'backend/src/services/grc/grcExport.service.js',
  observability: 'backend/src/services/grc/grcObservability.js',
  postgresIntegration: 'backend/src/services/grc/grcPostgres.integration.test.js',
};

const requiredTables = [
  'grc_workflow_definitions', 'grc_workflow_versions', 'grc_workflow_states',
  'grc_workflow_transitions', 'grc_workflow_instances', 'grc_workflow_history',
  'grc_workflow_approvals', 'grc_workflow_automation_rules', 'grc_workflow_automation_runs',
  'grc_evidence_requests', 'grc_evidence_schedules', 'grc_evidence_submissions',
  'grc_evidence_versions', 'grc_evidence_reviews', 'grc_evidence_links',
  'grc_evidence_quality_scores', 'grc_readiness_rules', 'grc_readiness_snapshots',
  'grc_readiness_results', 'grc_frameworks', 'grc_framework_versions',
  'grc_framework_requirements', 'grc_requirement_control_mappings', 'grc_mapping_reviews',
  'grc_audit_universe_entities', 'grc_audit_annual_plans', 'grc_audit_programs',
  'grc_audit_team_members', 'grc_audit_conflicts', 'grc_audit_sample_plans',
  'grc_audit_workpapers', 'grc_audit_interviews', 'grc_audit_supervisor_reviews',
  'grc_audit_reports', 'grc_audit_followups',
  'grc_scheduler_runs', 'grc_escalation_policies', 'grc_escalation_events', 'grc_exports',
  'grc_tenant_configurations', 'grc_bootstrap_runs',
];

const requiredPermissions = [
  'workflow.read', 'workflow.manage', 'workflow.transition',
  'evidence.request.read', 'evidence.request.manage', 'evidence.review',
  'readiness.read', 'readiness.generate', 'framework.read', 'framework.manage',
  'audit.plan.read', 'audit.plan.manage', 'audit.workpaper.manage', 'audit.review',
  'audit.report.generate', 'grc.scheduler.run', 'grc.escalation.manage', 'grc.export.generate',
];

const requiredRoutes = [
  '/meta', '/summary', '/workflows', '/workflow-instances', '/evidence/requests',
  '/readiness/latest', '/readiness/snapshots', '/frameworks', '/mappings',
  '/audits/workspace', '/audits/annual-plans', '/audits/workpapers', '/automation/jobs',
  '/scheduler/run', '/escalations/policies', '/exports/:domain', '/runtime/:entityType/:id',
  '/audits/workpapers/:id/reviews', '/observability',
  '/bootstrap/status', '/bootstrap', '/bootstrap/validate',
  '/workflows/validate', '/workflows/:id', '/workflows/:id/draft', '/workflows/:id/archive',
  '/evidence/requests/:id', '/evidence/requests/:id/submissions',
  '/evidence/submissions/:id/versions', '/evidence/:id/links',
  '/framework-requirements', '/mappings/:id/reviews',
  '/audits/:id/operations', '/audits/:id/team', '/audits/:id/conflicts',
  '/audits/conflicts/:id/resolve', '/audits/:id/programs', '/audits/:id/samples',
  '/audits/universe', '/audits/:id/interviews', '/audits/:id/evidence-links',
  '/audits/:id/followups', '/audits/:id/close',
];

const requiredUi = {
  'frontend/src/app/dashboard/page.tsx': 'mode="dashboard"',
  'frontend/src/app/evidencias/page.tsx': 'mode="evidence"',
  'frontend/src/app/auditorias/page.tsx': 'mode="audit"',
  'frontend/src/app/controles/page.tsx': 'mode="framework"',
  'frontend/src/app/configuracion/page.tsx': 'mode="workflow"',
};

const findings = [];
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) findings.push({ category: 'missing_file', detail: `${name}:${file}` });
}

const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const migration = `${read(files.migration)}\n${read(files.operationalMigration)}`;
const route = read(files.route);
const service = read(files.service);
const app = read(files.app);
const rbac = read(files.rbac);
const adminSaasModuleRoute = read('backend/src/routes/admin-saas.routes.js');

for (const column of ['enabled_by', 'disabled_by']) {
  if (!new RegExp(`INSERT INTO tenant_module_settings[\\s\\S]*?${column}[\\s\\S]*?ON CONFLICT`, 'm').test(adminSaasModuleRoute)) {
    findings.push({ category: 'admin_saas_module_upsert', detail: `missing ${column}` });
  }
}

for (const table of requiredTables) {
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, 'i').test(migration)) {
    findings.push({ category: 'missing_table', detail: table });
  }
  if (!new RegExp(`\\b${table}\\b`).test(service + migration)) {
    findings.push({ category: 'unused_table', detail: table });
  }
}
for (const permission of requiredPermissions) {
  if (!migration.includes(`'${permission}'`)) findings.push({ category: 'missing_permission', detail: permission });
}
for (const routePath of requiredRoutes) {
  if (!route.includes(`'${routePath}'`)) findings.push({ category: 'missing_route', detail: routePath });
}
if (!rbac.includes("prefix: '/api/grc'")) findings.push({ category: 'missing_rbac', detail: '/api/grc' });
if (!app.includes("app.use('/api/grc', grcRoutes)")) findings.push({ category: 'missing_mount', detail: '/api/grc' });
if (!migration.includes("'grc_phase1_core'") || !migration.includes('default_enabled') || !migration.includes('FALSE')) {
  findings.push({ category: 'feature_flag', detail: 'grc_phase1_core must be deny-by-default' });
}
if (!migration.includes('trg_grc_readiness_snapshot_immutable') || !migration.includes('trg_grc_published_workflow_immutable')) {
  findings.push({ category: 'immutability', detail: 'published workflows/readiness snapshots' });
}
if (!service.includes('tenant_id = $1::uuid') || !route.includes('tenantIdOf')) {
  findings.push({ category: 'tenant_scope', detail: 'explicit tenant scope missing' });
}
if (!service.includes('audit_event_log') || !service.includes('asyncJobs.createJob')) {
  findings.push({ category: 'integration', detail: 'existing audit/job infrastructure not reused' });
}
for (const [file, marker] of Object.entries(requiredUi)) {
  if (!read(file).includes(marker)) findings.push({ category: 'view_integration', detail: `${file}:${marker}` });
}

const phase1Files = [...Object.values(files), ...Object.keys(requiredUi),
  'scripts/phase1/check-phase1-migration.sh', 'scripts/phase1/check-phase1-security.js',
  'scripts/phase1/bootstrap-tenant-grc.js', 'scripts/phase1/seed-phase1-qa.js',
  'scripts/phase1/cleanup-phase1-qa.js', 'scripts/phase1/run-phase1-runtime-local.js',
  '.github/workflows/ci.yml', '.github/workflows/phase1-runtime-qa.yml'].filter(fs.existsSync);
const forbidden = [
  [/continue-on-error/, 'continue-on-error'], [/\|\|\s*true/, '|| true'],
  [/\.skip\s*\(/, 'test.skip'], [/\.fixme\s*\(/, 'test.fixme'],
  [/\bTODO\b/, 'TODO'], [/\bFIXME\b/, 'FIXME'],
];
for (const file of phase1Files) {
  const content = read(file);
  for (const [pattern, label] of forbidden) {
    if (pattern.test(content)) findings.push({ category: 'forbidden_pattern', detail: `${file}:${label}` });
  }
}

for (const file of [files.rules, files.service, files.route, files.approvals, files.adapters,
  files.scheduler, files.schedulerRunner, files.exporter, files.observability, files.bootstrap,
  files.postgresIntegration]) {
  if (!fs.existsSync(file)) continue;
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch {
    findings.push({ category: 'syntax', detail: file });
  }
}

const countsByCategory = findings.reduce((counts, finding) => {
  counts[finding.category] = (counts[finding.category] || 0) + 1;
  return counts;
}, {});
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const report = {
  status: findings.length ? 'FAILED' : 'VERIFIED_LOCAL_CONTRACTS',
  phaseStatus: 'open_until_vm_verification',
  checkedAt: new Date().toISOString(),
  analyzedSha: sha,
  findingsCount: findings.length,
  countsByCategory,
  requiredTables: requiredTables.length,
  requiredPermissions: requiredPermissions.length,
  requiredRoutes: requiredRoutes.length,
  integratedViews: Object.keys(requiredUi),
  findings,
};
fs.mkdirSync('artifacts/fase-1', { recursive: true });
fs.writeFileSync('artifacts/fase-1/phase1-contracts-check.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Phase 1 contracts: ${report.status} findings=${findings.length} sha=${sha}`);
if (findings.length) process.exit(1);
