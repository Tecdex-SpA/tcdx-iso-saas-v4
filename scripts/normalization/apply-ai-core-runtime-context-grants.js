#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260914_ai_core_runtime_context_view_grants',
  file: path.join(root, 'database/migrations/20260914_ai_core_runtime_context_view_grants.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091401;

const AI_CORE_CONTEXT_VIEWS = Object.freeze([
  'ai_core.v_tenant_health_context',
  'ai_core.v_control_context',
  'ai_core.v_finding_context',
  'ai_core.v_kpi_context',
]);

const PREEXISTING_AI_CORE_RUNTIME_SELECT_RELATIONS = Object.freeze([
  'ai_core.external_lookup_extra_charges',
  'ai_core.external_lookup_logs',
  'ai_core.external_lookup_quota_audit',
  'ai_core.external_lookup_quotas',
  'ai_core.v_external_lookup_usage_monthly',
]);

const AUTHORIZED_AI_CORE_RUNTIME_SELECT_RELATIONS = Object.freeze([
  ...PREEXISTING_AI_CORE_RUNTIME_SELECT_RELATIONS,
  ...AI_CORE_CONTEXT_VIEWS,
]);

const authorizedAiCoreRuntimeSelectValuesSql = AUTHORIZED_AI_CORE_RUNTIME_SELECT_RELATIONS
  .map((relation) => `('${relation}')`)
  .join(',\n        ');

function sanitize(error) {
  return String(error?.message || 'AI Core runtime context grants migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function validateSql(sql) {
  const stripped = sql.replace(/--.*$/gm, '');
  const normalized = stripped.replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bpg_try_advisory_xact_lock\(844332,\s*2026091401\)/,
    /\bgrant\s+select\s+on\s+ai_core\.v_tenant_health_context\s+to\s+tcdx_backend_runtime\b/,
    /\bgrant\s+select\s+on\s+ai_core\.v_control_context\s+to\s+tcdx_backend_runtime\b/,
    /\bgrant\s+select\s+on\s+ai_core\.v_finding_context\s+to\s+tcdx_backend_runtime\b/,
    /\bgrant\s+select\s+on\s+ai_core\.v_kpi_context\s+to\s+tcdx_backend_runtime\b/,
    /\bto_regrole\('tcdx_backend_runtime'\)/,
    /\bto_regrole\('tcdx_backend_app'\)/,
    /\bto_regnamespace\('ai_core'\)/,
    /\bpg_has_role\('tcdx_backend_app',\s*'tcdx_backend_runtime',\s*'member'\)/,
    /\brolcanlogin\b[\s\S]*\btcdx_backend_runtime\b/,
  ];
  const forbidden = [
    /\bgrant\s+all\b/,
    /\bgrant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\b/,
    /\bgrant\s+[^;]*\bto\s+tcdx_backend_app\b/,
    /\bgrant\s+[^;]*\bto\s+ai_reader\b/,
    /\bgrant\s+usage\s+on\s+schema\s+ai_core\b/,
    /\balter\s+(?:view|table|schema|role)\b/,
    /\bcreate\s+(?:view|table|schema|role)\b/,
    /\bdrop\s+\b/,
    /\binsert\s+into\s+(?!schema_migrations\b)/,
    /\bdelete\s+from\b/,
    /\bupdate\s+(?!schema_migrations\b)/,
    /\btruncate\s+\b/,
    /\bowner\s+to\b/,
    /\btecdex_saas\b/,
    /\btcdx_saasv2\b/,
    /@tcdx\.local\b/,
    /@tecdex\.net\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`AI Core runtime grants SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`AI Core runtime grants SQL missing required token: ${missing}`);

  const grantMatches = normalized.match(/\bgrant\s+select\s+on\s+ai_core\.[a-z_]+\s+to\s+tcdx_backend_runtime\b/g) || [];
  if (grantMatches.length !== AI_CORE_CONTEXT_VIEWS.length) {
    throw new Error(`AI Core runtime grants SQL must contain exactly ${AI_CORE_CONTEXT_VIEWS.length} SELECT grants`);
  }
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
    throw new Error('MIGRATION_DATABASE_URL is required for AI Core runtime context grants');
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

async function requireBaseContract(client) {
  const result = await client.query(`
    WITH required_views(name) AS (
      VALUES
        ('v_tenant_health_context'),
        ('v_control_context'),
        ('v_finding_context'),
        ('v_kpi_context')
    )
    SELECT
      current_user AS migration_user,
      current_database() AS migration_database,
      to_regrole('tcdx_backend_runtime') IS NOT NULL AS runtime_role_exists,
      to_regrole('tcdx_backend_app') IS NOT NULL AS app_role_exists,
      to_regnamespace('ai_core') IS NOT NULL AS ai_core_schema_exists,
      COALESCE(bool_and(to_regclass('ai_core.' || name) IS NOT NULL), false) AS required_views_exist,
      has_schema_privilege('tcdx_backend_runtime', 'ai_core', 'USAGE') AS runtime_schema_usage,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS runtime_can_login,
      COALESCE(pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member'), false) AS app_member_of_runtime,
      (
        SELECT rolinherit
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_app'
      ) AS app_inherit
    FROM required_views
  `);
  const row = result.rows[0] || {};
  process.stdout.write(`migration_user=${row.migration_user}\n`);
  process.stdout.write(`migration_database=${row.migration_database}\n`);
  process.stdout.write(`runtime_role_exists=${row.runtime_role_exists}\n`);
  process.stdout.write(`app_role_exists=${row.app_role_exists}\n`);
  process.stdout.write(`ai_core_schema_exists=${row.ai_core_schema_exists}\n`);
  process.stdout.write(`required_views_exist=${row.required_views_exist}\n`);
  process.stdout.write(`runtime_schema_usage=${row.runtime_schema_usage}\n`);
  process.stdout.write(`runtime_can_login=${row.runtime_can_login}\n`);
  process.stdout.write(`app_member_of_runtime=${row.app_member_of_runtime}\n`);
  process.stdout.write(`app_inherit=${row.app_inherit}\n`);
  if (
    row.runtime_role_exists !== true ||
    row.app_role_exists !== true ||
    row.ai_core_schema_exists !== true ||
    row.required_views_exist !== true ||
    row.runtime_schema_usage !== true ||
    row.runtime_can_login !== false ||
    row.app_member_of_runtime !== true ||
    row.app_inherit !== true
  ) {
    throw new Error('AI Core runtime context grants base preflight failed');
  }
}

async function fetchCurrentState(client) {
  const result = await client.query(`
    WITH required_views(name) AS (
      VALUES
        ('ai_core.v_tenant_health_context'),
        ('ai_core.v_control_context'),
        ('ai_core.v_finding_context'),
        ('ai_core.v_kpi_context')
    ),
    authorized_runtime_select(name) AS (
      VALUES
        ${authorizedAiCoreRuntimeSelectValuesSql}
    ),
    view_oids AS (
      SELECT name, to_regclass(name) AS view_oid
      FROM required_views
    )
    SELECT
      has_schema_privilege('tcdx_backend_runtime', 'ai_core', 'USAGE') AS runtime_schema_usage,
      COALESCE(bool_and(view_oid IS NOT NULL), false) AS required_views_exist,
      COALESCE(bool_and(has_table_privilege('tcdx_backend_runtime', view_oid, 'SELECT')), false) AS runtime_select_ready,
      COALESCE(bool_or(has_table_privilege('tcdx_backend_runtime', view_oid, 'INSERT')), false) AS runtime_insert_any,
      COALESCE(bool_or(has_table_privilege('tcdx_backend_runtime', view_oid, 'UPDATE')), false) AS runtime_update_any,
      COALESCE(bool_or(has_table_privilege('tcdx_backend_runtime', view_oid, 'DELETE')), false) AS runtime_delete_any,
      COALESCE(bool_or(has_table_privilege('ai_reader', view_oid, 'SELECT')), false) AS ai_reader_select_any,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS runtime_can_login,
      COALESCE(pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member'), false) AS app_member_of_runtime,
      (
        SELECT rolinherit
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_app'
      ) AS app_inherit,
      COALESCE(bool_and(has_table_privilege('tcdx_backend_app', view_oid, 'SELECT')), false) AS app_inherited_select_ready,
      (
        SELECT count(*)::int
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'ai_core'
          AND c.relkind IN ('r','v','m','p')
          AND has_table_privilege('tcdx_backend_runtime', c.oid, 'SELECT')
          AND NOT EXISTS (
            SELECT 1
            FROM authorized_runtime_select allowed
            WHERE to_regclass(allowed.name) = c.oid
          )
      ) AS unexpected_runtime_ai_core_select_count
    FROM view_oids
  `);
  return result.rows[0] || {};
}

function statePasses(state) {
  return (
    state.runtime_schema_usage === true &&
    state.required_views_exist === true &&
    state.runtime_select_ready === true &&
    state.runtime_insert_any === false &&
    state.runtime_update_any === false &&
    state.runtime_delete_any === false &&
    state.ai_reader_select_any === false &&
    state.runtime_can_login === false &&
    state.app_member_of_runtime === true &&
    state.app_inherit === true &&
    state.app_inherited_select_ready === true &&
    Number(state.unexpected_runtime_ai_core_select_count || 0) === 0
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
    const error = new Error(`AI Core runtime grants checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`AI Core runtime grants ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`AI Core runtime grants ledger has unsupported status ${state}: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
}

async function readLedgerState(client, migration) {
  const result = await client.query(
    'SELECT migration_id, checksum, status FROM public.schema_migrations WHERE migration_id = $1',
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
    await requireBaseContract(client);
    const state = await readLedgerState(client, migration);
    if (state === 'already_applied') {
      const current = await fetchCurrentState(client);
      printState(current);
      if (!statePasses(current)) throw new Error('AI Core runtime grants postconditions failed for applied migration');
    } else {
      process.stdout.write('postconditions_deferred_until_apply=true\n');
    }
    process.stdout.write(`checksum=${migration.checksum}\n`);
    process.stdout.write('AI_CORE_RUNTIME_CONTEXT_GRANTS_PREFLIGHT_PASS\n');
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
    await requireBaseContract(client);
    const state = await readLedgerState(client, migration);
    if (state !== 'already_applied') {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO public.schema_migrations (migration_id, checksum, applied_by, status, details)
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
        throw new Error('AI Core runtime grants postconditions failed after apply');
      }
      await client.query(
        `UPDATE public.schema_migrations
         SET status = 'applied', applied_at = now(), duration_ms = $2, details = $3::jsonb
         WHERE migration_id = $1`,
        [
          migration.id,
          Date.now() - started,
          JSON.stringify({ ai_core_context_view_select_grants: AI_CORE_CONTEXT_VIEWS }),
        ]
      );
      await client.query('COMMIT');
    }
    const finalState = await fetchCurrentState(client);
    printState(finalState);
    process.stdout.write(`checksum=${migration.checksum}\n`);
    process.stdout.write(state === 'already_applied' ? 'AI_CORE_RUNTIME_CONTEXT_GRANTS_ALREADY_APPLIED\n' : 'AI_CORE_RUNTIME_CONTEXT_GRANTS_APPLY_PASS\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (ledgerWritten && !error.preserveLedger) {
      await client.query(
        `UPDATE public.schema_migrations
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
    throw new Error('Usage: apply-ai-core-runtime-context-grants.js --checksum|--preflight|--apply');
  } catch (error) {
    console.error(sanitize(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  AI_CORE_CONTEXT_VIEWS,
  AUTHORIZED_AI_CORE_RUNTIME_SELECT_RELATIONS,
  LOCK_KEY,
  LOCK_NAMESPACE,
  MIGRATION,
  PREEXISTING_AI_CORE_RUNTIME_SELECT_RELATIONS,
  readMigration,
  validateSql,
};
