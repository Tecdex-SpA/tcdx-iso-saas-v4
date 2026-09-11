#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const RUNTIME_DIRS = [
  'backend/src/routes',
  'backend/src/controllers',
  'backend/src/services',
  'backend/src/utils',
];

const CHECK_MIGRATION_FILE = 'database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql';

const FORBIDDEN_RUNTIME_FUNCTIONS = ['normalize_status_for_audits'];

const FORBIDDEN_MIGRATION_REFERENCES = [
  { token: 'control_health_scores', reason: 'control Health authority must remain F5_5_CONTROL_EFFECTIVENESS metric snapshots' },
  { token: 'KPI-HLT', reason: 'KPI-HLT is not the per-control Health authority' },
  { token: 'tenant_controls notes', reason: 'tenant_controls.notes is legacy compatibility, not a fresh runtime contract' },
];

const REQUIRED_RELATIONS = [
  { name: 'tenant_controls', type: 'table', criticality: 'critical', surface: 'controls/initialize-controls', columns: ['tenant_id', 'control_id', 'tenant_standard_id', 'operation_id', 'status', 'score', 'health_status', 'applicability', 'priority', 'metadata', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'tenant_standards', type: 'table', criticality: 'critical', surface: 'tenant standards', columns: ['tenant_id', 'standard_code', 'is_active', 'lifecycle_status', 'initialized_at', 'contracted_at', 'activated_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'metric_calculation_policies', type: 'table', criticality: 'critical', surface: 'health/canonical projection', columns: ['metric_key', 'formula_code', 'status', 'version_number', 'published_at', 'created_at', 'metadata'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'metric_snapshots', type: 'table', criticality: 'critical', surface: 'health/canonical projection', columns: ['metric_code', 'snapshot_payload', 'effective_at', 'published_at', 'created_at', 'snapshot_status'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'tenant_nonconformities', type: 'table', criticality: 'critical', surface: 'dashboard/nonconformities/health', columns: ['tenant_id', 'tenant_control_id', 'control_id', 'status', 'resolved_at', 'created_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'notifications', type: 'table', criticality: 'critical', surface: 'notifications', columns: ['tenant_id', 'type', 'title', 'description', 'href', 'level', 'dedupe_key', 'is_read', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'document_index', type: 'table', criticality: 'critical', surface: 'documents/action plans/evidence/AI context', columns: ['tenant_id', 'source_id', 'provider', 'provider_file_id', 'provider_version_id', 'file_name', 'mime_type', 'file_extension', 'file_url', 'web_view_url', 'size_bytes', 'checksum', 'content_hash', 'file_hash', 'relative_path', 'local_storage_path', 'modified_at', 'indexed_at', 'last_seen_at', 'status', 'metadata_json', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'tenant_document_index_exclusions', type: 'table', criticality: 'important', surface: 'evidence/document exclusions', columns: ['tenant_id', 'provider', 'source_id', 'document_index_id', 'provider_file_id', 'exclusion_scope', 'reason', 'notes', 'is_active', 'metadata_json', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'report_types', type: 'table', criticality: 'critical', surface: 'reports', columns: ['code', 'name', 'description', 'category', 'default_format', 'template_key', 'is_active', 'sort_order', 'metadata', 'created_at', 'updated_at'], privileges: ['SELECT'] },
  { name: 'report_access_rules', type: 'table', criticality: 'critical', surface: 'reports/access', columns: ['report_type_code', 'role_code', 'can_view', 'can_generate', 'can_schedule', 'created_at'], privileges: ['SELECT'] },
  { name: 'report_exports', type: 'table', criticality: 'critical', surface: 'reports/exports', columns: ['tenant_id', 'requested_by', 'report_type_code', 'report_title', 'report_format', 'status', 'file_url', 'payload_json', 'metadata', 'generated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_catalog_sync_status', type: 'table', criticality: 'important', surface: 'ISO Express/readiness', columns: ['standard_code', 'version_code', 'sync_target', 'sync_status', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'iso_express_assessments', type: 'table', criticality: 'critical', surface: 'ISO Express Diagnostic', columns: ['tenant_id', 'standard_code', 'version_code', 'assessment_type', 'assessment_status', 'requested_by', 'readiness_score', 'readiness_level', 'summary_json', 'input_json', 'result_json', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_express_assessment_items', type: 'table', criticality: 'critical', surface: 'ISO Express Diagnostic', columns: ['assessment_id', 'tenant_id', 'standard_code', 'version_code', 'iso_control_id', 'control_code', 'control_title', 'clause_code', 'catalog_control_id', 'tenant_control_id', 'item_result_json', 'created_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_express_assessment_gaps', type: 'table', criticality: 'critical', surface: 'ISO Express Diagnostic', columns: ['assessment_id', 'tenant_id', 'standard_code', 'version_code', 'control_code', 'gap_type', 'severity', 'title', 'description', 'recommendation', 'metadata', 'created_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_express_assessment_answers', type: 'table', criticality: 'critical', surface: 'ISO Express Diagnostic', columns: ['assessment_id', 'tenant_id', 'question_code', 'question_text', 'answer_value', 'answer_score', 'notes', 'created_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_express_assessment_audit_log', type: 'table', criticality: 'critical', surface: 'ISO Express Diagnostic', columns: ['assessment_id', 'tenant_id', 'action', 'actor_user_id', 'new_data', 'metadata', 'created_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_operational_suggestions', type: 'table', criticality: 'critical', surface: 'operational recommendations', columns: ['tenant_id', 'standard_code', 'operation_id', 'tenant_control_id', 'source_module', 'source_entity_type', 'source_entity_id', 'source_reason', 'suggestion_type', 'target_record_type', 'title', 'description', 'rationale', 'priority', 'status', 'dedupe_key', 'suggested_owner', 'suggested_due_date', 'payload_json', 'source_trace_json', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'iso_operational_suggestion_audit_log', type: 'table', criticality: 'critical', surface: 'operational recommendations/audit', columns: ['suggestion_id', 'tenant_id', 'action', 'actor_user_id', 'old_data', 'new_data', 'metadata', 'created_at'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'iso_recommended_action_conversions', type: 'table', criticality: 'critical', surface: 'recommended action conversions', columns: ['tenant_id', 'recommendation_id', 'target_type', 'target_table', 'target_id', 'conversion_status', 'source_payload', 'result_payload', 'converted_by', 'converted_at', 'created_at', 'updated_at'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'v_iso_control_effective_health', type: 'view', criticality: 'critical', surface: 'controls/health/AI context', columns: ['tenant_id', 'tenant_control_id', 'catalog_control_id', 'iso', 'standard_code', 'clause', 'category', 'control_description', 'effective_health_score', 'effective_health_status', 'evidence_count', 'official_evidence_count', 'open_findings_count', 'open_nonconformities_count', 'overdue_action_plans_count', 'is_in_active_operational_scope', 'health_trace_json'], privileges: ['SELECT'] },
  { name: 'v_iso_control_catalog_coverage', type: 'view', criticality: 'critical', surface: 'ISO Express/risk matrix/mapping', columns: ['standard_code', 'version_code', 'total_iso_controls', 'unlinked_iso_controls', 'linked_catalog_controls', 'coverage_pct', 'equivalent_links', 'partial_links', 'related_links', 'transition_links', 'needs_review_count'], privileges: ['SELECT'] },
  { name: 'v_iso_express_tenant_standard_readiness', type: 'view', criticality: 'critical', surface: 'ISO Express Diagnostic', columns: ['tenant_id', 'standard_code', 'version_code', 'display_name', 'certifiable', 'publication_status', 'tenant_standard_active', 'catalog_coverage_pct', 'sync_status', 'recommended_assessment_type', 'warning_text'], privileges: ['SELECT'] },
  { name: 'v_health_root_causes_by_tenant', type: 'view', criticality: 'critical', surface: 'health/root causes', columns: ['tenant_id', 'tenant_name', 'total_controls', 'avg_health_score', 'healthy_controls', 'attention_controls', 'deteriorated_controls', 'critical_controls', 'controls_with_evidence_gap', 'controls_with_compliance_gap', 'main_cause_json', 'causes_json', 'executive_recommendation'], privileges: ['SELECT'] },
  { name: 'v_iso_operational_suggestions_queue', type: 'view', criticality: 'critical', surface: 'operational recommendations', columns: ['id', 'tenant_id', 'standard_code', 'priority', 'status', 'suggestion_type', 'target_record_type', 'payload_json', 'source_trace_json', 'resolved_operation_id', 'control_category', 'payload', 'source_trace', 'created_at'], privileges: ['SELECT'] },
  { name: 'v_iso_operational_suggestions_summary', type: 'view', criticality: 'critical', surface: 'operational recommendations', columns: ['tenant_id', 'standard_code', 'total_suggestions', 'pending_count', 'approved_count', 'rejected_count', 'critical_count', 'high_count'], privileges: ['SELECT'] },
];

const REQUIRED_FUNCTIONS = [
  { signature: 'log_admin_audit_event(uuid,text,uuid,text,uuid,jsonb)', privileges: ['EXECUTE'], surface: 'admin-saas audit trail' },
  { signature: 'get_user_effective_permissions(uuid)', privileges: ['EXECUTE'], surface: 'RBAC' },
  { signature: 'user_has_permission(uuid,text)', privileges: ['EXECUTE'], surface: 'RBAC' },
];

const SURFACE_PROBES = [
  { name: 'HEALTH_ROOT_CAUSES_QUERY', sql: 'SELECT * FROM public.v_health_root_causes_by_tenant ORDER BY avg_health_score ASC LIMIT 0' },
  { name: 'ISO_CONTROL_EFFECTIVE_HEALTH_AI_CONTEXT_QUERY', sql: 'SELECT tenant_id, tenant_control_id, category, effective_health_score FROM public.v_iso_control_effective_health LIMIT 0' },
  { name: 'ISO_EXPRESS_READINESS_QUERY', sql: 'SELECT tenant_id, standard_code, version_code, catalog_coverage_pct FROM public.v_iso_express_tenant_standard_readiness LIMIT 0' },
  { name: 'ISO_OPERATIONAL_SUGGESTIONS_QUERY', sql: 'SELECT id, tenant_id, priority, suggestion_type, target_record_type FROM public.v_iso_operational_suggestions_queue LIMIT 0' },
  { name: 'REPORT_TYPES_ACCESS_QUERY', sql: "SELECT rt.code, rar.role_code, rar.can_generate FROM report_types rt JOIN report_access_rules rar ON rar.report_type_code = rt.code WHERE rt.is_active IS TRUE AND rar.can_view IS TRUE LIMIT 0" },
  { name: 'REPORT_EXPORTS_QUERY', sql: 'SELECT re.id, re.tenant_id, rt.name FROM report_exports re LEFT JOIN report_types rt ON rt.code = re.report_type_code LIMIT 0' },
  { name: 'DOCUMENT_INDEX_ACTION_PLAN_QUERY', sql: 'SELECT d.id, d.tenant_id, d.provider, d.file_name FROM document_index d LIMIT 0' },
  { name: 'NOTIFICATIONS_QUERY', sql: 'SELECT id, tenant_id, title, level, is_read FROM notifications LIMIT 0' },
  { name: 'INITIALIZE_CONTROLS_INSERT_SHAPE', sql: "SELECT tenant_id, control_id, tenant_standard_id, operation_id, status, score, health_status, applicability, priority, metadata, created_at, updated_at FROM tenant_controls LIMIT 0" },
  { name: 'CANONICAL_HEALTH_POLICY_ORDER_SHAPE', sql: 'SELECT metadata, version_number, published_at, created_at FROM metric_calculation_policies LIMIT 0' },
  { name: 'RECOMMENDED_ACTION_CONVERSIONS_QUERY', sql: 'SELECT c.recommendation_id, c.target_type, c.target_id, s.created_record_type, s.created_record_id FROM iso_recommended_action_conversions c JOIN iso_operational_suggestions s ON s.tenant_id = c.tenant_id AND s.id = c.recommendation_id LIMIT 0' },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '__mocks__'].includes(entry.name)) walk(full, files);
    } else if (/\.js$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function extractRuntimeSqlDependencies() {
  const files = RUNTIME_DIRS.flatMap((relative) => walk(path.join(root, relative)));
  const relationRefs = new Map();
  const functionRefs = new Map();
  const relationPattern = /\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const functionPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  const sqlKeywords = new Set(['select', 'count', 'sum', 'avg', 'min', 'max', 'coalesce', 'lower', 'upper', 'nullif', 'jsonb_build_object', 'jsonb_build_array', 'now', 'case', 'round', 'greatest', 'least']);

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = relationPattern.exec(text))) {
      const name = match[1];
      if (/^(SELECT|WHERE|SET|VALUES)$/i.test(name)) continue;
      const current = relationRefs.get(name) || { name, files: new Set(), count: 0 };
      current.files.add(path.relative(root, file));
      current.count += 1;
      relationRefs.set(name, current);
    }
    while ((match = functionPattern.exec(text))) {
      const name = match[1].toLowerCase();
      if (sqlKeywords.has(name)) continue;
      if (!['log_admin_audit_event', 'get_user_effective_permissions', 'user_has_permission', 'normalize_status_for_audits'].includes(name)) continue;
      const current = functionRefs.get(name) || { name, files: new Set(), count: 0 };
      current.files.add(path.relative(root, file));
      current.count += 1;
      functionRefs.set(name, current);
    }
  }

  return {
    filesScanned: files.length,
    relationRefs: [...relationRefs.values()].map((item) => ({ ...item, files: [...item.files].sort() })).sort((a, b) => a.name.localeCompare(b.name)),
    functionRefs: [...functionRefs.values()].map((item) => ({ ...item, files: [...item.files].sort() })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for fresh baseline runtime dependency check');
  }
  return value;
}

async function relationExists(client, name) {
  const result = await client.query('SELECT to_regclass($1) AS relation', [`public.${name}`]);
  return Boolean(result.rows[0]?.relation);
}

async function relationColumns(client, name) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [name]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function checkRelations(client) {
  const issues = [];
  for (const relation of REQUIRED_RELATIONS) {
    if (!(await relationExists(client, relation.name))) {
      issues.push(`${relation.type} missing: ${relation.name} (${relation.surface})`);
      continue;
    }
    const columns = await relationColumns(client, relation.name);
    for (const column of relation.columns || []) {
      if (!columns.has(column)) issues.push(`column missing: ${relation.name}.${column} (${relation.surface})`);
    }
    for (const privilege of relation.privileges || []) {
      const grant = await client.query('SELECT has_table_privilege($1, $2, $3) AS ok', ['tcdx_backend_runtime', relation.name, privilege]);
      if (grant.rows[0]?.ok !== true) issues.push(`grant missing: ${privilege} ON ${relation.name} TO tcdx_backend_runtime`);
    }
  }
  return issues;
}

async function checkFunctions(client) {
  const issues = [];
  for (const fn of REQUIRED_FUNCTIONS) {
    const exists = await client.query('SELECT to_regprocedure($1) AS procedure', [fn.signature]);
    if (!exists.rows[0]?.procedure) {
      issues.push(`function missing: ${fn.signature} (${fn.surface})`);
      continue;
    }
    for (const privilege of fn.privileges) {
      const grant = await client.query('SELECT has_function_privilege($1, $2, $3) AS ok', ['tcdx_backend_runtime', fn.signature, privilege]);
      if (grant.rows[0]?.ok !== true) issues.push(`grant missing: ${privilege} ON FUNCTION ${fn.signature} TO tcdx_backend_runtime`);
    }
  }
  return issues;
}

async function checkSurfaceProbes(client) {
  const issues = [];
  for (const probe of SURFACE_PROBES) {
    try {
      await client.query(probe.sql);
      process.stdout.write(`${probe.name}=PASS\n`);
    } catch (error) {
      issues.push(`${probe.name}=FAIL ${error.code || error.message}`);
    }
  }
  return issues;
}

function printScan(scan) {
  process.stdout.write(`RUNTIME_SQL_FILES_SCANNED=${scan.filesScanned}\n`);
  process.stdout.write(`RUNTIME_SQL_RELATIONS_DISCOVERED=${scan.relationRefs.length}\n`);
  process.stdout.write(`RUNTIME_SQL_FUNCTIONS_DISCOVERED=${scan.functionRefs.length}\n`);
  process.stdout.write(`RUNTIME_SQL_REQUIRED_RELATIONS=${REQUIRED_RELATIONS.length}\n`);
  process.stdout.write(`RUNTIME_SQL_REQUIRED_FUNCTIONS=${REQUIRED_FUNCTIONS.length}\n`);
  process.stdout.write('RUNTIME_SQL_SCANNER_LIMITATION=regex_inventory_not_full_sql_parser\n');
}

function checkForbiddenRuntimeReferences(scan) {
  const issues = [];
  for (const fn of FORBIDDEN_RUNTIME_FUNCTIONS) {
    const refs = scan.functionRefs.filter((item) => item.name === fn);
    for (const ref of refs) {
      issues.push(`dependency eliminated but still referenced: ${fn} (${ref.files.join(', ')})`);
    }
  }
  return issues;
}

function checkForbiddenMigrationReferences() {
  const issues = [];
  const migrationPath = path.join(root, CHECK_MIGRATION_FILE);
  if (!fs.existsSync(migrationPath)) {
    issues.push(`migration missing for forbidden-reference check: ${CHECK_MIGRATION_FILE}`);
    return issues;
  }

  const text = fs.readFileSync(migrationPath, 'utf8');
  for (const item of FORBIDDEN_MIGRATION_REFERENCES) {
    if (item.token === 'tenant_controls notes') {
      if (/ALTER\s+TABLE\s+tenant_controls[\s\S]*ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?notes\b/i.test(text)) {
        issues.push(`forbidden migration reference: ${item.token} (${item.reason})`);
      }
      continue;
    }
    if (text.includes(item.token)) {
      issues.push(`forbidden migration reference: ${item.token} (${item.reason})`);
    }
  }
  return issues;
}

async function expectConstraintFailure(client, name, sql, params = []) {
  await client.query(`SAVEPOINT ${name}`);
  try {
    await client.query(sql, params);
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    return `${name}=FAIL expected integrity violation`;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    if (error.code === '23503' || error.code === '23514') return null;
    return `${name}=FAIL unexpected ${error.code || error.message}`;
  }
}

async function checkMutationProbes(client) {
  const issues = [];
  const synthetic = 'fresh_runtime_dependency_probe';
  await client.query('BEGIN');
  try {
    const tenantA = await client.query(
      `INSERT INTO tenants (name, slug, service_status, settings)
       VALUES ($1, $2, 'active', $3::jsonb)
       RETURNING id`,
      ['Fresh Runtime Probe A', `${synthetic}_a_${Date.now()}`, JSON.stringify({ probe: synthetic })]
    );
    const tenantB = await client.query(
      `INSERT INTO tenants (name, slug, service_status, settings)
       VALUES ($1, $2, 'active', $3::jsonb)
       RETURNING id`,
      ['Fresh Runtime Probe B', `${synthetic}_b_${Date.now()}`, JSON.stringify({ probe: synthetic })]
    );
    const tenantId = tenantA.rows[0].id;
    const otherTenantId = tenantB.rows[0].id;

    const user = await client.query(
      `INSERT INTO users (tenant_id, email, name, role, status)
       VALUES ($1::uuid, $2, 'Runtime Probe User', 'admin', 'active')
       RETURNING id`,
      [tenantId, `${synthetic}_${Date.now()}@invalid.local`]
    );
    const userId = user.rows[0].id;

    const standardCode = `PROBE_${Date.now()}`;
    await client.query(
      `INSERT INTO standards (standard_code, family, display_name, version_label, is_active, metadata)
       VALUES ($1, 'probe', 'Runtime Probe Standard', 'v1', TRUE, $2::jsonb)`,
      [standardCode, JSON.stringify({ probe: synthetic })]
    );
    await client.query(
      `INSERT INTO iso_standards (standard_code, display_name, family, description, is_active, metadata)
       VALUES ($1, 'Runtime Probe Standard', 'probe', 'Runtime probe standard', TRUE, $2::jsonb)`,
      [standardCode, JSON.stringify({ probe: synthetic })]
    );
    await client.query(
      `INSERT INTO iso_standard_versions (
         standard_id, standard_code, version_code, product_standard_code, display_name,
         publication_status, certifiable, source_policy, is_active, status, metadata
       )
       SELECT id, standard_code, 'v1', $1, 'Runtime Probe Standard v1',
         'published', FALSE, 'runtime_probe', TRUE, 'approved_for_loader', $2::jsonb
       FROM iso_standards
       WHERE standard_code = $1`,
      [standardCode, JSON.stringify({ probe: synthetic })]
    );
    const catalog = await client.query(
      `INSERT INTO controls_catalog (code, clause, category, title, description, iso, source_type, is_active, metadata)
       VALUES ('PR-1', '1', 'probe', 'Runtime Probe Control', 'Runtime probe control', $1, 'runtime_probe', TRUE, $2::jsonb)
       RETURNING id`,
      [standardCode, JSON.stringify({ probe: synthetic })]
    );
    const catalogControlId = catalog.rows[0].id;
    const tenantStandard = await client.query(
      `INSERT INTO tenant_standards (tenant_id, standard_code, catalog_mode, is_active, lifecycle_status, metadata)
       VALUES ($1::uuid, $2, 'generic', TRUE, 'active', $3::jsonb)
       RETURNING id`,
      [tenantId, standardCode, JSON.stringify({ probe: synthetic })]
    );
    const tenantStandardId = tenantStandard.rows[0].id;
    const control = await client.query(
      `INSERT INTO tenant_controls (
         tenant_id, control_id, tenant_standard_id, operation_id, status, score,
         health_status, applicability, priority, metadata
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, 'pendiente', NULL, 'sin_datos', 'aplicable', 'media', $4::jsonb)
       RETURNING id`,
      [tenantId, catalogControlId, tenantStandardId, JSON.stringify({ probe: synthetic })]
    );
    const tenantControlId = control.rows[0].id;

    const otherAssessment = await client.query(
      `INSERT INTO iso_express_assessments (tenant_id, standard_code, version_code, assessment_type, assessment_status, requested_by, summary_json, input_json, result_json)
       VALUES ($1::uuid, $2, 'v1', 'express', 'calculated', NULL, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      [otherTenantId, standardCode]
    );

    await client.query('SET LOCAL ROLE tcdx_backend_runtime');

    const notification = await client.query(
      `INSERT INTO notifications (tenant_id, type, title, description, href, level, dedupe_key, metadata)
       VALUES ($1::uuid, 'system', 'Probe notification', 'Shape validation', '/probe', 'info', $2, '{}'::jsonb)
       ON CONFLICT (tenant_id, dedupe_key) DO UPDATE
       SET is_read = EXCLUDED.is_read, updated_at = now()
       RETURNING id`,
      [tenantId, `${synthetic}_notification`]
    );
    await client.query('UPDATE notifications SET is_read = TRUE WHERE tenant_id = $1::uuid AND id = $2::uuid', [tenantId, notification.rows[0].id]);

    const doc = await client.query(
      `INSERT INTO document_index (
         tenant_id, provider, provider_file_id, provider_version_id, file_name, mime_type,
         file_extension, file_url, web_view_url, size_bytes, checksum, content_hash,
         file_hash, relative_path, local_storage_path, status, metadata_json
       )
       VALUES ($1::uuid, 'internal', $2, 'v1', 'probe.pdf', 'application/pdf',
         'pdf', '/probe.pdf', '/probe', 1, 'checksum', 'content_hash',
         'file_hash', 'probe.pdf', 'probe.pdf', 'indexed', '{}'::jsonb)
       RETURNING id`,
      [tenantId, `${synthetic}_file`]
    );
    await client.query(
      `INSERT INTO tenant_document_index_exclusions (
         tenant_id, provider, document_index_id, provider_file_id, exclusion_scope, reason, notes, metadata_json
       )
       VALUES ($1::uuid, 'internal', $2::uuid, $3, 'item', 'probe', 'probe', '{}'::jsonb)
       RETURNING id`,
      [tenantId, doc.rows[0].id, `${synthetic}_file`]
    );

    await client.query(
      `INSERT INTO report_exports (tenant_id, requested_by, report_type_code, report_title, report_format, status, file_url, payload_json, metadata)
       VALUES ($1::uuid, $2::uuid, 'executive_iso_status', 'Probe report', 'pdf', 'generated', '/probe.pdf', '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      [tenantId, userId]
    );

    const assessment = await client.query(
      `INSERT INTO iso_express_assessments (
         tenant_id, standard_code, version_code, assessment_type, assessment_status,
         requested_by, readiness_score, readiness_level, summary_json, input_json, result_json
       )
       VALUES ($1::uuid, $2, 'v1', 'express', 'calculated', $3::uuid, 75, 'medium', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      [tenantId, standardCode, userId]
    );
    const assessmentId = assessment.rows[0].id;
    await client.query(
      `INSERT INTO iso_express_assessment_items (
         assessment_id, tenant_id, standard_code, version_code, iso_control_id, control_code,
         control_title, clause_code, catalog_control_id, tenant_control_id, item_result_json
       )
       VALUES ($1::uuid, $2::uuid, $3, 'v1', NULL, 'PR-1', 'Runtime Probe Control', '1', $4::uuid, $5::uuid, '{}'::jsonb)`,
      [assessmentId, tenantId, standardCode, catalogControlId, tenantControlId]
    );
    await client.query(
      `INSERT INTO iso_express_assessment_gaps (
         assessment_id, tenant_id, standard_code, version_code, control_code, gap_type, severity,
         title, description, recommendation, metadata
       )
       VALUES ($1::uuid, $2::uuid, $3, 'v1', 'PR-1', 'evidence', 'medium',
         'Probe gap', 'Probe gap description', 'Probe recommendation', '{}'::jsonb)`,
      [assessmentId, tenantId, standardCode]
    );
    await client.query(
      `INSERT INTO iso_express_assessment_answers (
         assessment_id, tenant_id, question_code, question_text, answer_value, answer_score, notes
       )
       VALUES ($1::uuid, $2::uuid, 'Q1', 'Question', 'yes', 1, 'probe')`,
      [assessmentId, tenantId]
    );
    await client.query(
      `INSERT INTO iso_express_assessment_audit_log (
         assessment_id, tenant_id, action, actor_user_id, new_data, metadata
       )
       VALUES ($1::uuid, $2::uuid, 'created', $3::uuid, '{}'::jsonb, '{}'::jsonb)`,
      [assessmentId, tenantId, userId]
    );

    const crossTenantIssue = await expectConstraintFailure(
      client,
      'iso_express_same_tenant_fk_probe',
      `INSERT INTO iso_express_assessment_items (
         assessment_id, tenant_id, standard_code, version_code, control_code, control_title, item_result_json
       )
       VALUES ($1::uuid, $2::uuid, $3, 'v1', 'PR-X', 'Cross tenant probe', '{}'::jsonb)`,
      [otherAssessment.rows[0].id, tenantId, standardCode]
    );
    if (crossTenantIssue) issues.push(crossTenantIssue);

    const suggestion = await client.query(
      `INSERT INTO iso_operational_suggestions (
         tenant_id, standard_code, operation_id, tenant_control_id, source_module,
         source_entity_type, source_entity_id, source_reason, suggestion_type,
         target_record_type, title, description, rationale, priority, status,
         dedupe_key, payload_json, source_trace_json, created_by
       )
       VALUES ($1::uuid, $2, NULL, $3::uuid, 'probe', 'control', $3::uuid, 'shape',
         'operational', 'action_plan', 'Probe suggestion', 'Probe description',
         'Probe rationale', 'media', 'pending', $4, '{}'::jsonb, '{}'::jsonb, $5::uuid)
       RETURNING id`,
      [tenantId, standardCode, tenantControlId, `${synthetic}_suggestion`, userId]
    );
    const suggestionId = suggestion.rows[0].id;
    await client.query(
      `INSERT INTO iso_operational_suggestion_audit_log (
         suggestion_id, tenant_id, action, actor_user_id, old_data, new_data, metadata
       )
       VALUES ($1::uuid, $2::uuid, 'generated', $3::uuid, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
      [suggestionId, tenantId, userId]
    );
    await client.query(
      `INSERT INTO iso_recommended_action_conversions (
         tenant_id, recommendation_id, target_type, target_table, target_id,
         conversion_status, source_payload, result_payload, converted_by
       )
       VALUES ($1::uuid, $2::uuid, 'action_plan', 'action_plans', gen_random_uuid(),
         'converted', '{}'::jsonb, '{}'::jsonb, $3::uuid)`,
      [tenantId, suggestionId, userId]
    );

    const reportAccess = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM report_types rt
       JOIN report_access_rules rar ON rar.report_type_code = rt.code
       WHERE rt.code = 'executive_iso_status'
         AND rar.role_code = 'admin'
         AND rar.can_view IS TRUE
         AND rar.can_generate IS TRUE`
    );
    if (Number(reportAccess.rows[0]?.total || 0) < 1) {
      issues.push('REPORT_ACCESS_RULES_SEED=FAIL executive_iso_status admin access missing');
    }

    await client.query('SELECT tenant_id, tenant_control_id, category, effective_health_score FROM v_iso_control_effective_health WHERE tenant_id = $1::uuid LIMIT 5', [tenantId]);
    await client.query('SELECT * FROM v_iso_operational_suggestions_queue WHERE tenant_id = $1::uuid LIMIT 5', [tenantId]);

    process.stdout.write('FRESH_RUNTIME_MUTATION_PROBES=PASS\n');
  } catch (error) {
    const detail = [
      error.code || error.message,
      error.table ? `table=${error.table}` : null,
      error.column ? `column=${error.column}` : null,
      error.constraint ? `constraint=${error.constraint}` : null,
    ].filter(Boolean).join(' ');
    issues.push(`FRESH_RUNTIME_MUTATION_PROBES=FAIL ${detail}`);
  } finally {
    await client.query('ROLLBACK');
  }
  return issues;
}

async function main() {
  const scan = extractRuntimeSqlDependencies();
  printScan(scan);
  const staticIssues = [
    ...checkForbiddenRuntimeReferences(scan),
    ...checkForbiddenMigrationReferences(),
  ];

  if (process.argv.includes('--scan-only')) {
    if (staticIssues.length) {
      process.stdout.write(`FRESH_BASELINE_RUNTIME_DEPENDENCY_ISSUES=${staticIssues.length}\n`);
      for (const issue of staticIssues) process.stdout.write(`- ${issue}\n`);
      process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_SCAN=FAIL\n');
      process.exitCode = 1;
      return;
    }
    process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_SCAN=PASS\n');
    return;
  }

  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const issues = [
      ...staticIssues,
      ...(await checkRelations(client)),
      ...(await checkFunctions(client)),
      ...(await checkSurfaceProbes(client)),
    ];

    if (process.argv.includes('--mutation-probes')) {
      issues.push(...(await checkMutationProbes(client)));
    } else {
      process.stdout.write('FRESH_RUNTIME_MUTATION_PROBES=NOT_EXECUTED\n');
    }

    if (issues.length) {
      process.stdout.write(`FRESH_BASELINE_RUNTIME_DEPENDENCY_ISSUES=${issues.length}\n`);
      for (const issue of issues) process.stdout.write(`- ${issue}\n`);
      process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_CHECK=FAIL\n');
      process.exitCode = 1;
      return;
    }

    process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_ISSUES=0\n');
    process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_CHECK=PASS\n');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error)}\n`);
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_FUNCTIONS,
  REQUIRED_RELATIONS,
  SURFACE_PROBES,
  checkForbiddenMigrationReferences,
  checkForbiddenRuntimeReferences,
  extractRuntimeSqlDependencies,
};
