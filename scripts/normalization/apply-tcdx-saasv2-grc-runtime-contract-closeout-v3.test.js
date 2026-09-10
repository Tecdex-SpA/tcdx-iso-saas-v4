#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const v1Path = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql');
const v2Path = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql');
const v3Path = path.join(root, 'database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql');

function readSql(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

const sql = {
  schema: readSql(schemaPath),
  seed: readSql(seedPath),
  v1: readSql(v1Path),
  v2: readSql(v2Path),
  v3: readSql(v3Path),
};

for (const [name, text] of Object.entries(sql)) {
  assert.doesNotMatch(text, /\btcdx_saasv2\b/i, `${name} must not reference real DB`);
  assert.doesNotMatch(text, /\btcdx\.local\b/i, `${name} must not seed tenant-specific tcdx.local logic`);
  assert.doesNotMatch(text, /\b70000000-0000-0000-0000-000000000701\b/i, `${name} must not hardcode tenant id`);
  assert.doesNotMatch(text, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, `${name} must not grant all tables`);
  assert.doesNotMatch(text, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\b/i, `${name} must not grant all functions`);
}
assert.match(sql.v3, /BEGIN;/, 'V3 migration must be transactional');
assert.match(sql.v3, /COMMIT;/, 'V3 migration must commit');
assert.match(sql.v3, /pg_try_advisory_xact_lock\(844332,\s*2026091003\)/, 'V3 migration must use own advisory lock');

function quoteList(values) {
  return values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(',');
}

function scalar(pg, query) {
  return psqlExec(pg, query).stdout.trim();
}

function assertScalar(pg, name, query, expected) {
  const actual = scalar(pg, query);
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name} PASS`);
}

function assertSql(pg, name, query) {
  psqlExec(pg, query);
  console.log(`${name} PASS`);
}

function assertSqlFails(pg, name, query, pattern = /violates foreign key constraint|divergence|permission denied/i) {
  const result = psqlExec(pg, query, { allowFailure: true });
  assert.notEqual(result.status, 0, `${name}: SQL unexpectedly succeeded`);
  assert.match(result.stderr, pattern, `${name}: unexpected failure: ${result.stderr}`);
  console.log(`${name} PASS`);
}

function assertRelations(pg, name, relationNames) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM unnest(ARRAY[${quoteList(relationNames)}]) AS required(name)
    WHERE to_regclass('public.' || required.name) IS NOT NULL;
    `,
    relationNames.length
  );
}

