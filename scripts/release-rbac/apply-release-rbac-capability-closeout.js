#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const { RUNTIME_ACTIVE_PERMISSIONS, CANONICAL_ROLES } = require('./release-rbac-contract');

const MIGRATION = Object.freeze({
  id: '20260910_release_rbac_capability_systemic_closeout',
  file: path.join(root, 'database/migrations/20260910_release_rbac_capability_systemic_closeout.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091005;

function sanitize(error) {
  return String(error?.message || 'release RBAC capability closeout error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function validateSql(sql) {
  const normalized = stripSqlComments(sql).replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\binsert\s+into\s+app_roles\b/,
    /\binsert\s+into\s+permissions\b/,
    /\binsert\s+into\s+role_permissions\b/,
    /\bcreate\s+or\s+replace\s+function\s+get_user_effective_permissions\b/,
    /\bcreate\s+or\s+replace\s+function\s+user_has_permission\b/,
    /\bpg_try_advisory_xact_lock\(844332,\s*2026091005\)/,
  ];
  const forbidden = [
    /\btecdex_saas\b/,
    /\btcdx_saasv2\b/,
    /\bdelete\s+from\s+users\b/,
    /\bupdate\s+users\b/,
    /\btruncate\b/,
    /\bdrop\s+table\b/,
    /\bdrop\s+schema\b/,
    /\bgrant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\b/,
    /\bgrant\s+execute\s+on\s+all\s+functions\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`RBAC closeout SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`RBAC closeout SQL missing required token: ${missing}`);
  for (const permission of RUNTIME_ACTIVE_PERMISSIONS) {
    if (!normalized.includes(`'${permission}'`)) throw new Error(`RBAC closeout SQL missing active permission ${permission}`);
  }
  for (const role of CANONICAL_ROLES) {
    if (!normalized.includes(`'${role}'`)) throw new Error(`RBAC closeout SQL missing canonical role ${role}`);
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
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required');
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('RBAC closeout migration must have one outer BEGIN/COMMIT pair');
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
  const result = await client.query(`WITH required(table_name, column_name) AS (
      VALUES
        ('users','id'),
        ('users','role'),
        ('app_roles','role_key'),
        ('permissions','permission_key'),
        ('role_permissions','role_key'),
        ('role_permissions','permission_key')
    )
    SELECT COALESCE(bool_and(c.column_name IS NOT NULL), false) AS base_schema_ready
    FROM required r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = r.table_name
     AND c.column_name = r.column_name`);
  if (result.rows[0]?.base_schema_ready !== true) throw new Error('RBAC closeout base schema missing');
}

async function migrationState(client, migration) {
  const result = await client.query('SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1', [migration.id]);
  if (!result.rows.length) return 'pending';
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return 'already_applied';
  if (row.status === 'applied') return 'checksum_mismatch';
  if (row.status === 'running') return 'running';
  if (row.status === 'failed') return 'pending';
  return row.status || 'pending';
}

async function postconditions(client) {
  const result = await client.query(
    `WITH required_permissions AS (
       SELECT unnest($1::text[]) AS permission_key
     ),
     required_roles AS (
       SELECT unnest($2::text[]) AS role_key
     )
     SELECT
       (SELECT count(*)::int FROM required_permissions rp LEFT JOIN permissions p USING (permission_key) WHERE p.permission_key IS NULL) AS missing_permissions,
       (SELECT count(*)::int FROM required_roles rr LEFT JOIN app_roles ar USING (role_key) WHERE ar.role_key IS NULL) AS missing_roles,
       (SELECT count(*)::int FROM commercial_technical_capabilities ctc LEFT JOIN permissions p ON p.permission_key = ctc.required_permission WHERE ctc.status = 'active' AND ctc.required_permission IS NOT NULL AND p.permission_key IS NULL) AS capability_orphans,
       (SELECT count(*)::int FROM role_permissions rp LEFT JOIN app_roles ar USING (role_key) WHERE ar.role_key IS NULL) AS role_orphans,
       (SELECT count(*)::int FROM role_permissions rp LEFT JOIN permissions p USING (permission_key) WHERE p.permission_key IS NULL) AS permission_orphans,
       EXISTS (SELECT 1 FROM role_permissions WHERE role_key='auditor' AND permission_key='audit.review' AND is_allowed=true) AS auditor_audit_review,
       EXISTS (SELECT 1 FROM role_permissions WHERE role_key='viewer' AND permission_key='actions.manage' AND is_allowed=true) AS viewer_action_write,
       EXISTS (SELECT 1 FROM role_permissions WHERE role_key='dealer' AND permission_key='controls.view' AND is_allowed=true) AS dealer_general_tenant
    `,
    [RUNTIME_ACTIVE_PERMISSIONS, CANONICAL_ROLES]
  );
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  if (Number(row.missing_permissions) !== 0) throw new Error('RBAC closeout postcondition failed: missing permissions');
  if (Number(row.missing_roles) !== 0) throw new Error('RBAC closeout postcondition failed: missing roles');
  if (Number(row.capability_orphans) !== 0) throw new Error('RBAC closeout postcondition failed: capability permission orphans');
  if (Number(row.role_orphans) !== 0) throw new Error('RBAC closeout postcondition failed: role orphans');
  if (Number(row.permission_orphans) !== 0) throw new Error('RBAC closeout postcondition failed: permission orphans');
  if (row.auditor_audit_review !== true) throw new Error('RBAC closeout postcondition failed: auditor audit.review');
  if (row.viewer_action_write === true) throw new Error('RBAC closeout postcondition failed: viewer mutation grant');
  if (row.dealer_general_tenant === true) throw new Error('RBAC closeout postcondition failed: dealer general tenant grant');
}

async function run(mode) {
  const migration = readMigration();
  if (mode === '--checksum') {
    process.stdout.write(`${migration.id} checksum=${migration.checksum}\n`);
    return;
  }
  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now();
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) throw new Error('release RBAC closeout advisory lock unavailable');
    if (mode === '--apply') await ensureSchemaMigrations(client);
    await requireBaseSchema(client);
    const state = await migrationState(client, migration);
    process.stdout.write(`migration_state=${state}\n`);
    if (state === 'checksum_mismatch' || state === 'running') throw new Error(`unsafe migration state: ${state}`);
    if (state === 'already_applied') {
      await postconditions(client);
      return;
    }
    if (mode === '--preflight') return;
    if (mode !== '--apply') throw new Error('Use --checksum, --preflight or --apply');
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
       VALUES ($1,$2,current_user,'running',$3::jsonb)
       ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum, applied_by=current_user, status='running', details=EXCLUDED.details`,
      [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]
    );
    await client.query(unwrapTransaction(migration.sql));
    await postconditions(client);
    await client.query(
      `UPDATE schema_migrations
          SET status='applied', applied_at=now(), duration_ms=$2, details=details || $3::jsonb
        WHERE migration_id=$1`,
      [migration.id, Date.now() - started, JSON.stringify({ permissions: RUNTIME_ACTIVE_PERMISSIONS.length, roles: CANONICAL_ROLES.length })]
    );
    await client.query('COMMIT');
    process.stdout.write('RELEASE_RBAC_CAPABILITY_CLOSEOUT_APPLIED\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1,$2)', [LOCK_NAMESPACE, LOCK_KEY]).catch(() => null);
    await client.end().catch(() => null);
  }
}

run(process.argv[2] || '--checksum').catch((error) => {
  console.error(sanitize(error));
  process.exit(1);
});
