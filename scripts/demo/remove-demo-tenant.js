#!/usr/bin/env node
'use strict';

const path = require('path');
const { Client } = require(path.join(__dirname, '../../backend/node_modules/pg'));

const DEMO_TENANT_ID = '76c44a0e-6041-8bda-99c7-b740fccea001';

function sanitizeError(error) {
  return String(error?.message || 'demo tenant removal error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) throw new Error('MIGRATION_DATABASE_URL is required to remove the demo tenant');
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  if (/prod|production/i.test(value) && process.env.ALLOW_DEMO_PRODUCTION_WRITE !== 'I_UNDERSTAND') {
    throw new Error('Refusing to remove demo tenant from a production-looking database URL');
  }
  return value;
}

async function deleteIfTable(client, table, whereSql, params) {
  const exists = await client.query('SELECT to_regclass($1) AS regclass', [`public.${table}`]);
  if (!exists.rows[0].regclass) return 0;
  const result = await client.query(`DELETE FROM ${table} WHERE ${whereSql}`, params);
  return result.rowCount;
}

async function triggerExists(client, table, triggerName) {
  const result = await client.query(
    'SELECT 1 FROM pg_trigger WHERE tgname=$1 AND tgrelid=$2::regclass',
    [triggerName, table]
  ).catch(() => ({ rowCount: 0 }));
  return result.rowCount > 0;
}

async function main() {
  const client = new Client({ connectionString: requireMigrationDatabaseUrl() });
  await client.connect();
  const deleted = {};
  try {
    await client.query('BEGIN');
    const tenant = await client.query(
      `SELECT id,name,rut,service_status FROM tenants WHERE id=$1::uuid FOR UPDATE`,
      [DEMO_TENANT_ID]
    );
    if (!tenant.rowCount) {
      await client.query('ROLLBACK');
      process.stdout.write('demo_tenant_remove=not_found\n');
      return;
    }
    const row = tenant.rows[0];
    if (row.name !== 'Demo Tecdex' || row.rut !== 'DEMO-TECDX-ISO-GRC') {
      throw new Error('Safety check failed: target tenant does not match Demo Tecdex deterministic identity');
    }

    deleted.grc_observation_relations = await deleteIfTable(client, 'grc_observation_relations', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    const observationTrigger = await triggerExists(client, 'grc_observations', 'trg_semantic_observation_history');
    if (observationTrigger) await client.query('ALTER TABLE grc_observations DISABLE TRIGGER trg_semantic_observation_history');
    try {
      deleted.grc_observations = await deleteIfTable(client, 'grc_observations', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    } finally {
      if (observationTrigger) await client.query('ALTER TABLE grc_observations ENABLE TRIGGER trg_semantic_observation_history');
    }

    deleted.data_source_field_mappings = await deleteIfTable(client, 'data_source_field_mappings', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    const semanticVersionTrigger = await triggerExists(client, 'data_source_contract_versions', 'trg_semantic_contract_version_immutable');
    if (semanticVersionTrigger) await client.query('ALTER TABLE data_source_contract_versions DISABLE TRIGGER trg_semantic_contract_version_immutable');
    try {
      deleted.data_source_contract_versions = await deleteIfTable(client, 'data_source_contract_versions', 'contract_id IN (SELECT id FROM data_source_contracts WHERE tenant_id=$1::uuid)', [DEMO_TENANT_ID]);
    } finally {
      if (semanticVersionTrigger) await client.query('ALTER TABLE data_source_contract_versions ENABLE TRIGGER trg_semantic_contract_version_immutable');
    }
    deleted.data_source_contracts = await deleteIfTable(client, 'data_source_contracts', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.data_lineage_edges = await deleteIfTable(client, 'data_lineage_edges', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.report_generations = await deleteIfTable(client, 'report_generations', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.report_definitions = await deleteIfTable(client, 'report_definitions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.dashboard_widgets = await deleteIfTable(client, 'dashboard_widgets', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.dashboard_definitions = await deleteIfTable(client, 'dashboard_definitions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.loss_events = await deleteIfTable(client, 'loss_events', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.assurance_test_executions = await deleteIfTable(client, 'assurance_test_executions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.assurance_test_definitions = await deleteIfTable(client, 'assurance_test_definitions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.assessment_campaigns = await deleteIfTable(client, 'assessment_campaigns', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    const surveyVersionTrigger = await triggerExists(client, 'survey_versions', 'trg_survey_versions_immutable');
    if (surveyVersionTrigger) await client.query('ALTER TABLE survey_versions DISABLE TRIGGER trg_survey_versions_immutable');
    try {
      deleted.survey_definitions = await deleteIfTable(client, 'survey_definitions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    } finally {
      if (surveyVersionTrigger) await client.query('ALTER TABLE survey_versions ENABLE TRIGGER trg_survey_versions_immutable');
    }
    deleted.metric_snapshots = await deleteIfTable(client, 'metric_snapshots', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.metric_measurements = await deleteIfTable(client, 'metric_measurements', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    const metricFormulaTrigger = await triggerExists(client, 'metric_formula_versions', 'trg_metric_formula_versions_immutable');
    if (metricFormulaTrigger) await client.query('ALTER TABLE metric_formula_versions DISABLE TRIGGER trg_metric_formula_versions_immutable');
    try {
      deleted.metric_definitions = await deleteIfTable(client, 'metric_definitions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    } finally {
      if (metricFormulaTrigger) await client.query('ALTER TABLE metric_formula_versions ENABLE TRIGGER trg_metric_formula_versions_immutable');
    }
    deleted.data_snapshots = await deleteIfTable(client, 'data_snapshots', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.data_elements = await deleteIfTable(client, 'data_elements', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.data_sources = await deleteIfTable(client, 'data_sources', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.data_domains = await deleteIfTable(client, 'data_domains', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.action_plans = await deleteIfTable(client, 'action_plans', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.findings = await deleteIfTable(client, 'findings', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.audits = await deleteIfTable(client, 'audits', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.evidences = await deleteIfTable(client, 'evidences', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_controls = await deleteIfTable(client, 'tenant_controls', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.controls_catalog = await deleteIfTable(client, 'controls_catalog', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.asset_risks = await deleteIfTable(client, 'asset_risks', 'asset_id IN (SELECT id FROM assets WHERE tenant_id=$1::uuid)', [DEMO_TENANT_ID]);
    deleted.assets = await deleteIfTable(client, 'assets', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_operations = await deleteIfTable(client, 'tenant_operations', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_processes = await deleteIfTable(client, 'tenant_processes', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_standards = await deleteIfTable(client, 'tenant_standards', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_usage_limits = await deleteIfTable(client, 'tenant_usage_limits', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_feature_overrides = await deleteIfTable(client, 'tenant_feature_overrides', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_subscriptions = await deleteIfTable(client, 'tenant_subscriptions', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenant_company_profiles = await deleteIfTable(client, 'tenant_company_profiles', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.commercial_events = await deleteIfTable(client, 'commercial_events', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.users = await deleteIfTable(client, 'users', 'tenant_id=$1::uuid', [DEMO_TENANT_ID]);
    deleted.tenants = await deleteIfTable(client, 'tenants', 'id=$1::uuid AND name=$2 AND rut=$3', [DEMO_TENANT_ID, 'Demo Tecdex', 'DEMO-TECDX-ISO-GRC']);
    await client.query('COMMIT');
    process.stdout.write(`demo_tenant_removed=${JSON.stringify(deleted)}\n`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { process.stderr.write(`rollback_error=${sanitizeError(rollbackError)}\n`); }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