function assertColumns(pg, name, tableName, columns) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='${tableName}'
      AND column_name = ANY(ARRAY[${quoteList(columns)}]);
    `,
    columns.length
  );
}

const phase1Objects = [
  'grc_workflow_definitions',
  'grc_workflow_versions',
  'grc_workflow_states',
  'grc_workflow_transitions',
  'grc_workflow_transition_roles',
  'grc_workflow_instances',
  'grc_workflow_history',
  'grc_workflow_approvals',
  'grc_workflow_comments',
  'grc_workflow_attachments',
  'grc_workflow_automation_rules',
  'grc_workflow_automation_runs',
  'grc_scheduler_runs',
  'grc_escalation_policies',
  'grc_escalation_events',
  'grc_exports',
  'grc_evidence_requests',
  'grc_evidence_schedules',
  'grc_evidence_requirements',
  'grc_evidence_submissions',
  'grc_evidence_versions',
  'grc_evidence_reviews',
  'grc_evidence_links',
  'grc_evidence_quality_scores',
  'grc_readiness_rules',
  'grc_readiness_snapshots',
  'grc_readiness_results',
  'grc_readiness_findings',
  'grc_frameworks',
  'grc_framework_versions',
  'grc_framework_requirements',
  'grc_requirement_control_mappings',
  'grc_mapping_reviews',
  'grc_audit_universe_entities',
  'grc_audit_annual_plans',
  'grc_audit_plan_items',
  'grc_audit_programs',
  'grc_audit_team_members',
  'grc_audit_conflicts',
  'grc_audit_sample_plans',
  'grc_audit_sample_items',
  'grc_audit_workpapers',
  'grc_audit_interviews',
  'grc_audit_evidence_links',
  'grc_audit_supervisor_reviews',
  'grc_audit_reports',
  'grc_audit_followups',
  'grc_tenant_configurations',
  'grc_bootstrap_runs',
];

const phase2Objects = [
  'grc_phase2_relations',
  'grc_domain_events',
  'grc_rule_executions',
  'grc_operational_alerts',
  'grc_metric_observations',
  'grc_obligations',
  'grc_control_assurance',
  'grc_effectiveness_verifications',
  'grc_suppliers',
  'grc_supplier_history',
  'grc_supplier_services',
  'grc_supplier_contracts',
  'grc_questionnaire_templates',
  'grc_questionnaire_versions',
  'grc_questionnaire_sections',
  'grc_questionnaire_questions',
  'grc_supplier_assessments',
  'grc_supplier_answers',
  'grc_supplier_assessment_history',
  'grc_supplier_portal_invitations',
  'grc_supplier_portal_sessions',
  'grc_supplier_portal_evidence',
  'grc_supplier_exit_checks',
  'privacy_processing_activities',
  'privacy_processing_versions',
  'privacy_processors',
  'privacy_dpias',
  'privacy_dpia_risks',
  'privacy_data_subject_requests',
  'privacy_consents',
  'privacy_breaches',
  'grc_incidents',
  'grc_incident_history',
  'grc_incident_timeline',
  'grc_incident_impacts',
  'grc_incident_notifications',
  'grc_incident_root_causes',
  'grc_incident_postmortems',
  'grc_connector_definitions',
  'grc_connector_instances',
  'grc_connector_runs',
  'grc_external_records',
  'grc_connector_mappings',
  'grc_connector_dead_letters',
];

const phase3Objects = [
  'grc_organizational_units',
  'grc_operational_services',
  'grc_operational_dependencies',
  'grc_bia_assessments',
  'grc_bia_impacts',
  'grc_continuity_plans',
  'grc_continuity_tests',
  'grc_crisis_activations',
  'grc_crisis_log',
  'grc_metric_definitions',
  'grc_metric_measurements',
  'grc_quantitative_risk_assessments',
  'grc_phase3_state_history',
  'grc_phase3_readiness_impacts',
  'grc_phase3_import_batches',
  'grc_phase3_import_rows',
];

function validateContract(pg, { includeFreshGate = false } = {}) {
  if (includeFreshGate) {
    assertRelations(pg, 'BASELINE_FRESH_GRC_RUNTIME_CONTRACT', [
      'saas_modules',
      'tenant_module_settings',
      ...phase1Objects,
      ...phase2Objects,
      ...phase3Objects,
    ]);
  }
  assertColumns(pg, 'SAAS_MODULES_RUNTIME_COLUMNS', 'saas_modules', [
    'module_key',
    'display_name',
    'description',
    'default_enabled',
    'is_system',
    'is_active',
    'sort_order',
    'status',
    'updated_at',
  ]);
  assertColumns(pg, 'TENANT_MODULE_SETTINGS_RUNTIME_COLUMNS', 'tenant_module_settings', [
    'tenant_id',
    'module_key',
    'enabled',
    'is_enabled',
    'enabled_at',
    'disabled_at',
    'enabled_by',
    'disabled_by',
    'notes',
    'metadata',
    'updated_at',
  ]);
  assertSql(pg, 'TENANT_MODULE_SETTINGS_COMPATIBILITY', `
    INSERT INTO tenants (id, slug, name) VALUES
      ('10000000-0000-0000-0000-000000000001', 'v3-test-a', 'V3 Test A'),
      ('10000000-0000-0000-0000-000000000002', 'v3-test-b', 'V3 Test B')
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO tenant_module_settings (tenant_id, module_key, enabled)
    VALUES ('10000000-0000-0000-0000-000000000001', 'grc_phase1_core', true)
    ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled;
    DO $$
    DECLARE synced boolean;
    BEGIN
      SELECT is_enabled INTO synced
      FROM tenant_module_settings
      WHERE tenant_id='10000000-0000-0000-0000-000000000001'::uuid
        AND module_key='grc_phase1_core';
      IF synced IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'enabled did not synchronize to is_enabled';
      END IF;
    END $$;
    UPDATE tenant_module_settings
    SET is_enabled=false
    WHERE tenant_id='10000000-0000-0000-0000-000000000001'::uuid
      AND module_key='grc_phase1_core';
    DO $$
    DECLARE synced boolean;
    BEGIN
      SELECT enabled INTO synced
      FROM tenant_module_settings
      WHERE tenant_id='10000000-0000-0000-0000-000000000001'::uuid
        AND module_key='grc_phase1_core';
      IF synced IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'is_enabled did not synchronize to enabled';
      END IF;
    END $$;
  `);
  assertSqlFails(pg, 'TENANT_MODULE_SETTINGS_DIVERGENCE_BLOCK', `
    INSERT INTO tenant_module_settings (tenant_id, module_key, enabled, is_enabled)
    VALUES ('10000000-0000-0000-0000-000000000001', 'grc_phase2_integrated', true, false);
  `, /divergence/i);
  assertRelations(pg, 'GRC_PHASE1_REQUIRED_OBJECTS', phase1Objects);
  assertRelations(pg, 'GRC_PHASE2_REQUIRED_OBJECTS', phase2Objects);
  assertRelations(pg, 'GRC_PHASE3_REQUIRED_OBJECTS', phase3Objects);
  assertColumns(pg, 'GRC_CONNECTOR_RUNTIME_COLUMNS', 'grc_connector_instances', [
    'connector_version',
    'connected_by_user_id',
    'scopes',
    'metadata_json',
    'execution_mode',
    'credential_envelope',
    'oauth_state_hash',
    'token_expires_at',
    'refresh_after',
    'cursor',
    'schedule',
    'webhook_config',
    'rate_limit_config',
    'retry_config',
    'health_status',
    'last_error_code',
    'next_sync_at',
    'last_sync_at',
    'disconnected_at',
    'config',
    'created_by',
  ]);
  assertColumns(pg, 'GRC_SCHEDULER_RUNTIME_COLUMNS', 'tenant_module_settings', ['is_enabled']);
  assertColumns(pg, 'GRC_SCHEDULER_RUNTIME_COLUMNS_CONNECTORS', 'grc_connector_instances', [
    'status',
    'schedule',
    'next_sync_at',
    'health_status',
    'last_error_code',
  ]);
  assertSql(pg, 'GRC_PHASE1_SCHEDULER_DISCOVERY', `
    SELECT tms.tenant_id
    FROM tenant_module_settings tms
    JOIN saas_modules sm ON sm.module_key = tms.module_key
    WHERE tms.module_key = 'grc_phase1_core' AND tms.is_enabled = TRUE AND sm.is_active = TRUE
    ORDER BY tms.tenant_id;
  `);
  assertSql(pg, 'GRC_PHASE2_SCHEDULER_DISCOVERY', `
    SELECT i.id,i.tenant_id
    FROM grc_connector_instances i
    JOIN tenant_module_settings ms
      ON ms.tenant_id=i.tenant_id AND ms.module_key='grc_phase2_integrated' AND ms.is_enabled=TRUE
    WHERE i.status='connected'
      AND COALESCE((i.schedule->>'enabled')::boolean,FALSE)=TRUE
      AND i.next_sync_at IS NOT NULL AND i.next_sync_at<=now()
    ORDER BY i.next_sync_at
    LIMIT 10;
  `);
  assertScalar(pg, 'GRC_RUNTIME_GRANTS', `
    SELECT (
      has_table_privilege('tcdx_backend_runtime', 'tenant_module_settings', 'SELECT')
      AND has_table_privilege('tcdx_backend_runtime', 'tenant_module_settings', 'UPDATE')
      AND has_table_privilege('tcdx_backend_runtime', 'grc_connector_instances', 'SELECT')
      AND has_table_privilege('tcdx_backend_runtime', 'grc_connector_instances', 'UPDATE')
      AND has_table_privilege('tcdx_backend_runtime', 'grc_workflow_definitions', 'INSERT')
      AND has_table_privilege('tcdx_backend_runtime', 'grc_phase3_import_batches', 'INSERT')
    )::text;
  `, 'true');
  assertScalar(pg, 'GRC_RUNTIME_NO_EXCESSIVE_PRIVILEGES', `
    SELECT (
      NOT has_table_privilege('tcdx_backend_runtime', 'saas_modules', 'INSERT')
      AND NOT has_table_privilege('tcdx_backend_runtime', 'saas_modules', 'DELETE')
      AND NOT has_function_privilege('tcdx_backend_runtime', 'reconcile_tenant_module_settings_enabled()', 'EXECUTE')
    )::text;
  `, 'true');
  assertScalar(pg, 'GRC_CRITICAL_TENANT_AWARE_FKS', `
    SELECT count(*)::int
    FROM pg_constraint
    WHERE conname = ANY(ARRAY[
      'fk_v3_grc_connector_runs_integration_same_tenant',
      'fk_v3_grc_external_records_integration_same_tenant',
      'fk_v3_grc_dead_letters_integration_same_tenant'
    ]);
  `, '3');
  assertSql(pg, 'GRC_CROSS_TENANT_RELATION_SETUP', `
    INSERT INTO grc_connector_definitions (id, provider, version, display_name, capabilities, supported_scopes, default_mapping, status)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      'v3_provider',
      '1.0.0',
      'V3 Provider',
      '{}'::jsonb,
      '[]'::jsonb,
      '{}'::jsonb,
      'active'
    )
    ON CONFLICT (provider, version) DO NOTHING;
    INSERT INTO grc_connector_instances (
      id, tenant_id, definition_id, provider, connector_version, status, display_name, schedule, next_sync_at
    ) VALUES (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'v3_provider',
      '1.0.0',
      'connected',
      'V3 Connector',
      '{"enabled":true}'::jsonb,
      now()
    )
    ON CONFLICT DO NOTHING;
  `);
  assertSqlFails(pg, 'GRC_CROSS_TENANT_RELATION_BLOCK', `
    INSERT INTO grc_connector_runs (tenant_id, integration_id, run_type, status, idempotency_key)
    VALUES (
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      'sync',
      'started',
      'cross-tenant-should-fail'
    );
  `);
  assertScalar(pg, 'GRC_ZERO_FIXED_TENANT_SEED', `
    SELECT (
      NOT EXISTS (SELECT 1 FROM tenants WHERE slug='tcdx.local')
      AND NOT EXISTS (SELECT 1 FROM tenants WHERE id='70000000-0000-0000-0000-000000000701'::uuid)
      AND NOT EXISTS (SELECT 1 FROM tenant_module_settings WHERE tenant_id='70000000-0000-0000-0000-000000000701'::uuid)
    )::text;
  `, 'true');
  assertScalar(pg, 'GRC_ZERO_DEMO_DATA', `
    SELECT (
      NOT EXISTS (SELECT 1 FROM grc_organizational_units WHERE provenance->>'source'='demo')
      AND NOT EXISTS (SELECT 1 FROM grc_operational_services WHERE provenance->>'source'='demo')
      AND NOT EXISTS (SELECT 1 FROM grc_bia_assessments WHERE provenance->>'source'='demo')
      AND NOT EXISTS (SELECT 1 FROM grc_continuity_plans WHERE provenance->>'source'='demo')
      AND NOT EXISTS (SELECT 1 FROM grc_metric_definitions WHERE provenance->>'source'='demo')
      AND NOT EXISTS (SELECT 1 FROM grc_quantitative_risk_assessments WHERE provenance->>'source'='demo')
    )::text;
  `, 'true');
  psqlExec(pg, "TRUNCATE tenants CASCADE;");
  assertScalar(pg, 'FINAL_TENANTS_ZERO', 'SELECT count(*)::int FROM tenants;', '0');
}

function signature(pg) {
  return scalar(pg, `
    WITH cols AS (
      SELECT table_schema, table_name, column_name, data_type, is_nullable, COALESCE(column_default, '') AS column_default
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name = ANY(ARRAY[${quoteList([
          'saas_modules',
          'tenant_module_settings',
          ...phase1Objects,
          ...phase2Objects,
          ...phase3Objects,
        ])}])
    ),
    cons AS (
      SELECT conrelid::regclass::text AS rel, conname, contype
      FROM pg_constraint
      WHERE connamespace='public'::regnamespace
        AND conrelid::regclass::text = ANY(ARRAY[${quoteList([
          'tenant_module_settings',
          'grc_connector_instances',
          'grc_connector_runs',
          'grc_external_records',
          'grc_connector_dead_letters',
        ])}])
    ),
    idx AS (
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname='public'
        AND tablename = ANY(ARRAY['tenant_module_settings','grc_connector_instances','grc_connector_runs','grc_phase3_import_batches'])
    ),
    priv AS (
      SELECT table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee='tcdx_backend_runtime'
        AND table_schema='public'
        AND table_name = ANY(ARRAY['tenant_module_settings','grc_connector_instances','grc_workflow_definitions','grc_phase3_import_batches'])
    )
    SELECT md5(string_agg(item, E'\\n' ORDER BY item))
    FROM (
      SELECT 'c|' || table_schema || '.' || table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || column_default AS item FROM cols
      UNION ALL
      SELECT 'k|' || rel || '.' || conname || ':' || contype::text FROM cons
      UNION ALL
      SELECT 'i|' || tablename || '.' || indexname FROM idx
      UNION ALL
      SELECT 'p|' || table_name || ':' || privilege_type FROM priv
    ) s;
  `);
}

let freshPg;
let upgradePg;
try {
  freshPg = createPostgres();
  psqlExec(freshPg, sql.schema);
  psqlExec(freshPg, sql.seed);
  validateContract(freshPg, { includeFreshGate: true });
  const freshSig = signature(freshPg);

  upgradePg = createPostgres();
  psqlExec(upgradePg, sql.schema);
  psqlExec(upgradePg, sql.seed);
  psqlExec(upgradePg, sql.v1);
  psqlExec(upgradePg, sql.v2);
  psqlExec(upgradePg, sql.v3);
  console.log('V3_APPLY_1 PASS');
  psqlExec(upgradePg, sql.v3);
  console.log('V3_APPLY_2_IDEMPOTENT PASS');
  validateContract(upgradePg);
  const upgradeSig = signature(upgradePg);
  assert.equal(upgradeSig, freshSig, `fresh and upgrade signatures diverged: ${freshSig} !== ${upgradeSig}`);
  console.log('FRESH_AND_UPGRADE_RUNTIME_CONVERGENCE PASS');
  console.log('TCDX_SAASV2_GRC_RUNTIME_CONTRACT_CLOSEOUT_V3_TEST PASS');
} finally {
  stopPostgres(upgradePg);
  stopPostgres(freshPg);
}
