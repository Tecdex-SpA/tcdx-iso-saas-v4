#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260911_tcdx_control_lifecycle_systemic_closeout',
  file: path.join(root, 'database/migrations/20260911_tcdx_control_lifecycle_systemic_closeout.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091101;

function sanitize(error) {
  return String(error?.message || 'control lifecycle systemic closeout migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bcreate\s+or\s+replace\s+function\s+public\.tcdx_effective_control_catalog\b/,
    /\bcc\.tenant_id\s+is\s+null\b/,
    /\bcc\.tenant_id\s*=\s*normalized\.tenant_id\b/,
    /\binsert\s+into\s+tenant_applicable_controls\b/,
    /\bbackfill_from_effective_control_catalog\b/,
    /\bgrant\s+execute\s+on\s+function\s+public\.tcdx_effective_control_catalog\b[\s\S]*\bto\s+tcdx_backend_runtime\b/,
    /\bpg_try_advisory_xact_lock\(844332,\s*2026091101\)/,
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
    /\bupdate\s+tenant_controls\b[\s\S]*\bscore\s*=\s*0\b/,
    /\binsert\s+into\s+tenant_controls\b[\s\S]*\b0::numeric\b/,
    /\balter\s+role\s+tcdx_backend_runtime\b[\s\S]*\blogin\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`control lifecycle SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`control lifecycle SQL missing required token: ${missing}`);
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
    throw new Error('MIGRATION_DATABASE_URL is required for control lifecycle systemic closeout');
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
        ('tenants'), ('tenant_standards'), ('tenant_standard_operations'),
        ('tenant_operations'), ('controls_catalog'), ('controls_catalog_standards'),
        ('tenant_controls'), ('tenant_applicable_controls'), ('metric_snapshots'),
        ('schema_migrations')
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
    throw new Error('control lifecycle closeout base preflight failed');
  }
}

async function fetchCurrentState(client) {
  const result = await client.query(`
    SELECT
      to_regprocedure('public.tcdx_effective_control_catalog(uuid,text,text)') IS NOT NULL AS effective_catalog_function,
      has_function_privilege('tcdx_backend_runtime', 'public.tcdx_effective_control_catalog(uuid,text,text)', 'EXECUTE') AS backend_function_execute,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS backend_runtime_can_login,
      (
        SELECT COUNT(*)::int
        FROM tenant_applicable_controls
        WHERE source = 'control_lifecycle_backfill'
          AND applicability_score IS NOT NULL
      ) AS backfill_invented_scores,
      (
        SELECT COUNT(*)::int
        FROM tenant_controls
        WHERE metadata->>'source' = 'tcdx_control_lifecycle_systemic_closeout'
          AND score = 0
      ) AS tenant_control_invented_scores,
      (
        SELECT COUNT(*)::int
        FROM (
          SELECT tenant_id, tenant_control_id, COALESCE(standard_code, ''), COUNT(*)::int AS duplicates
          FROM tenant_applicable_controls
          WHERE tenant_control_id IS NOT NULL
            AND source = 'control_lifecycle_backfill'
          GROUP BY tenant_id, tenant_control_id, COALESCE(standard_code, '')
          HAVING COUNT(*) > 1
        ) d
      ) AS duplicate_backfill_applicability
  `);
  return result.rows[0] || {};
}

function statePasses(state) {
  return (
    state.effective_catalog_function === true &&
    state.backend_function_execute === true &&
    state.backend_runtime_can_login === false &&
    Number(state.backfill_invented_scores || 0) === 0 &&
    Number(state.tenant_control_invented_scores || 0) === 0 &&
    Number(state.duplicate_backfill_applicability || 0) === 0
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
    const error = new Error(`control lifecycle checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`control lifecycle ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`control lifecycle ledger has unsupported status ${state}: ${migration.id}`);
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
      if (!statePasses(current)) throw new Error('control lifecycle postconditions failed for applied migration');
    }
    process.stdout.write('TCDX_CONTROL_LIFECYCLE_PREFLIGHT_OK\n');
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
      if (!statePasses(current)) throw new Error('control lifecycle postconditions failed for applied migration');
      process.stdout.write('TCDX_CONTROL_LIFECYCLE_APPLY_OK already_applied=true\n');
      return;
    }

    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1,$2) AS locked', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.locked !== true) throw new Error('control lifecycle runner lock not available');
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
    if (!statePasses(current)) throw new Error('control lifecycle postconditions failed after apply');
    await client.query(
      `UPDATE schema_migrations
       SET status = 'applied', applied_at = now(), duration_ms = $2, details = $3::jsonb
       WHERE migration_id = $1`,
      [migration.id, Date.now() - started, JSON.stringify(current)]
    );
    await client.query('COMMIT');
    process.stdout.write('TCDX_CONTROL_LIFECYCLE_APPLY_OK\n');
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
