#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260901_hotfix_postdeploy01_ai_view_rbac',
  file: path.join(root, 'database/migrations/20260901_hotfix_postdeploy01_ai_view_rbac.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026090104;
const TENANT_AI_VIEW_ROLES = Object.freeze(['admin', 'tenant_admin', 'auditor']);
const PLATFORM_AI_VIEW_ROLES = Object.freeze(['platform_admin', 'superadmin', 'super_admin', 'global_admin', 'admin_global', 'owner']);
const ALLOWED_AI_VIEW_ROLES = Object.freeze([...TENANT_AI_VIEW_ROLES, ...PLATFORM_AI_VIEW_ROLES]);

function sanitize(error) {
  return String(error?.message || 'HOTFIX-POSTDEPLOY-01 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\binsert\s+into\s+(?:public\.)?role_permissions\b/,
    /\bon\s+conflict\s*\(\s*role_key\s*,\s*permission_key\s*\)\s+do\s+update\b/,
    /'ai\.view'/,
    /'admin'/,
    /'tenant_admin'/,
    /'auditor'/,
    /unauthorized roles have ai\.view/,
  ];
  const forbidden = [
    /\binsert\s+into\s+(?:public\.)?(users|app_roles|permissions|tenant_contracts|tenant_subscriptions|tenant_subscription_addons|commercial_plans|commercial_plan_versions|plan_version_modules|plan_version_addons|commercial_technical_capabilities)\b/,
    /\bupdate\s+(?:public\.)?(users|app_roles|permissions|tenant_contracts|tenant_subscriptions|tenant_subscription_addons|commercial_plans|commercial_plan_versions|plan_version_modules|plan_version_addons|commercial_technical_capabilities)\b/,
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\balter\s+\b/,
    /\bai_plan\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`HOTFIX-POSTDEPLOY-01 migration contains forbidden SQL scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`HOTFIX-POSTDEPLOY-01 migration missing expected SQL operation/token: ${missing}`);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`HOTFIX-POSTDEPLOY-01 migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for HOTFIX-POSTDEPLOY-01 migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('HOTFIX-POSTDEPLOY-01 migration must contain one outer BEGIN/COMMIT pair');
  }
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

function boolValue(value) {
  return value === true || value === 'true';
}

function numberValue(value) {
  return Number(value || 0);
}

function normalizeState(row = {}) {
  return {
    ai_permission_active: boolValue(row.ai_permission_active),
    ai_compliance_permission_canonical: boolValue(row.ai_compliance_permission_canonical),
    tenant_expected_role_count: numberValue(row.tenant_expected_role_count),
    tenant_expected_ai_view_count: numberValue(row.tenant_expected_ai_view_count),
    unauthorized_ai_view_role_count: numberValue(row.unauthorized_ai_view_role_count),
    user_mutation_count: 0,
    commercial_mutation_count: 0,
  };
}

function isPostconditionSatisfied(state) {
  const normalized = normalizeState(state);
  return (
    normalized.ai_permission_active === true &&
    normalized.ai_compliance_permission_canonical === true &&
    normalized.tenant_expected_role_count === TENANT_AI_VIEW_ROLES.length &&
    normalized.tenant_expected_ai_view_count === TENANT_AI_VIEW_ROLES.length &&
    normalized.unauthorized_ai_view_role_count === 0
  );
}

function isRepairableState(state) {
  const normalized = normalizeState(state);
  return (
    normalized.ai_permission_active === true &&
    normalized.ai_compliance_permission_canonical === true &&
    normalized.tenant_expected_role_count === TENANT_AI_VIEW_ROLES.length &&
    normalized.tenant_expected_ai_view_count >= 0 &&
    normalized.tenant_expected_ai_view_count < TENANT_AI_VIEW_ROLES.length &&
    normalized.unauthorized_ai_view_role_count === 0
  );
}

function assertPreflightState(state) {
  if (isPostconditionSatisfied(state) || isRepairableState(state)) return;
  throw new Error(`HOTFIX-POSTDEPLOY-01 preflight failed: unsupported RBAC state ${JSON.stringify(normalizeState(state))}`);
}

function assertPostconditions(state) {
  if (isPostconditionSatisfied(state)) return normalizeState(state);
  throw new Error(`HOTFIX-POSTDEPLOY-01 postcondition failed: ${JSON.stringify(normalizeState(state))}`);
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
    const error = new Error(`HOTFIX-POSTDEPLOY-01 migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`HOTFIX-POSTDEPLOY-01 migration ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`HOTFIX-POSTDEPLOY-01 migration ledger has unsupported status ${state}: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
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
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('app_roles','role_key'),
        ('app_roles','is_active'),
        ('permissions','permission_key'),
        ('permissions','is_active'),
        ('role_permissions','role_key'),
        ('role_permissions','permission_key'),
        ('role_permissions','is_allowed'),
        ('role_permissions','updated_at'),
        ('commercial_technical_capabilities','capability_key'),
        ('commercial_technical_capabilities','required_permission'),
        ('commercial_technical_capabilities','status'),
        ('schema_migrations','migration_id'),
        ('schema_migrations','checksum'),
        ('schema_migrations','applied_at'),
        ('schema_migrations','applied_by'),
        ('schema_migrations','duration_ms'),
        ('schema_migrations','status'),
        ('schema_migrations','details')
    ),
    column_state AS (
      SELECT rc.table_name, rc.column_name, (c.column_name IS NOT NULL) AS ready
      FROM required_columns rc
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = rc.table_name
       AND c.column_name = rc.column_name
    )
    SELECT
      current_user AS migration_user,
      to_regclass('public.app_roles') IS NOT NULL AS app_roles_ready,
      to_regclass('public.permissions') IS NOT NULL AS permissions_ready,
      to_regclass('public.role_permissions') IS NOT NULL AS role_permissions_ready,
      to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_technical_capabilities_ready,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready
    FROM column_state`);

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`HOTFIX-POSTDEPLOY-01 schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function fetchCurrentState(client) {
  const result = await client.query(
    `SELECT
       EXISTS (
         SELECT 1
         FROM permissions
         WHERE permission_key = 'ai.view'
           AND is_active IS DISTINCT FROM FALSE
       ) AS ai_permission_active,
       EXISTS (
         SELECT 1
         FROM commercial_technical_capabilities
         WHERE capability_key = 'ai.compliance'
           AND status = 'active'
           AND required_permission = 'ai.view'
       ) AS ai_compliance_permission_canonical,
       (
         SELECT COUNT(*)::int
         FROM app_roles
         WHERE role_key = ANY($1::text[])
           AND is_active IS DISTINCT FROM FALSE
       ) AS tenant_expected_role_count,
       (
         SELECT COUNT(*)::int
         FROM app_roles ar
         JOIN role_permissions rp
           ON rp.role_key = ar.role_key
          AND rp.permission_key = 'ai.view'
          AND rp.is_allowed = true
         WHERE ar.role_key = ANY($1::text[])
           AND ar.is_active IS DISTINCT FROM FALSE
       ) AS tenant_expected_ai_view_count,
       (
         SELECT COUNT(*)::int
         FROM role_permissions rp
         JOIN app_roles ar
           ON ar.role_key = rp.role_key
          AND ar.is_active IS DISTINCT FROM FALSE
         WHERE rp.permission_key = 'ai.view'
           AND rp.is_allowed = true
           AND NOT (rp.role_key = ANY($2::text[]))
       ) AS unauthorized_ai_view_role_count`,
    [TENANT_AI_VIEW_ROLES, ALLOWED_AI_VIEW_ROLES],
  );
  return result.rows[0] || {};
}

async function migrationState(client, migration) {
  const result = await client.query('SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1', [migration.id]);
  return migrationStateFromRows(result.rows, migration);
}

async function preflight(client, migration) {
  await requireBaseSchema(client);
  const state = await migrationState(client, migration);
  process.stdout.write(`migration_state=${state}\n`);
  assertMigrationStateIsSafe(state, migration);
  const current = await fetchCurrentState(client);
  for (const [key, value] of Object.entries(normalizeState(current))) process.stdout.write(`${key.toUpperCase()}=${value}\n`);
  assertPreflightState(current);
  if (state === 'already_applied') assertPostconditions(current);
  process.stdout.write(`HOTFIX_POSTDEPLOY_01_PREFLIGHT_OK pending=${state === 'pending' ? migration.id : 'none'}\n`);
  return state === 'already_applied';
}

async function run(mode) {
  const migration = readMigration();
  if (mode === 'checksum') {
    process.stdout.write(`${migration.id} checksum=${migration.checksum}\n`);
    return;
  }

  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now();
  let locked = false;
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) throw new Error('Another HOTFIX-POSTDEPLOY-01 migration process holds the advisory lock');
    locked = true;

    if (mode === 'apply') await ensureSchemaMigrations(client);
    const done = await preflight(client, migration);
    if (mode === 'preflight') return;
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');
    if (done) {
      process.stdout.write('HOTFIX-POSTDEPLOY-01 migration applied: already_applied\n');
      return;
    }

    await client.query('BEGIN');
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
      VALUES ($1,$2,current_user,'running',$3::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
    [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
    await client.query(unwrapTransaction(migration.sql));
    const details = assertPostconditions(await fetchCurrentState(client));
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`HOTFIX-POSTDEPLOY-01 migration applied: ${migration.id}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger && mode === 'apply') {
      await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
        VALUES ($1,$2,current_user,'failed',$3::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='failed',details=EXCLUDED.details`,
      [migration.id, migration.checksum, JSON.stringify({ error: sanitize(error) })]).catch(() => null);
    }
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1,$2)', [LOCK_NAMESPACE, LOCK_KEY]).catch(() => null);
    await client.end().catch(() => null);
  }
}

if (require.main === module) {
  const arg = process.argv[2] || '--preflight';
  run(arg.replace(/^--/, '')).catch((error) => {
    console.error(`ERROR: ${sanitize(error)}`);
    process.exit(1);
  });
}

module.exports = {
  run,
  _private: {
    ALLOWED_AI_VIEW_ROLES,
    PLATFORM_AI_VIEW_ROLES,
    TENANT_AI_VIEW_ROLES,
    assertPostconditions,
    assertPreflightState,
    isPostconditionSatisfied,
    isRepairableState,
    migrationStateFromRows,
    normalizeState,
  },
};
