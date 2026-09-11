#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260911_tcdx_post_lifecycle_runtime_consumers_systemic_closeout',
  file: path.join(root, 'database/migrations/20260911_tcdx_post_lifecycle_runtime_consumers_systemic_closeout.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091102;

function sanitize(error) {
  return String(error?.message || 'post lifecycle runtime consumers migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bcreate\s+or\s+replace\s+view\s+public\.v_control_health_risks\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_health_root_causes_by_standard\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_health_remediation_summary_by_tenant\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_health_remediation_plan\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_remediation_executive_by_tenant\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_remediation_executive_by_standard\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_evidence_approval_queue\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_audit_evidence_timeline\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_audit_action_plan_timeline\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_audit_event_log_enriched\b/,
    /\bcreate\s+or\s+replace\s+view\s+public\.v_controls_recovered_by_remediation\b/,
    /\bgrant\s+select\s+on\b[\s\S]*\bto\s+tcdx_backend_runtime\b/,
    /\bpg_try_advisory_xact_lock\(844332,\s*2026091102\)/,
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
    new RegExp('\\brefresh_' + 'kpi_health_snapshots\\b'),
    /\balter\s+role\s+tcdx_backend_runtime\b[\s\S]*\blogin\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`post lifecycle SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`post lifecycle SQL missing required token: ${missing}`);
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
    throw new Error('MIGRATION_DATABASE_URL is required for post lifecycle runtime consumers closeout');
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
        ('tenant_applicable_controls'), ('controls_catalog'), ('evidences'),
        ('findings'), ('action_plans'), ('audit_event_log'),
        ('metric_snapshots'), ('v_iso_control_effective_health'), ('schema_migrations')
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
    throw new Error('post lifecycle runtime consumers base preflight failed');
  }
}

async function fetchCurrentState(client) {
  const result = await client.query(`
    WITH required_views(name) AS (
      VALUES
        ('v_control_health_risks'),
        ('v_control_health_risks_applicable'),
        ('v_health_root_causes_by_standard'),
        ('v_health_remediation_summary_by_tenant'),
        ('v_health_remediation_summary_by_standard'),
        ('v_health_remediation_plan'),
        ('v_remediation_executive_by_tenant'),
        ('v_remediation_executive_by_standard'),
        ('v_evidence_approval_queue'),
        ('v_audit_evidence_timeline'),
        ('v_audit_action_plan_timeline'),
        ('v_audit_event_log_enriched'),
        ('v_controls_recovered_by_remediation'),
        ('v_audit_control_recovery_timeline')
    )
    SELECT
      COALESCE(bool_and(to_regclass('public.' || name) IS NOT NULL), false) AS required_views_ready,
      COALESCE(bool_and(has_table_privilege('tcdx_backend_runtime', 'public.' || name, 'SELECT')), false) AS backend_select_ready,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS backend_runtime_can_login,
      false AS legacy_refresh_function_present
    FROM required_views
  `);
  return result.rows[0] || {};
}

function statePasses(state) {
  return (
    state.required_views_ready === true &&
    state.backend_select_ready === true &&
    state.backend_runtime_can_login === false
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
    const error = new Error(`post lifecycle checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`post lifecycle ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`post lifecycle ledger has unsupported status ${state}: ${migration.id}`);
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
      if (!statePasses(current)) throw new Error('post lifecycle postconditions failed for applied migration');
    } else {
      process.stdout.write('postconditions_deferred_until_apply=true\n');
    }
    process.stdout.write(`checksum=${migration.checksum}\n`);
    process.stdout.write('POST_LIFECYCLE_RUNTIME_CONSUMERS_PREFLIGHT_PASS\n');
  } finally {
    await client.end();
  }
}

async function apply() {
  const migration = readMigration();
  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now();
  let ledgerWritten = false;
  await client.connect();
  try {
    await ensureSchemaMigrations(client);
    await requireBaseSchema(client);
    const state = await readLedgerState(client, migration);
    if (state !== 'already_applied') {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO schema_migrations (migration_id, checksum, applied_by, status, details)
         VALUES ($1, $2, current_user, 'running', '{}'::jsonb)
         ON CONFLICT (migration_id)
         DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = current_user, status = 'running', details = '{}'::jsonb`,
        [migration.id, migration.checksum]
      );
      ledgerWritten = true;
      await client.query(unwrapTransaction(migration.sql));
      const current = await fetchCurrentState(client);
      if (!statePasses(current)) {
        printState(current);
        throw new Error('post lifecycle postconditions failed after apply');
      }
      await client.query(
        `UPDATE schema_migrations
         SET status = 'applied', applied_at = now(), duration_ms = $2, details = $3::jsonb
         WHERE migration_id = $1`,
        [
          migration.id,
          Date.now() - started,
          JSON.stringify({ required_views_ready: true }),
        ]
      );
      await client.query('COMMIT');
    }
    const finalState = await fetchCurrentState(client);
    printState(finalState);
    process.stdout.write(`checksum=${migration.checksum}\n`);
    process.stdout.write(state === 'already_applied' ? 'POST_LIFECYCLE_RUNTIME_CONSUMERS_ALREADY_APPLIED\n' : 'POST_LIFECYCLE_RUNTIME_CONSUMERS_APPLY_PASS\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (ledgerWritten && !error.preserveLedger) {
      await client.query(
        `UPDATE schema_migrations
         SET status = 'failed', duration_ms = $2, details = $3::jsonb
         WHERE migration_id = $1`,
        [migration.id, Date.now() - started, JSON.stringify({ error: sanitize(error) })]
      ).catch(() => null);
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const mode = process.argv[2];
  try {
    if (mode === '--checksum') {
      const migration = readMigration();
      process.stdout.write(`${migration.checksum}\n`);
      return;
    }
    if (mode === '--preflight') return await preflight();
    if (mode === '--apply') return await apply();
    throw new Error('Usage: apply-tcdx-post-lifecycle-runtime-consumers-systemic-closeout.js --checksum|--preflight|--apply');
  } catch (error) {
    console.error(sanitize(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  LOCK_KEY,
  LOCK_NAMESPACE,
  MIGRATION,
  readMigration,
  validateSql,
};
