#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout',
  file: path.join(root, 'database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091007;

function sanitize(error) {
  return String(error?.message || 'fresh baseline runtime dependency closeout migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bcreate\s+table\s+if\s+not\s+exists\s+notifications\b/,
    /\bcreate\s+table\s+if\s+not\s+exists\s+document_index\b/,
    /\bcreate\s+table\s+if\s+not\s+exists\s+report_access_rules\b/,
    /\bcreate\s+table\s+if\s+not\s+exists\s+iso_operational_suggestion_audit_log\b/,
    /\balter\s+table\s+iso_recommended_action_conversions\b[\s\S]*\brecommendation_id\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_iso_control_effective_health\b/,
    /\bf5_5_control_effectiveness\b/,
    /\bgrant\s+select,\s*insert,\s*update\b[\s\S]*\bto\s+tcdx_backend_runtime\b/,
  ];
  const forbidden = [
    /\btecdex_saas\b/,
    /\btcdx_saasv2\b/,
    /@tcdx\.local\b/,
    /@tecdex\.net\b/,
    /\btruncate\s+\b/,
    /\bdrop\s+table\b/,
    /\bdrop\s+schema\b/,
    /\bgrant\s+all\b/,
    /\bgrant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\b/,
    /\bgrant\s+execute\s+on\s+all\s+functions\b/,
    /\binsert\s+into\s+(?:public\.)?(tenants|users|tenant_subscriptions|tenant_subscription_addons)\b/,
    /\bcontrol_health_scores\b/,
    /\bkpi-hlt\b/,
    /\balter\s+table\s+tenant_controls\b[\s\S]*\badd\s+column\s+(?:if\s+not\s+exists\s+)?notes\b/,
    /\balter\s+role\s+tcdx_backend_runtime\b[\s\S]*\blogin\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`fresh runtime dependency closeout SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`fresh runtime dependency closeout SQL missing required token: ${missing}`);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) throw new Error(`migration file missing: ${path.relative(root, MIGRATION.file)}`);
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for fresh baseline runtime dependency closeout');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('migration must contain one outer BEGIN/COMMIT pair');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function ensureSchemaMigrations(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_id text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz,
    applied_by text NOT NULL,
    duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    status text NOT NULL CHECK (status IN ('running','applied','failed')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
}

async function requireBaseSchema(client) {
  const result = await client.query(`
    WITH required_relations(name) AS (
      VALUES
        ('tenants'), ('users'), ('tenant_standards'), ('tenant_controls'),
        ('controls_catalog'), ('metric_snapshots'), ('metric_calculation_policies'),
        ('tenant_nonconformities'), ('action_plans'), ('risks'),
        ('risk_control_relations'), ('iso_operational_suggestions'),
        ('iso_recommended_action_conversions'), ('schema_migrations')
    )
    SELECT
      current_user AS migration_user,
      current_database() AS migration_database,
      to_regrole('tcdx_backend_runtime') IS NOT NULL AS runtime_role_exists,
      COALESCE(bool_and(to_regclass('public.' || name) IS NOT NULL), false) AS base_relations_ready
    FROM required_relations
  `);
  const row = result.rows[0] || {};
  process.stdout.write(`migration_user=${row.migration_user}\n`);
  process.stdout.write(`migration_database=${row.migration_database}\n`);
  process.stdout.write(`runtime_role_exists=${row.runtime_role_exists}\n`);
  process.stdout.write(`base_relations_ready=${row.base_relations_ready}\n`);
  if (row.runtime_role_exists !== true || row.base_relations_ready !== true) {
    throw new Error('fresh runtime dependency closeout base preflight failed');
  }
}

async function fetchCurrentState(client) {
  const result = await client.query(`
    WITH required_relations(name) AS (
      VALUES
        ('notifications'), ('document_index'), ('tenant_document_index_exclusions'),
        ('report_types'), ('report_access_rules'), ('report_exports'),
        ('iso_catalog_sync_status'), ('iso_express_assessments'),
        ('iso_express_assessment_items'), ('iso_express_assessment_gaps'),
        ('iso_express_assessment_answers'), ('iso_express_assessment_audit_log'),
        ('iso_operational_suggestion_audit_log'),
        ('v_iso_control_effective_health'), ('v_iso_control_catalog_coverage'),
        ('v_iso_express_tenant_standard_readiness'), ('v_health_root_causes_by_tenant'),
        ('v_iso_operational_suggestions_queue'), ('v_iso_operational_suggestions_summary')
    ),
    required_columns(table_name, column_name) AS (
      VALUES
        ('metric_calculation_policies','created_at'),
        ('tenant_controls','tenant_standard_id'),
        ('report_access_rules','can_generate'),
        ('document_index','content_hash'),
        ('document_index','local_storage_path'),
        ('iso_operational_suggestions','dedupe_key'),
        ('iso_operational_suggestions','source_module'),
        ('iso_operational_suggestions','created_record_id'),
        ('iso_recommended_action_conversions','recommendation_id'),
        ('iso_recommended_action_conversions','target_type'),
        ('iso_recommended_action_conversions','target_id'),
        ('iso_operational_suggestion_audit_log','suggestion_id'),
        ('v_iso_control_effective_health','category'),
        ('v_iso_operational_suggestions_queue','resolved_operation_id'),
        ('v_iso_operational_suggestions_queue','payload')
    )
    SELECT
      (SELECT count(*)::int FROM required_relations WHERE to_regclass('public.' || name) IS NOT NULL) AS required_relations,
      (
        SELECT count(*)::int
        FROM required_columns rc
        JOIN information_schema.columns c
          ON c.table_schema = 'public'
         AND c.table_name = rc.table_name
         AND c.column_name = rc.column_name
      ) AS required_columns,
      (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='tenant_controls' AND column_name='notes') AS tenant_controls_notes_columns,
      (SELECT count(*)::int FROM report_types WHERE code IN ('executive_iso_status','maturity_gap_diagnostic','control_health_report','iso_risk_report','action_plan_report','internal_audit_report','platform_client_monthly')) AS report_catalog_rows,
      (SELECT count(*)::int FROM report_access_rules WHERE can_view IS TRUE) AS report_access_rows,
      has_table_privilege('tcdx_backend_runtime', 'notifications', 'INSERT') AS backend_notifications_insert,
      has_table_privilege('tcdx_backend_runtime', 'document_index', 'INSERT') AS backend_document_index_insert,
      has_table_privilege('tcdx_backend_runtime', 'report_access_rules', 'SELECT') AS backend_report_access_select,
      has_table_privilege('tcdx_backend_runtime', 'iso_operational_suggestion_audit_log', 'INSERT') AS backend_suggestion_audit_insert,
      has_table_privilege('tcdx_backend_runtime', 'iso_recommended_action_conversions', 'INSERT') AS backend_conversions_insert,
      has_table_privilege('tcdx_backend_runtime', 'v_iso_control_effective_health', 'SELECT') AS backend_health_view_select,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS backend_runtime_can_login,
      position('control_health_scores' in pg_get_viewdef('public.v_iso_control_effective_health'::regclass)) > 0 AS health_view_has_control_health_scores,
      position('KPI-HLT' in pg_get_viewdef('public.v_iso_control_effective_health'::regclass)) > 0 AS health_view_has_kpi_hlt
  `);
  return result.rows[0] || {};
}

function statePasses(state) {
  return (
    Number(state.required_relations || 0) === 19 &&
    Number(state.required_columns || 0) === 15 &&
    Number(state.tenant_controls_notes_columns || 0) === 0 &&
    Number(state.report_catalog_rows || 0) >= 7 &&
    Number(state.report_access_rows || 0) >= 20 &&
    state.backend_notifications_insert === true &&
    state.backend_document_index_insert === true &&
    state.backend_report_access_select === true &&
    state.backend_suggestion_audit_insert === true &&
    state.backend_conversions_insert === true &&
    state.backend_health_view_select === true &&
    state.backend_runtime_can_login === false &&
    state.health_view_has_control_health_scores === false &&
    state.health_view_has_kpi_hlt === false
  );
}

function printState(state) {
  for (const [key, value] of Object.entries(state)) process.stdout.write(`${key}=${value}\n`);
}

function migrationStateFromRows(rows, migration) {
  if (!rows.length) return 'pending';
  const row = rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return 'already_applied';
  if (row.status === 'applied') return 'checksum_mismatch';
  if (row.status === 'running') return 'running';
  if (row.status === 'failed') return 'pending';
  return row.status || 'pending';
}

function assertMigrationStateIsSafe(state, migration) {
  if (state === 'checksum_mismatch') {
    const error = new Error(`fresh runtime dependency closeout checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`fresh runtime dependency closeout ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`fresh runtime dependency closeout ledger has unsupported status ${state}: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
}

async function readLedgerState(client, migration) {
  const result = await client.query(
    'SELECT migration_id, checksum, status FROM schema_migrations WHERE migration_id = $1',
    [migration.id]
  );
  const state = migrationStateFromRows(result.rows, migration);
  process.stdout.write(`migration_state=${state}\n`);
  assertMigrationStateIsSafe(state, migration);
  return state;
}

async function preflight() {
  const migration = readMigration();
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await ensureSchemaMigrations(client);
    await requireBaseSchema(client);
    const state = await readLedgerState(client, migration);
    if (state === 'already_applied') {
      const current = await fetchCurrentState(client);
      printState(current);
      if (!statePasses(current)) throw new Error('fresh runtime dependency closeout postconditions failed for applied migration');
    }
    process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_PREFLIGHT_OK\n');
  } finally {
    await client.end();
  }
}

async function apply() {
  const migration = readMigration();
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  const started = Date.now();
  try {
    await ensureSchemaMigrations(client);
    await requireBaseSchema(client);
    const state = await readLedgerState(client, migration);
    if (state === 'already_applied') {
      const current = await fetchCurrentState(client);
      printState(current);
      if (!statePasses(current)) throw new Error('fresh runtime dependency closeout postconditions failed for applied migration');
      process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_APPLY_OK already_applied=true\n');
      return;
    }

    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1,$2) AS locked', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.locked !== true) throw new Error('fresh runtime dependency closeout runner lock not available');
    await client.query(
      `INSERT INTO schema_migrations (migration_id, checksum, applied_at, applied_by, duration_ms, status, details)
       VALUES ($1, $2, NULL, current_user, 0, 'running', '{}'::jsonb)
       ON CONFLICT (migration_id) DO UPDATE
       SET checksum = EXCLUDED.checksum, applied_by = current_user, status = 'running', details = '{}'::jsonb`,
      [migration.id, migration.checksum]
    );
    await client.query(unwrapTransaction(migration.sql));
    const current = await fetchCurrentState(client);
    printState(current);
    if (!statePasses(current)) throw new Error('fresh runtime dependency closeout postconditions failed after apply');
    await client.query(
      `UPDATE schema_migrations
       SET status = 'applied', applied_at = now(), duration_ms = $2, details = $3::jsonb
       WHERE migration_id = $1`,
      [migration.id, Date.now() - started, JSON.stringify(current)]
    );
    await client.query('COMMIT');
    process.stdout.write('FRESH_BASELINE_RUNTIME_DEPENDENCY_APPLY_OK\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger) {
      await client.query(
        `INSERT INTO schema_migrations (migration_id, checksum, applied_at, applied_by, duration_ms, status, details)
         VALUES ($1, $2, now(), current_user, $3, 'failed', $4::jsonb)
         ON CONFLICT (migration_id) DO UPDATE
         SET checksum = EXCLUDED.checksum, applied_at = now(), applied_by = current_user,
             duration_ms = EXCLUDED.duration_ms, status = 'failed', details = EXCLUDED.details`,
        [migration.id, migration.checksum, Date.now() - started, JSON.stringify({ error: sanitize(error) })]
      ).catch(() => null);
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const mode = process.argv[2] || '--preflight';
  if (mode === '--checksum') {
    const migration = readMigration();
    process.stdout.write(`${migration.id} checksum=${migration.checksum}\n`);
    return;
  }
  if (mode === '--preflight') return preflight();
  if (mode === '--apply') return apply();
  throw new Error(`Unsupported mode: ${mode}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(sanitize(error));
    process.exit(1);
  });
}

module.exports = {
  LOCK_KEY,
  LOCK_NAMESPACE,
  MIGRATION,
  fetchCurrentState,
  migrationStateFromRows,
  readMigration,
  sanitize,
  statePasses,
  unwrapTransaction,
  validateSql,
};
