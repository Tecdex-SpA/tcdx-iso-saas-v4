#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

function tableBlock(tableName) {
  const match = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\([\\s\\S]*?\\n\\);`));
  return match ? match[0] : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relationKind(name) {
  const relationName = escapeRegExp(name);
  const qualifiedName = `(?:[a-z_][\\w]*\\.)?${relationName}`;
  const patterns = [
    ['table', new RegExp(`\\bCREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${qualifiedName}\\b`, 'i')],
    ['materialized_view', new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?MATERIALIZED\\s+VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${qualifiedName}\\b`, 'i')],
    ['view', new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${qualifiedName}\\b`, 'i')],
  ];
  const match = patterns.find(([, pattern]) => pattern.test(schema));
  return match ? match[0] : null;
}

function hasRelation(name) {
  return Boolean(relationKind(name));
}

function hasColumn(tableName, columnName) {
  const block = tableBlock(tableName);
  return Boolean(block && new RegExp(`\\b${columnName}\\b`).test(block));
}

function requireRelation(name, classification, runtimeFeature, runtimeFile, decision) {
  return {
    runtimeFeature,
    runtimeFile,
    dbObject: name,
    classification: hasRelation(name) ? 'COVERED' : classification,
    decision: hasRelation(name) ? `baseline ${relationKind(name)} present` : decision,
  };
}

function requireColumn(tableName, columnName, classification, runtimeFeature, runtimeFile, decision) {
  const dbObject = `${tableName}.${columnName}`;
  return {
    runtimeFeature,
    runtimeFile,
    dbObject,
    classification: hasColumn(tableName, columnName) ? 'COVERED' : classification,
    decision: hasColumn(tableName, columnName) ? 'baseline column present' : decision,
  };
}

const checks = [
  requireColumn('iso_standard_versions', 'certifiable', 'ACTIVELY_USED_MISSING', 'Versioned reference loader', 'scripts/normalization/load-production-reference-catalogs.js', 'Certification status must be explicit.'),
  requireColumn('iso_controls', 'version_code', 'ACTIVELY_USED_MISSING', 'Versioned reference loader', 'scripts/normalization/load-production-reference-catalogs.js', 'Controls must retain version identity.'),
  requireColumn('iso_evidence_expectations', 'control_code', 'ACTIVELY_USED_MISSING', 'Versioned reference loader', 'scripts/normalization/load-production-reference-catalogs.js', 'Evidence must resolve same-version controls.'),
  requireColumn('users', 'tenant_id', 'ACTIVELY_USED_MISSING', 'Auth/RBAC tenant scoping', 'backend/src/middleware/auth.js', 'users must remain tenant-scoped.'),
	  requireColumn('tenant_controls', 'control_id', 'ACTIVELY_USED_MISSING', 'DB-N01 canonical control identity', 'backend/src/utils/tenantControlIdentity.js', 'tenant control must bind catalog control.'),
	  requireColumn('tenant_controls', 'status', 'ACTIVELY_USED_MISSING', 'Control workspace', 'backend/src/routes/controls.routes.js', 'workspace status must be canonical tenant_control state.'),
	  requireColumn('tenant_controls', 'responsible_user_id', 'ACTIVELY_USED_MISSING', 'Control workspace', 'backend/src/routes/controls.routes.js', 'responsibility assignment must stay tenant scoped.'),
	  requireRelation('control_soa', 'ACTIVELY_USED_MISSING', 'SoA runtime', 'backend/src/routes/soa.routes.js', 'SoA state must bind tenant_controls.id.'),
	  requireRelation('control_soa_assessments', 'ACTIVELY_USED_MISSING', 'SoA assessments', 'backend/src/services/soaIntelligence.service.js', 'SoA assessment history must exist in fresh baseline.'),
	  requireRelation('control_soa_change_log', 'ACTIVELY_USED_MISSING', 'SoA change log', 'backend/src/services/soaIntelligence.service.js', 'SoA audit trail must exist in fresh baseline.'),
	  requireColumn('findings', 'tenant_control_id', 'ACTIVELY_USED_MISSING', 'Findings runtime', 'backend/src/routes/findings.routes.js', 'findings must use operational tenant control identity.'),
	  requireColumn('evidences', 'tenant_control_id', 'ACTIVELY_USED_MISSING', 'Evidence runtime', 'backend/src/routes/evidences.routes.js', 'evidences must use operational tenant control identity.'),
	  requireColumn('action_plans', 'tenant_control_id', 'ACTIVELY_USED_MISSING', 'Action plan runtime', 'backend/src/routes/action-plans.routes.js', 'action plans must use operational tenant control identity.'),
	  requireRelation('action_plan_updates', 'ACTIVELY_USED_MISSING', 'Action plan progress runtime', 'backend/src/routes/action-plans.routes.js', 'action progress history is used by routes and official weighted progress.'),
	  requireRelation('v_iso_control_effective_health', 'ACTIVELY_USED_MISSING', 'Health projection', 'backend/src/routes/controls.routes.js', 'effective control Health must project from metric_snapshots.'),
  requireRelation('usage_limit_definitions', 'ACTIVELY_USED_MISSING', 'Commercial/runtime limits', 'backend/src/services/indicators/indicatorGovernance.service.js', 'indicator publication enforces configured usage limits.'),
  requireRelation('tenant_usage_limits', 'ACTIVELY_USED_MISSING', 'Commercial/runtime limits', 'backend/src/services/indicators/indicatorGovernance.service.js', 'tenant overrides must remain available to runtime limit checks.'),
  requireRelation('commercial_events', 'ACTIVELY_USED_MISSING', 'Commercial/runtime audit', 'backend/src/services/indicators/indicatorGovernance.service.js', 'indicator calculation and publication audit to commercial_events.'),
  requireColumn('metric_source_bindings', 'source_contract_id', 'ACTIVELY_USED_MISSING', 'Metric source binding lineage', 'backend/src/services/indicators/indicatorBootstrap.service.js', 'binding must reference source contract.'),
  requireColumn('calculation_runs', 'source_contract_id', 'ACTIVELY_USED_MISSING', 'Official calculation source lineage', 'backend/src/services/math-governance/officialCalculationOrchestrator.service.js', 'runs must reference source contract.'),
  requireColumn('calculation_outputs', 'output_name', 'ACTIVELY_USED_MISSING', 'Official calculation outputs', 'backend/src/services/phase5/phase5.service.js', 'runtime reads output_name=value.'),
  requireColumn('metric_snapshots', 'snapshot_status', 'ACTIVELY_USED_MISSING', 'Indicator snapshots', 'backend/src/services/indicators/indicatorGovernance.service.js', 'published/draft lifecycle required.'),
  requireColumn('metric_snapshots', 'metric_code', 'ACTIVELY_USED_MISSING', 'Indicator snapshots', 'backend/src/services/indicators/indicatorGovernance.service.js', 'published snapshots must carry functional metric code.'),
  requireRelation('metric_sufficiency_rules', 'ACTIVELY_USED_MISSING', 'Indicator sufficiency', 'backend/src/services/indicators/indicatorGovernance.service.js', 'runtime checks source sufficiency rules before publication.'),
  requireRelation('metric_interpretations', 'ACTIVELY_USED_MISSING', 'Indicator interpretation', 'backend/src/services/indicators/indicatorGovernance.service.js', 'snapshot creation writes interpretation lineage.'),
  requireRelation('metric_action_proposals', 'ACTIVELY_USED_MISSING', 'Indicator actions', 'backend/src/services/indicators/indicatorGovernance.service.js', 'published metric alerts can propose governed actions.'),
  requireRelation('data_comparisons', 'ACTIVELY_USED_MISSING', 'Indicator comparisons', 'backend/src/services/indicators/indicatorGovernance.service.js', 'runtime compares published metric snapshots.'),
  requireRelation('metric_job_policies', 'ACTIVELY_USED_MISSING', 'Indicator async jobs', 'backend/src/services/indicators/indicatorGovernance.service.js', 'async indicator jobs require active policies.'),
  requireRelation('tcdx_async_jobs', 'ACTIVELY_USED_MISSING', 'Async jobs/readiness', 'backend/src/app.js', 'readiness and jobs require tcdx_async_jobs.'),
  requireRelation('grc_workflow_instances', 'ACTIVELY_USED_MISSING', 'GRC workflow runtime', 'backend/src/services/grc/grc.service.js', 'workflow instances required.'),
  requireRelation('grc_connector_instances', 'ACTIVELY_USED_MISSING', 'Phase 2 connector scheduler', 'backend/src/services/grc/phase2SchedulerRunner.js', 'active scheduler reads connector instances.'),
  requireRelation('grc_escalation_policies', 'ACTIVELY_USED_MISSING', 'Escalation policies', 'backend/src/services/grc/grc.service.js', 'market readiness UX manages escalation policies.'),
  requireRelation('audit_event_log', 'ACTIVELY_USED_MISSING', 'GRC/service audit trail', 'backend/src/services/grc/grc.service.js', 'runtime writes audit events.'),
  requireRelation('grc_observations', 'ACTIVELY_USED_MISSING', 'Canonical Observation', 'backend/src/services/semantic/semanticLayer.service.js', 'F6.8 canonical observation SOR is active.'),
  requireRelation('grc_observation_relations', 'ACTIVELY_USED_MISSING', 'Canonical Observation relations', 'backend/src/services/grc/grcGap.service.js', 'Observation -> Gap lineage required.'),
  requireRelation('grc_gaps', 'ACTIVELY_USED_MISSING', 'Canonical Gap model', 'backend/src/services/grc/grcGap.service.js', 'F6.8 Gap model active.'),
  requireRelation('grc_gap_rules', 'ACTIVELY_USED_MISSING', 'Gap rules', 'backend/src/services/grc/grcGap.service.js', 'deterministic gap rules required.'),
  requireRelation('data_source_contract_versions', 'ACTIVELY_USED_MISSING', 'Semantic source contracts', 'backend/src/services/semantic/semanticBootstrap.service.js', 'semantic contract versions required.'),
  requireRelation('metric_definitions', 'ACTIVELY_USED_MISSING', 'Indicator catalog', 'backend/src/services/indicators/indicatorGovernance.service.js', 'functional indicator catalog requires metric definitions.'),
  requireRelation('metric_definition_versions', 'ACTIVELY_USED_MISSING', 'Indicator versioning', 'backend/src/services/indicators/indicatorBootstrap.service.js', 'indicator versions required.'),
  requireRelation('metric_measurements', 'ACTIVELY_USED_MISSING', 'Indicator measurements', 'backend/src/services/indicators/indicatorGovernance.service.js', 'snapshot creation reads metric measurements.'),
  requireRelation('metric_trust_assessments', 'ACTIVELY_USED_MISSING', 'Indicator Data Trust', 'backend/src/services/indicators/indicatorGovernance.service.js', 'snapshot creation requires Data Trust assessment.'),
  requireRelation('knowledge_sources', 'ACTIVELY_USED_MISSING', 'Knowledge Base v2', 'backend/src/services/knowledge-base/knowledge.repository.js', 'KB v2 sources active.'),
  requireRelation('knowledge_items', 'ACTIVELY_USED_MISSING', 'Knowledge Base v2', 'backend/src/services/knowledge-base/knowledge.repository.js', 'KB v2 items active.'),
  requireRelation('knowledge_document_ingestions', 'ACTIVELY_USED_MISSING', 'Tenant knowledge ingestion', 'backend/src/services/knowledge-base/knowledgeIngestion.service.js', 'tenant ingestion runs active.'),
  requireRelation('knowledge_document_chunks', 'ACTIVELY_USED_MISSING', 'Knowledge chunks/retrieval/RAG', 'backend/src/services/knowledge-base/knowledgeHybridRetrieval.service.js', 'canonical chunks active.'),
  requireRelation('knowledge_chunk_embeddings', 'ACTIVELY_USED_MISSING', 'Knowledge embeddings', 'backend/src/services/knowledge-base/knowledgeEmbedding.service.js', 'embedding-side table active when pgvector provisioned.'),
  requireRelation('regulatory_authoritative_sources', 'ACTIVELY_USED_MISSING', 'Regulatory foundation', 'backend/src/services/knowledge-base/regulatoryFoundation.service.js', 'authoritative source registry active.'),
  requireRelation('regulations', 'ACTIVELY_USED_MISSING', 'Regulation model', 'backend/src/services/knowledge-base/regulatoryFoundation.service.js', 'regulatory identity model active.'),
  requireRelation('legal_obligations', 'ACTIVELY_USED_MISSING', 'Legal obligations', 'backend/src/services/knowledge-base/regulatoryFoundation.service.js', 'obligations model active.'),
  requireRelation('regulatory_packs', 'ACTIVELY_USED_MISSING', 'Regulatory packs', 'backend/src/services/knowledge-base/regulatoryDiffPacks.service.js', 'pack model active.'),
  requireRelation('recommendation_decision_ledger', 'ACTIVELY_USED_MISSING', 'Operational learning', 'backend/src/services/intelligence/operationalLearning.service.js', 'decision ledger active.'),
  requireRelation('recommendation_effectiveness_evaluations', 'ACTIVELY_USED_MISSING', 'Effectiveness feedback', 'backend/src/services/intelligence/operationalLearning.service.js', 'effectiveness evaluations active.'),
  requireRelation('operational_memory_cases', 'ACTIVELY_USED_MISSING', 'Operational memory', 'backend/src/services/intelligence/operationalLearning.service.js', 'memory cases active.'),
  requireRelation('ai_prompt_logs', 'ACTIVELY_USED_MISSING', 'AI governance audit traces', 'backend/src/services/intelligence/intelligence.audit-log.js', 'AI trace logging active.'),
  requireColumn('permissions', 'permission_group', 'ACTIVELY_USED_MISSING', 'RBAC catalog', 'database/migrations/20260722_phase1_grc_core.sql', 'permission catalog must support governed grouping.'),
  requireColumn('permissions', 'display_name', 'ACTIVELY_USED_MISSING', 'RBAC catalog', 'database/migrations/20260722_phase1_grc_core.sql', 'permission catalog must support product labels.'),
  requireColumn('permissions', 'is_active', 'ACTIVELY_USED_MISSING', 'RBAC catalog', 'runtime permission loaders', 'permission catalog must preserve active lifecycle.'),
  requireColumn('permissions', 'updated_at', 'ACTIVELY_USED_MISSING', 'RBAC catalog', 'runtime permission loaders', 'permission catalog must support idempotent updates.'),
  requireColumn('knowledge_chunk_embeddings', 'embedding', 'ACTIVELY_USED_MISSING', 'Knowledge embeddings', 'backend/src/services/knowledge-base/knowledgeEmbedding.service.js', 'embedding column must use pgvector.'),
  requireColumn('knowledge_chunk_embeddings', 'dimensions', 'ACTIVELY_USED_MISSING', 'Knowledge embeddings', 'backend/src/services/knowledge-base/knowledgeEmbedding.service.js', 'embedding dimension contract must be explicit.'),
];

// These columns are read by loadChunkForTenant before any embedding upsert.
for (const column of ['document_version', 'text_checksum', 'chunk_ordinal']) {
  checks.push(requireColumn('knowledge_document_chunks', column, 'ACTIVELY_USED_MISSING',
    'Knowledge embedding chunk input', 'backend/src/services/knowledge-base/knowledgeEmbedding.service.js',
    'Reconcile canonical ingestion/chunk contract before READY.'));
}

// Validate the runtime INSERT/ON CONFLICT contract, not only table presence.
for (const column of ['knowledge_document_id', 'document_version', 'embedding_contract_version',
  'provider', 'model', 'model_version', 'input_checksum', 'embedding_checksum', 'status',
  'failure_code', 'failure_message', 'generated_at', 'stale_at', 'updated_at']) {
  checks.push(requireColumn('knowledge_chunk_embeddings', column, 'ACTIVELY_USED_MISSING',
    'Knowledge embedding runtime upsert', 'backend/src/services/knowledge-base/knowledgeEmbedding.service.js',
    'Must match canonical F6.10 embedding contract.'));
}
assert.match(tableBlock('knowledge_chunk_embeddings'), /vector_dims\(embedding\) = dimensions/);
assert.match(tableBlock('knowledge_chunk_embeddings'), /FOREIGN KEY \(tenant_id, chunk_id\)/);

assert.match(schema, /RETURN 'UNKNOWN';\s*END \$\$;\s*\n\s*CREATE OR REPLACE FUNCTION dbn02_grc_health_publication_state/, 'P01/P02 Health unknown numeric must not be promoted to AVAILABLE');
assert.match(schema, /CREATE EXTENSION IF NOT EXISTS vector/, 'pgvector extension must be required by fresh production baseline');
assert.match(schema, /embedding\s+vector\b/, 'knowledge_chunk_embeddings.embedding must be pgvector-compatible');
assert.doesNotMatch(schema, /GRANT SELECT ON ALL TABLES IN SCHEMA ai_core TO ai_reader/i, 'P04 ai_reader must not have unsafe direct grants while AI_READER_RLS_DEFERRED');
assert.doesNotMatch(schema, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'production role grants must not use ALL TABLES broad grants');
assert.doesNotMatch(schema, /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+controls\b/i, 'fresh runtime schema must not restore legacy controls');
assert.doesNotMatch(schema, /\bcontrol_health_scores\b/i, 'fresh runtime schema must not restore legacy control_health_scores');
assert.doesNotMatch(schema, /\brefresh_control_health_scores_v2_1\b/i, 'fresh runtime schema must not restore legacy Health refresh function');
assert.doesNotMatch(schema, /\bv_latest_health_kpi_snapshots\b/i, 'fresh runtime schema must not restore legacy Health snapshot view');
assert.doesNotMatch(schema, /\bKPI-HLT-/i, 'fresh runtime schema must not restore KPI-HLT authority');

const activeMissing = checks.filter((check) => check.classification === 'ACTIVELY_USED_MISSING');
const criticalUndetermined = checks.filter((check) => check.classification === 'UNDETERMINED');

console.log(`ACTIVE_MISSING=${activeMissing.length}`);
console.log(`DBN05_RUNTIME_SCHEMA_CONTRACT checked=${checks.length} active_missing=${activeMissing.length} critical_undetermined=${criticalUndetermined.length}`);
for (const check of activeMissing) {
  console.log(`ACTIVE_MISSING ${check.dbObject} feature=${check.runtimeFeature} file=${check.runtimeFile}`);
}

if (activeMissing.length > 0 || criticalUndetermined.length > 0) {
  process.exitCode = 1;
} else {
  console.log('DB-N05 runtime schema contract PASS');
}

// Full table and index parity for the explicitly scoped regulatory contracts.
const regulatoryTables = new Set();
for (const migration of ['20260819_f6_11_a_regulatory_foundation.sql', '20260824_f6_11_b_semantic_diff_regulatory_packs.sql']) {
  const canonical = fs.readFileSync(path.join(root, 'database/migrations', migration), 'utf8');
  for (const match of canonical.matchAll(/CREATE TABLE IF NOT EXISTS ((?:regulatory_\w+|regulations|regulation_versions|legal_obligations)) \([\s\S]*?\n\);/g)) {
    regulatoryTables.add(match[1]);
    assert.equal(tableBlock(match[1])?.replace(/\s+/g, ' '), match[0].replace(/\s+/g, ' '), `${match[1]} canonical columns/constraints parity`);
  }
  for (const match of canonical.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS \w+\s+ON (\w+)\b[^;]*;/g)) {
    if (regulatoryTables.has(match[1])) assert.ok(schema.replace(/\s+/g, ' ').includes(match[0].replace(/\s+/g, ' ')), `${match[1]} canonical index parity`);
  }
}
assert.equal(regulatoryTables.size, 15);
console.log('REGULATORY_SCHEMA_PARITY PASS tables=15');
