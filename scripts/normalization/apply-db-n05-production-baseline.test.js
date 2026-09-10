#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const harnessPath = path.join(root, 'scripts/normalization/db-n05-fresh-production.postgres.test.js');
const referenceLoaderPath = path.join(root, 'scripts/normalization/load-production-reference-catalogs.js');
const chainPath = path.join(root, 'artifacts/db-n05/MIGRATION_CHAIN.md');
const allowlistPath = path.join(root, 'artifacts/db-n05/PRODUCTION_OBJECT_ALLOWLIST.md');

function read(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

function stripCommentsAndStrings(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$');
}

const schema = read(schemaPath);
const seed = read(seedPath);
const harness = read(harnessPath);
const referenceLoader = read(referenceLoaderPath);
const chain = read(chainPath);
const allowlist = read(allowlistPath);
const executableSchema = stripCommentsAndStrings(schema);
const executableSeed = stripCommentsAndStrings(seed);

function tableBlock(tableName) {
  const match = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\([\\s\\S]*?\\n\\);`));
  assert.ok(match, `${tableName} table block must exist`);
  return match[0];
}

assert.match(schema, /BEGIN;/, 'DB-N05 baseline must be transactional');
assert.match(schema, /COMMIT;/, 'DB-N05 baseline must close transaction');
assert.match(schema, /pg_try_advisory_xact_lock\(844332,\s*2026090705\)/, 'DB-N05 baseline must use advisory lock');
assert.match(seed, /pg_try_advisory_xact_lock\(844332,\s*2026090715\)/, 'DB-N05 seed must use advisory lock');
assert.match(schema, /CREATE EXTENSION IF NOT EXISTS pgcrypto/, 'pgcrypto must be required');
assert.match(schema, /CREATE EXTENSION IF NOT EXISTS vector/, 'pgvector extension must be required');
assert.match(schema, /embedding\s+vector\b/, 'knowledge embeddings must use pgvector type');
assert.doesNotMatch(schema, /pg_available_extensions WHERE name = 'vector'/, 'pgvector must not be silently downgraded when unavailable');
assert.match(schema, /CREATE SCHEMA IF NOT EXISTS tcdx_security/, 'tenant security schema must exist');
assert.match(schema, /CREATE SCHEMA IF NOT EXISTS ai_core/, 'AI read schema must exist');
assert.match(schema, /CREATE ROLE tcdx_backend_runtime NOLOGIN/, 'backend runtime role must be declared without password');
assert.match(schema, /CREATE ROLE tcdx_platform_runtime NOLOGIN/, 'platform runtime role must be declared without password');
assert.match(schema, /CREATE ROLE ai_reader NOLOGIN/, 'ai_reader role must be declared without password');

for (const required of [
  'tenants',
  'users',
  'app_roles',
  'permissions',
  'role_permissions',
  'commercial_plans',
  'commercial_addons',
  'tenant_subscriptions',
  'tenant_subscription_addons',
  'standards',
  'iso_standards',
  'iso_standard_versions',
  'iso_controls',
  'iso_evidence_expectations',
  'controls_catalog',
  'controls_catalog_standards',
	  'tenant_standards',
  'tenant_standard_operations',
	  'tenant_controls',
	  'control_soa',
	  'control_soa_assessments',
	  'control_soa_change_log',
	  'evidences',
  'findings',
  'tenant_nonconformities',
  'action_plans',
  'assets',
  'asset_risks',
  'risks',
  'risk_control_relations',
  'audits',
  'iso_risk_templates',
  'iso_risk_matrix_runs',
  'iso_risk_matrix_items',
  'iso_risk_matrix_actions',
  'iso_risk_matrix_audit_log',
  'documents',
  'grc_workflow_instances',
  'tcdx_async_jobs',
  'official_formula_versions',
	  'calculation_runs',
	  'calculation_outputs',
	  'metric_snapshots',
	  'grc_connector_instances',
  'grc_escalation_policies',
  'audit_event_log',
  'grc_observations',
  'grc_observation_relations',
  'grc_gaps',
  'grc_gap_rules',
  'data_source_contract_versions',
  'metric_definitions',
  'metric_definition_versions',
  'metric_measurements',
  'metric_trust_assessments',
  'knowledge_sources',
  'knowledge_items',
  'knowledge_document_ingestions',
  'knowledge_document_chunks',
  'knowledge_chunk_embeddings',
  'regulatory_authoritative_sources',
  'regulations',
  'legal_obligations',
  'regulatory_packs',
  'recommendation_decision_ledger',
  'recommendation_effectiveness_evaluations',
  'operational_memory_cases',
  'ai_prompt_logs',
]) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${required}\\b`), `${required} must be in production baseline`);
}

