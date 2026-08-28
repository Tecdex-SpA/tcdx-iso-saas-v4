#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260827_rbac02_commercial_gating_normalization',
  file: path.join(root, 'database/migrations/20260827_rbac02_commercial_gating_normalization.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026082702;

function sanitize(error) {
  return String(error?.message || 'RBAC-02 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`RBAC-02 migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateMigrationSqlScope(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function validateMigrationSqlScope(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const forbidden = [
    /\binsert\s+into\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_subscriptions|tenant_feature_overrides)\b/,
    /\bupdate\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_subscriptions|tenant_feature_overrides|commercial_modules)\b/,
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\balter\s+\b/,
  ];
  if (!/\bupdate\s+(?:public\.)?commercial_technical_capabilities\b/.test(normalized)) {
    throw new Error('RBAC-02 migration must update only commercial_technical_capabilities');
  }
  if (!/capability_key\s*=\s*'core\.dashboard'/.test(normalized)) {
    throw new Error('RBAC-02 migration must target only core.dashboard');
  }
  if (!/required_permission\s*=\s*'dashboards\.read'/.test(normalized)) {
    throw new Error('RBAC-02 migration must normalize core.dashboard to dashboards.read');
  }
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`RBAC-02 migration contains forbidden SQL scope: ${violation}`);
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for RBAC-02 migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('RBAC-02 migration must contain one outer BEGIN/COMMIT pair');
  }
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function ensureLedger(client) {
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

async function requirePrerequisites(client) {
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('commercial_technical_capabilities','capability_key'),
        ('commercial_technical_capabilities','required_permission'),
        ('commercial_technical_capabilities','updated_at'),
        ('permissions','permission_key'),
        ('schema_migrations','migration_id'),
        ('schema_migrations','checksum'),
        ('schema_migrations','status'),
        ('schema_migrations','details')
    ),
    column_state AS (
      SELECT
        rc.table_name,
        rc.column_name,
        (c.column_name IS NOT NULL) AS ready
      FROM required_columns rc
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = rc.table_name
       AND c.column_name = rc.column_name
    )
    SELECT
      current_user AS migration_user,
      to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_capabilities_ready,
      to_regclass('public.permissions') IS NOT NULL AS permissions_ready,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready,
      EXISTS (
        SELECT 1 FROM public.permissions
        WHERE permission_key = 'dashboards.read'
      ) AS dashboards_read_permission_ready,
      EXISTS (
        SELECT 1 FROM public.commercial_technical_capabilities
        WHERE capability_key = 'core.dashboard'
      ) AS core_dashboard_capability_ready
    FROM column_state`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`RBAC-02 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function alreadyApplied(client, migration) {
  const result = await client.query(
    'SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1',
    [migration.id],
  );
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return true;
  if (row.status === 'applied') {
    const error = new Error(`RBAC-02 migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function preflight(client, migration) {
  await requirePrerequisites(client);
  const done = await alreadyApplied(client, migration);
  process.stdout.write(`RBAC-02 migration preflight OK: pending=${done ? 'none' : migration.id}\n`);
  return done;
}

async function postconditions(client) {
  const result = await client.query(`SELECT
    EXISTS (
      SELECT 1
      FROM public.commercial_technical_capabilities
      WHERE capability_key = 'core.dashboard'
    ) AS core_dashboard_capability_ready,
    EXISTS (
      SELECT 1
      FROM public.commercial_technical_capabilities
      WHERE capability_key = 'core.dashboard'
        AND required_permission = 'dashboards.read'
    ) AS core_dashboard_permission_ready,
    NOT EXISTS (
      SELECT 1
      FROM public.commercial_technical_capabilities
      WHERE capability_key = 'core.dashboard'
        AND required_permission IS DISTINCT FROM 'dashboards.read'
    ) AS no_core_dashboard_permission_drift,
    EXISTS (
      SELECT 1
      FROM public.permissions
      WHERE permission_key = 'dashboards.read'
    ) AS dashboards_read_permission_ready`);
  const row = result.rows[0] || {};
  if (Object.values(row).some((value) => value !== true)) {
    throw new Error(`RBAC-02 commercial gating postcondition failed: ${JSON.stringify(row)}`);
  }
  return {
    ...row,
    capability_key: 'core.dashboard',
    required_permission: 'dashboards.read',
    sql_file: path.relative(root, MIGRATION.file),
  };
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
    if (lock.rows[0]?.acquired !== true) throw new Error('Another RBAC-02 migration process holds the advisory lock');
    locked = true;

    if (mode === 'preflight') {
      await preflight(client, migration);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');

    await ensureLedger(client);
    await requirePrerequisites(client);
    const done = await alreadyApplied(client, migration);

    await client.query('BEGIN');
    if (!done) {
      await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
        VALUES ($1,$2,current_user,'running',$3::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
      [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
      await client.query(unwrapTransaction(migration.sql));
    }
    const details = await postconditions(client);
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`RBAC-02 migration applied: ${done ? 'already_applied' : migration.id}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger) {
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

const arg = process.argv[2] || '--preflight';
run(arg.replace(/^--/, '')).catch((error) => {
  console.error(`ERROR: ${sanitize(error)}`);
  process.exit(1);
});
