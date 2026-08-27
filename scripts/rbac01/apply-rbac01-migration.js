#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260827_rbac01_canonical_roles_brand01',
  file: path.join(root, 'database/migrations/20260827_rbac01_canonical_roles_brand01.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026082701;

const REQUIRED_ROLES = Object.freeze([
  'platform_admin',
  'tenant_admin',
  'auditor',
  'area_owner',
  'executive',
  'dealer',
  'operativo',
]);

const AREA_OWNER_PERMISSIONS = Object.freeze([
  'actions.manage',
  'actions.view',
  'controls.view',
  'evidence.request.read',
  'evidences.upload',
  'evidences.view',
  'health.view',
  'reports.view',
  'risk_matrix.view',
  'workflow.read',
  'workflow.transition',
]);

const EXECUTIVE_PERMISSIONS = Object.freeze([
  'actions.view',
  'assets.view',
  'audits.view',
  'controls.view',
  'dashboards.read',
  'data.catalog.read',
  'data.lineage.read',
  'data.quality.read',
  'evidences.view',
  'health.view',
  'metrics.read',
  'modules.view',
  'nonconformities.view',
  'reports.download',
  'reports.read',
  'reports.view',
  'risk_matrix.view',
  'standards.view',
  'surveys.read',
]);

const REQUIRED_PERMISSIONS = Object.freeze([
  ...new Set(['dashboards.read', ...AREA_OWNER_PERMISSIONS, ...EXECUTIVE_PERMISSIONS]),
]);

const EXPECTED_ALLOWED_ASSIGNMENTS = 1 + AREA_OWNER_PERMISSIONS.length * 2 + EXECUTIVE_PERMISSIONS.length;

function sanitize(error) {
  return String(error?.message || 'RBAC-01 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`RBAC-01 migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for RBAC-01 migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('RBAC-01 migration must contain one outer BEGIN/COMMIT pair');
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

async function requireTables(client) {
  const result = await client.query(`SELECT
    current_user AS migration_user,
    to_regclass('public.app_roles') IS NOT NULL AS app_roles_ready,
    to_regclass('public.permissions') IS NOT NULL AS permissions_ready,
    to_regclass('public.role_permissions') IS NOT NULL AS role_permissions_ready`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`RBAC-01 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function requireColumnsAndConstraints(client) {
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('app_roles','role_key'),
        ('app_roles','display_name'),
        ('app_roles','description'),
        ('app_roles','role_level'),
        ('app_roles','is_system'),
        ('app_roles','is_active'),
        ('permissions','permission_key'),
        ('role_permissions','role_key'),
        ('role_permissions','permission_key'),
        ('role_permissions','is_allowed'),
        ('role_permissions','updated_at')
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
      COALESCE(bool_and(ready), false) AS required_columns_ready,
      EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'app_roles'
          AND i.indisunique
          AND (
            SELECT array_agg(a.attname::text ORDER BY k.ord)
            FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
          ) = ARRAY['role_key']::text[]
      ) AS app_roles_role_key_unique_ready,
      EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'role_permissions'
          AND i.indisunique
          AND (
            SELECT array_agg(a.attname::text ORDER BY k.ord)
            FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
          ) = ARRAY['role_key','permission_key']::text[]
      ) AS role_permissions_conflict_target_ready
    FROM column_state`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([, value]) => value !== true);
  if (failed.length) throw new Error(`RBAC-01 schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function requirePermissions(client) {
  const result = await client.query(
    `SELECT
      count(*)::int AS required_permission_count,
      array_agg(required.permission_key ORDER BY required.permission_key)
        FILTER (WHERE p.permission_key IS NULL) AS missing_permissions
    FROM unnest($1::text[]) AS required(permission_key)
    LEFT JOIN public.permissions p ON p.permission_key = required.permission_key`,
    [REQUIRED_PERMISSIONS],
  );
  const row = result.rows[0] || {};
  const missing = row.missing_permissions || [];
  process.stdout.write(`required_permissions=${row.required_permission_count}\n`);
  process.stdout.write(`missing_permissions=${missing.length ? missing.join(',') : 'none'}\n`);
  if (missing.length) throw new Error(`RBAC-01 preflight failed: missing permissions ${missing.join(', ')}`);
}

async function preflight(client) {
  await requireTables(client);
  await requireColumnsAndConstraints(client);
  await requirePermissions(client);
}

async function alreadyApplied(client, migration) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1', [migration.id]);
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return true;
  if (row.status === 'applied') {
    const error = new Error(`RBAC-01 migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditions(client) {
  const result = await client.query(
    `WITH expected_roles AS (
       SELECT unnest($1::text[]) AS role_key
     ),
     expected_assignments AS (
       SELECT 'auditor'::text AS role_key, 'dashboards.read'::text AS permission_key
       UNION ALL
       SELECT role_key, permission_key
       FROM unnest(ARRAY['area_owner','operativo']::text[]) AS roles(role_key)
       CROSS JOIN unnest($2::text[]) AS permissions(permission_key)
       UNION ALL
       SELECT 'executive'::text AS role_key, permission_key
       FROM unnest($3::text[]) AS permissions(permission_key)
     )
     SELECT
       (
         SELECT count(*)::int
         FROM expected_roles er
         JOIN public.app_roles ar ON ar.role_key = er.role_key
       ) AS canonical_role_count,
       (
         SELECT count(*)::int
         FROM expected_assignments ea
         JOIN public.role_permissions rp
           ON rp.role_key = ea.role_key
          AND rp.permission_key = ea.permission_key
          AND rp.is_allowed = true
       ) AS expected_allowed_assignment_count`,
    [REQUIRED_ROLES, AREA_OWNER_PERMISSIONS, EXECUTIVE_PERMISSIONS],
  );
  const row = result.rows[0] || {};
  const details = {
    canonical_role_count: row.canonical_role_count,
    expected_allowed_assignment_count: row.expected_allowed_assignment_count,
  };
  if (row.canonical_role_count !== REQUIRED_ROLES.length) {
    throw new Error(`RBAC-01 postcondition failed: ${JSON.stringify(details)}`);
  }
  if (row.expected_allowed_assignment_count !== EXPECTED_ALLOWED_ASSIGNMENTS) {
    throw new Error(`RBAC-01 postcondition failed: ${JSON.stringify(details)}`);
  }
  return {
    ...details,
    expected_roles: REQUIRED_ROLES.length,
    expected_allowed_assignments: EXPECTED_ALLOWED_ASSIGNMENTS,
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
    if (lock.rows[0]?.acquired !== true) throw new Error('Another RBAC-01 migration process holds the advisory lock');
    locked = true;
    await ensureLedger(client);
    await preflight(client);
    const done = await alreadyApplied(client, migration);
    if (mode === 'preflight') {
      process.stdout.write(`RBAC-01 migration preflight OK: pending=${done ? 'none' : migration.id}\n`);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');

    await client.query('BEGIN');
    if (!done) {
      await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
        VALUES ($1,$2,current_user,'running',$3::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
      [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
      await client.query(unwrapTransaction(migration.sql));
    }
    const details = await postconditions(client);
    await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`RBAC-01 migration applied: ${done ? 'already_applied' : migration.id}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger) {
      await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
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
