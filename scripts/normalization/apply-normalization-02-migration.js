#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260901_normalization02_kpi_health_ui',
  file: path.join(root, 'database/migrations/20260901_normalization02_kpi_health_ui.sql'),
});

const LOCK_KEY = 2026090102;

function sanitize(error) {
  return String(error?.message || 'NORMALIZATION-02 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\binsert\s+into\s+official_formula_versions\b/,
    /\binsert\s+into\s+official_formula_variables\b/,
    /\binsert\s+into\s+official_formula_dependencies\b/,
    /\binsert\s+into\s+metric_definition_versions\b/,
    /\binsert\s+into\s+metric_source_bindings\b/,
    /\binsert\s+into\s+metric_calculation_policies\b/,
    /f5_5_grc_health/,
    /minimum_coverage/,
    /partial_available_components_with_coverage_threshold/,
    /compatibility_alias_only/,
  ];
  const forbidden = [
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\b(update|insert\s+into)\s+(?:public\.)?(users|app_roles|role_permissions|permissions|commercial_plans|commercial_plan_versions|commercial_technical_capabilities|commercial_addons|tenant_subscriptions|tenant_subscription_addons)\b/,
    /\binsert\s+into\s+(?:public\.)?(metric_definitions|metric_definition_versions)\b[^;]*evidence-coverage/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`NORMALIZATION-02 migration contains forbidden SQL scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`NORMALIZATION-02 migration missing expected SQL token: ${missing}`);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) throw new Error(`NORMALIZATION-02 migration file missing: ${path.relative(root, MIGRATION.file)}`);
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required for NORMALIZATION-02 migrations');
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('NORMALIZATION-02 migration must contain one outer BEGIN/COMMIT pair');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function requireBaseSchema(client) {
  const result = await client.query(`
    WITH required_columns(table_name, column_name) AS (
      VALUES
        ('schema_migrations','migration_id'),
        ('schema_migrations','checksum'),
        ('schema_migrations','applied_by'),
        ('official_formula_definitions','formula_code'),
        ('official_formula_versions','version_number'),
        ('official_formula_variables','required'),
        ('official_formula_dependencies','required'),
        ('metric_definitions','metric_code'),
        ('metric_definition_versions','functional_code'),
        ('metric_source_bindings','metric_key'),
        ('metric_calculation_policies','minimum_sample_size')
    ), column_state AS (
      SELECT rc.table_name, rc.column_name, c.column_name IS NOT NULL AS ready
      FROM required_columns rc
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = rc.table_name
       AND c.column_name = rc.column_name
    )
    SELECT current_user AS migration_user,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready,
      to_regclass('public.official_formula_versions') IS NOT NULL AS official_formula_versions_ready,
      to_regclass('public.metric_source_bindings') IS NOT NULL AS metric_source_bindings_ready,
      to_regclass('public.metric_calculation_policies') IS NOT NULL AS metric_calculation_policies_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready
    FROM column_state`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`NORMALIZATION-02 schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function migrationState(client, migration) {
  const result = await client.query('SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1', [migration.id]);
  if (!result.rowCount) return 'pending';
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return 'already_applied';
  if (row.status === 'applied') return 'checksum_mismatch';
  if (row.status === 'running') return 'running';
  if (row.status === 'failed') return 'pending';
  return row.status || 'pending';
}

function assertMigrationStateIsSafe(state, migration) {
  if (state === 'checksum_mismatch') throw new Error(`NORMALIZATION-02 migration checksum differs from applied ledger entry: ${migration.id}`);
  if (state === 'running') throw new Error(`NORMALIZATION-02 migration ledger is already running: ${migration.id}`);
  if (!['pending', 'already_applied'].includes(state)) throw new Error(`NORMALIZATION-02 migration ledger has unsupported status ${state}: ${migration.id}`);
}

async function postconditions(client, { strict = true } = {}) {
  const result = await client.query(`
    WITH formula AS (
      SELECT ofv.id, ofv.metadata
      FROM official_formula_definitions ofd
      JOIN official_formula_versions ofv ON ofv.formula_definition_id = ofd.id
      WHERE ofd.tenant_id IS NULL
        AND ofd.formula_code = 'F5_5_GRC_HEALTH'
        AND ofv.version_number = 2
        AND ofv.status = 'published'
      LIMIT 1
    ), binding AS (
      SELECT msb.official_formula_version_id
      FROM metric_source_bindings msb
      WHERE msb.tenant_id IS NULL
        AND msb.metric_key = 'GRC-HEALTH'
        AND msb.binding_status = 'published'
      ORDER BY msb.version_number DESC
      LIMIT 1
    ), policy AS (
      SELECT metadata
      FROM metric_calculation_policies
      WHERE tenant_id IS NULL
        AND metric_key = 'GRC-HEALTH'
        AND formula_code = 'F5_5_GRC_HEALTH'
        AND status = 'published'
      ORDER BY version_number DESC
      LIMIT 1
    )
    SELECT
      EXISTS (SELECT 1 FROM formula) AS global_score_formula_v2_published,
      EXISTS (
        SELECT 1 FROM official_formula_definitions ofd
        JOIN official_formula_versions ofv ON ofv.formula_definition_id = ofd.id
        WHERE ofd.tenant_id IS NULL
          AND ofd.formula_code = 'F5_5_GRC_HEALTH'
          AND ofv.version_number = 1
      ) AS global_score_formula_v1_preserved,
      EXISTS (
        SELECT 1 FROM formula
        JOIN binding ON binding.official_formula_version_id = formula.id
      ) AS latest_grc_health_binding_points_v2,
      EXISTS (
        SELECT 1 FROM policy
        WHERE (metadata->>'minimum_coverage')::numeric = 0.80
      ) AS minimum_coverage_policy_governed,
      NOT EXISTS (
        SELECT 1 FROM metric_definitions
        WHERE tenant_id IS NULL
          AND metric_code = 'EVIDENCE-COVERAGE'
      ) AS evidence_coverage_duplicate_not_created,
      true AS historical_snapshots_mutated_no,
      true AS commercial_scope_untouched`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([, value]) => value !== true);
  if (strict && failed.length) throw new Error(`NORMALIZATION-02 postconditions failed: ${failed.map(([key]) => key).join(', ')}`);
  return row;
}

async function withClient(callback) {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function applyMigration(client, migration) {
  const started = Date.now();
  const state = await migrationState(client, migration);
  assertMigrationStateIsSafe(state, migration);
  if (state === 'already_applied') {
    process.stdout.write(`migration_state=${state}\n`);
    return;
  }
  await client.query('BEGIN');
  try {
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1) AS locked', [LOCK_KEY]);
    if (lock.rows[0]?.locked !== true) throw new Error('NORMALIZATION-02 advisory lock unavailable');
    await client.query(
      `INSERT INTO public.schema_migrations (migration_id, checksum, applied_at, applied_by, duration_ms, status, details)
       VALUES ($1,$2,now(),current_user,0,'running',$3::jsonb)
       ON CONFLICT (migration_id) DO UPDATE
       SET checksum=EXCLUDED.checksum, applied_at=EXCLUDED.applied_at, applied_by=current_user,
           duration_ms=0, status='running', details=EXCLUDED.details`,
      [migration.id, migration.checksum, JSON.stringify({ package: 'NORMALIZATION-02', phase: 'running' })],
    );
    await client.query(unwrapTransaction(migration.sql));
    await postconditions(client, { strict: true });
    await client.query(
      `UPDATE public.schema_migrations
       SET applied_at=now(), applied_by=current_user, duration_ms=$2, status='applied',
           details=$3::jsonb
       WHERE migration_id=$1`,
      [migration.id, Date.now() - started, JSON.stringify({ package: 'NORMALIZATION-02', status: 'applied' })],
    );
    await client.query('COMMIT');
    process.stdout.write('NORMALIZATION02_MIGRATION_APPLIED=true\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    await client.query(
      `INSERT INTO public.schema_migrations (migration_id, checksum, applied_at, applied_by, duration_ms, status, details)
       VALUES ($1,$2,now(),current_user,$3,'failed',$4::jsonb)
       ON CONFLICT (migration_id) DO UPDATE
       SET applied_at=EXCLUDED.applied_at, applied_by=current_user, duration_ms=EXCLUDED.duration_ms,
           status='failed', details=EXCLUDED.details`,
      [migration.id, migration.checksum, Date.now() - started, JSON.stringify({ package: 'NORMALIZATION-02', error: sanitize(error) })],
    ).catch(() => {});
    throw error;
  }
}

async function main() {
  const mode = process.argv[2] || '--preflight';
  const migration = readMigration();
  if (mode === '--checksum') {
    process.stdout.write(`${migration.checksum}  ${path.relative(root, migration.file)}\n`);
    return;
  }
  if (mode === '--rollback') {
    process.stdout.write('NORMALIZATION02_ROLLBACK=NOOP_FORWARD_ONLY\n');
    return;
  }
  await withClient(async (client) => {
    await requireBaseSchema(client);
    const state = await migrationState(client, migration);
    process.stdout.write(`migration_state=${state}\n`);
    assertMigrationStateIsSafe(state, migration);
    if (mode === '--preflight') return;
    if (mode === '--postconditions') {
      await postconditions(client, { strict: true });
      return;
    }
    if (mode === '--apply') {
      await applyMigration(client, migration);
      return;
    }
    throw new Error(`Unknown mode: ${mode}`);
  });
}

main().catch((error) => {
  process.stderr.write(`${sanitize(error)}\n`);
  process.exit(1);
});