for (const required of [
	  'fk_dbn03_findings_tenant_control_same_tenant',
	  'fk_dbn03_evidences_tenant_control_same_tenant',
	  'fk_dbn03_action_plans_tenant_control_same_tenant',
	  'fk_dbn05_control_soa_assessments_tenant_control_same_tenant',
	  'fk_dbn05_control_soa_change_log_tenant_control_same_tenant',
	  'fk_dbn05_risk_control_tenant_control_same_tenant',
	]) {
  assert.match(schema, new RegExp(required), `${required} must be preserved`);
}

for (const required of [
  'tcdx_security.current_tenant_id()',
  'tcdx_security.platform_scope_enabled()',
  'tcdx_security.tenant_visible(uuid)',
	  'tcdx_security.tenant_write_allowed(uuid)',
	  'dbn02_resolve_control_standard_code',
	  'v_iso_control_effective_health',
	  'tcdx_security.dbn04_rls_runtime_readiness',
	]) {
  assert.match(schema, new RegExp(required.replace(/[().]/g, '\\$&')), `${required} contract must be present`);
}

for (const [tableName, columns] of Object.entries({
  official_formula_versions: ['version_number'],
  official_formula_source_contracts: ['formula_code', 'version_number', 'checksum', 'metadata'],
  metric_source_bindings: ['metric_key', 'formula_code', 'source_contract_id', 'metric_definition_id', 'definition_version_id', 'official_formula_version_id', 'semantic_contract_version_id', 'version_number', 'methodology_version', 'published_at'],
  calculation_runs: ['formula_code', 'source_contract_id', 'run_status', 'period_start', 'period_end', 'source_snapshot_hash', 'correlation_id'],
  calculation_outputs: ['output_name', 'output_value', 'unit', 'precision', 'rounding_policy', 'output_hash'],
  metric_snapshots: ['metric_definition_id', 'period_key', 'snapshot_payload', 'content_hash', 'calculation_run_id', 'official_formula_version_id', 'source_snapshot_ids', 'snapshot_status', 'created_at'],
  permissions: ['permission_group', 'display_name', 'is_active', 'updated_at'],
  knowledge_chunk_embeddings: ['embedding', 'dimensions', 'provider', 'model', 'model_version', 'input_checksum', 'embedding_checksum', 'status'],
})) {
  const block = tableBlock(tableName);
  for (const column of columns) {
    assert.match(block, new RegExp(`\\b${column}\\b`), `${tableName}.${column} must exist for runtime compatibility`);
  }
}

	assert.match(schema, /RETURN 'UNKNOWN';\s*END \$\$;\s*\n\s*CREATE OR REPLACE FUNCTION dbn02_grc_health_publication_state/, 'unknown numeric Health state must remain UNKNOWN');
	assert.doesNotMatch(schema, /GRANT SELECT ON ALL TABLES IN SCHEMA ai_core TO ai_reader/i, 'ai_reader must not receive broad ai_core SELECT while RLS is deferred');
	assert.doesNotMatch(schema, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'production runtime grants must be explicit, not schema-wide ALL TABLES');
	assert.match(schema, /GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, tenant_standards/, 'backend runtime DML grants must be explicit');
	assert.doesNotMatch(executableSchema, /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+controls\b/i, 'fresh production baseline must not create legacy controls table');
	assert.doesNotMatch(executableSchema, /\bcontrol_health_scores\b/i, 'fresh production baseline must not include legacy control_health_scores');
	assert.doesNotMatch(executableSchema, /\brefresh_control_health_scores_v2_1\b/i, 'fresh production baseline must not include legacy Health refresh function');
	assert.doesNotMatch(executableSchema, /\bv_latest_health_kpi_snapshots\b/i, 'fresh production baseline must not include legacy Health KPI view');
	assert.doesNotMatch(executableSchema, /\bKPI-HLT-/i, 'fresh production baseline must not include legacy KPI-HLT objects');

for (const forbidden of [
  /\bCREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+qa_audit\b/i,
  /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+\w*(backup_before_|cleanup_backup|backup_history|v2_preview)\w*\b/i,
  /\bINSERT\s+INTO\s+tenants\b/i,
  /\bpassword\s*=/i,
  /\bPASSWORD\b/i,
  /192\.168\.2\.40/,
  /70000000-0000-[0-9a-f-]{23}/i,
]) {
  assert.doesNotMatch(executableSchema, forbidden, `schema must not contain forbidden pattern ${forbidden}`);
  assert.doesNotMatch(executableSeed, forbidden, `seed must not contain forbidden pattern ${forbidden}`);
}

assert.doesNotMatch(executableSchema, /\bDROP\s+(TABLE|VIEW|INDEX|SCHEMA|FUNCTION)\b/i, 'baseline must not drop objects');
assert.doesNotMatch(executableSchema, /\bTRUNCATE\b/i, 'baseline must not truncate');
assert.doesNotMatch(executableSeed, /\bDELETE\s+FROM\b/i, 'seed must not delete data');
assert.doesNotMatch(executableSeed, /\bINSERT\s+INTO\s+(findings|evidences|action_plans|risks|audits|documents)\b/i, 'seed must not contain tenant operational rows');

assert.match(seed, /F5_5_GRC_HEALTH/, 'governed Health formula seed must exist');
assert.match(seed, /AI_ADDON/, 'AI add-on classification must remain explicit');
assert.match(seed, /ISO_27001_2022/, 'reference standard seed must exist');
assert.match(seed, /TEST_FIXTURE_ONLY/, 'three-control compatibility seed must be explicitly test-fixture only');
assert.match(referenceLoader, /syncMathGovernanceCatalog/, 'production reference loader must reuse formula bootstrap');
assert.match(referenceLoader, /bootstrapSemanticRegistry/, 'production reference loader must reuse semantic bootstrap');
assert.match(referenceLoader, /bootstrapIndicators/, 'production reference loader must reuse indicator bootstrap');
assert.match(referenceLoader, /loadKnowledgeBaseSeed/, 'production reference loader must reuse KB loader');
assert.match(referenceLoader, /knowledge_base_seed_v2\.jsonl/, 'production reference loader must bind versioned KB seed');
assert.match(harness, /FRESH_DB_FROM_ZERO PASS/, 'harness must emit final PASS marker');
assert.match(harness, /ZERO_LEGACY_OBJECTS PASS/, 'harness must prove zero-legacy objects in fresh PostgreSQL');
assert.match(harness, /createPostgres/, 'harness must create an empty isolated PostgreSQL cluster');
assert.match(read(path.join(root, 'scripts/normalization/db-n05-isolated-postgres.js')), /initdb/, 'isolated helper preserves local empty cluster mode');
assert.match(harness, /production_schema_v1\.sql/, 'harness must apply production baseline');
assert.match(harness, /production_seed_v1\.sql/, 'harness must apply production seed');
assert.match(harness, /withTenantTransaction/, 'harness must exercise DB-N04 tenant runtime helper');
assert.match(harness, /withPlatformTransaction/, 'harness must exercise explicit platform runtime helper');
assert.match(harness, /Cross tenant should fail/, 'harness must test cross-tenant FK rejection');
assert.match(harness, /unknown_numeric: 'UNKNOWN'/, 'harness must test unknown numeric Health parity');
assert.doesNotMatch(
  harness,
  /\bINSERT\s+INTO\s+(controls|control_health_scores)\b|\bUPDATE\s+control_health_scores\b|\bFROM\s+control_health_scores\b|\bJOIN\s+control_health_scores\b|\brefresh_control_health_scores_v2_1\s*\(/i,
  'fresh PostgreSQL harness must not exercise legacy Health/control compatibility'
);
assert.match(harness, /source contract -> binding -> formula -> run -> output -> snapshot lineage/, 'harness must test source binding lineage');
assert.match(harness, /ai_reader must not have unsafe direct ai_core read grants/, 'harness must test ai_reader safe defer posture');
assert.match(chain, /Consolidated production baseline/, 'migration chain must document DB-N05 baseline strategy');
assert.match(chain, /DB-N01 -> DB-N02 -> DB-N03 -> DB-N04 -> DB-N05/, 'migration order must be documented');
assert.match(allowlist, /NOT_ALLOWED_IN_FRESH_PROD/, 'allowlist must classify forbidden fresh-prod objects');

console.log('DB-N05 production baseline static checks: OK');
