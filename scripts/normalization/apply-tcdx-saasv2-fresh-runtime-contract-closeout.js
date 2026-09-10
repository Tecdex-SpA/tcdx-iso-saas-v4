#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260910_tcdx_saasv2_fresh_runtime_contract_closeout',
  file: path.join(root, 'database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091004;

function sanitize(error) {
  return String(error?.message || 'fresh runtime contract closeout migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1200);
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\balter\s+table\s+users\b[\s\S]*\bphone\b/,
    /\balter\s+table\s+tenants\b[\s\S]*\brut\b/,
    /\bcreate\s+table\s+if\s+not\s+exists\s+tenant_contracts\b/,
    /\bcreate\s+table\s+if\s+not\s+exists\s+dealer_tenants\b/,
    /\bcreate\s+table\s+if\s+not\s+exists\s+admin_audit_log\b/,
    /\bcreate\s+or\s+replace\s+function\s+get_user_effective_permissions\b/,
    /\bcreate\s+or\s+replace\s+function\s+user_has_permission\b/,
    /\bcreate\s+or\s+replace\s+function\s+log_admin_audit_event\b/,
    /\bcreate\s+or\s+replace\s+view\s+v_tenant_modules\b/,
    /\bcreate\s+or\s+replace\s+view\s+v_dealer_tenants\b/,
    /\bgrant\s+execute\s+on\s+function\s+user_has_permission\(uuid,\s*text\)\s+to\s+tcdx_backend_runtime\b/,
  ];
  const forbidden = [
    /\btecdex_saas\b/,
    /\btcdx_saasv2\b/,
    /\b70000000-0000-0000-0000-000000000701\b/,
    /andres\.barouh@tecdex\.net/,
    /\btruncate\s+\b/,
    /\bdrop\s+table\b/,
    /\bdrop\s+schema\b/,
    /\bdrop\s+view\b[\s\S]*\bcascade\b/,
    /grant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\b/,
    /grant\s+execute\s+on\s+all\s+functions\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`fresh runtime closeout SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`fresh runtime closeout SQL missing required token: ${missing}`);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for fresh runtime contract closeout');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('fresh runtime closeout migration must contain one outer BEGIN/COMMIT pair');
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
    required_public_relations: numberValue(row.required_public_relations),
    required_ai_core_relations: numberValue(row.required_ai_core_relations),
    required_public_columns: numberValue(row.required_public_columns),
    required_functions: numberValue(row.required_functions),
    platform_admin_has_admin_saas_manage: boolValue(row.platform_admin_has_admin_saas_manage),
    viewer_has_admin_saas_manage: boolValue(row.viewer_has_admin_saas_manage),
    backend_user_select: boolValue(row.backend_user_select),
    backend_tenant_dml: boolValue(row.backend_tenant_dml),
    backend_contract_dml: boolValue(row.backend_contract_dml),
    backend_ai_quota_dml: boolValue(row.backend_ai_quota_dml),
  };
}

function postconditionSatisfied(state) {
  const normalized = normalizeState(state);
  return (
    normalized.required_public_relations === 18 &&
    normalized.required_ai_core_relations === 5 &&
    normalized.required_public_columns === 35 &&
    normalized.required_functions === 3 &&
    normalized.platform_admin_has_admin_saas_manage === true &&
    normalized.viewer_has_admin_saas_manage === false &&
    normalized.backend_user_select === true &&
    normalized.backend_tenant_dml === true &&
    normalized.backend_contract_dml === true &&
    normalized.backend_ai_quota_dml === true
  );
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
    const error = new Error(`fresh runtime closeout checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`fresh runtime closeout ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`fresh runtime closeout ledger has unsupported status ${state}: ${migration.id}`);
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
        ('schema_migrations','migration_id'),
        ('users','id'),
        ('users','email'),
        ('users','role'),
        ('users','effective_role'),
        ('tenants','id'),
        ('tenants','slug'),
        ('tenants','service_status'),
        ('app_roles','role_key'),
        ('permissions','permission_key'),
        ('role_permissions','role_key'),
        ('role_permissions','permission_key')
    )
    SELECT
      current_user AS migration_user,
      COALESCE(bool_and(c.column_name IS NOT NULL), false) AS base_columns_ready,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready
    FROM required_columns rc
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = rc.table_name
     AND c.column_name = rc.column_name`);

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`fresh runtime closeout base preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function fetchCurrentState(client) {
  const result = await client.query(`WITH
    public_relations(name) AS (
      VALUES
        ('tenant_contracts'), ('dealer_tenants'), ('admin_audit_log'), ('v_dealer_tenants'),
        ('v_tenant_modules'), ('v_admin_saas_summary'), ('v_tenant_contract_overview'),
        ('product_families'), ('commercial_editions'), ('commercial_modules'), ('commercial_features'),
        ('plan_version_modules'), ('plan_version_addons'), ('module_features'), ('feature_capabilities'),
        ('tenant_feature_overrides'), ('saas_price_catalog'), ('v_saas_prebilling_tenant_context')
    ),
    ai_relations(name) AS (
      VALUES
        ('external_lookup_quotas'), ('external_lookup_logs'), ('external_lookup_quota_audit'),
        ('external_lookup_extra_charges'), ('v_external_lookup_usage_monthly')
    ),
    public_columns(table_name, column_name) AS (
      VALUES
        ('users','phone'), ('users','job_title'), ('users','avatar'),
        ('tenants','rut'), ('tenants','business'), ('tenants','address'), ('tenants','branches'),
        ('tenants','logo'), ('tenants','logo_url'), ('tenants','ai_enabled'),
        ('tenants','ai_web_enabled'), ('tenants','ai_report_enabled'), ('tenants','ai_auditor_enabled'),
        ('tenants','ai_monthly_quota'), ('tenants','ai_quota_used'), ('tenants','ai_features_json'),
        ('commercial_plans','description'), ('commercial_plans','status'), ('commercial_plans','updated_at'),
        ('commercial_plan_versions','plan_id'), ('commercial_plan_versions','updated_at'), ('commercial_plan_versions','metadata'),
        ('commercial_technical_capabilities','id'), ('commercial_technical_capabilities','dependencies'), ('commercial_technical_capabilities','metadata'),
        ('saas_modules','metadata'), ('saas_modules','created_at'),
        ('tenant_contracts','billing_currency'), ('tenant_contracts','commercial_notes'), ('tenant_contracts','billing_notes'),
        ('tenant_contracts','max_active_standards'), ('tenant_contracts','max_premium_modules'), ('tenant_contracts','external_lookup_quota'),
        ('tenant_subscription_addons','tenant_subscription_id'), ('tenant_subscription_addons','updated_at')
    )
    SELECT
      (SELECT count(*)::int FROM public_relations WHERE to_regclass('public.' || name) IS NOT NULL) AS required_public_relations,
      (SELECT count(*)::int FROM ai_relations WHERE to_regclass('ai_core.' || name) IS NOT NULL) AS required_ai_core_relations,
      (
        SELECT count(*)::int
        FROM public_columns pc
        JOIN information_schema.columns c
          ON c.table_schema = 'public'
         AND c.table_name = pc.table_name
         AND c.column_name = pc.column_name
      ) AS required_public_columns,
      (
        SELECT count(*)::int
        FROM unnest(ARRAY[
          'public.get_user_effective_permissions(uuid)',
          'public.user_has_permission(uuid,text)',
          'public.log_admin_audit_event(uuid,text,uuid,text,uuid,jsonb)'
        ]) AS f(signature)
        WHERE to_regprocedure(signature) IS NOT NULL
      ) AS required_functions,
      EXISTS (
        SELECT 1 FROM role_permissions
        WHERE role_key = 'platform_admin'
          AND permission_key = 'admin_saas.manage'
          AND is_allowed = true
      ) AS platform_admin_has_admin_saas_manage,
      EXISTS (
        SELECT 1 FROM role_permissions
        WHERE role_key = 'viewer'
          AND permission_key = 'admin_saas.manage'
          AND is_allowed = true
      ) AS viewer_has_admin_saas_manage,
      has_table_privilege('tcdx_backend_runtime', 'users', 'SELECT') AS backend_user_select,
      has_table_privilege('tcdx_backend_runtime', 'tenants', 'UPDATE') AS backend_tenant_dml,
      has_table_privilege('tcdx_backend_runtime', 'tenant_contracts', 'INSERT') AS backend_contract_dml,
      has_table_privilege('tcdx_backend_runtime', 'ai_core.external_lookup_quotas', 'UPDATE') AS backend_ai_quota_dml`);
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
  if (state === 'already_applied') {
    const current = await fetchCurrentState(client);
    for (const [key, value] of Object.entries(normalizeState(current))) process.stdout.write(`${key.toUpperCase()}=${value}\n`);
    if (!postconditionSatisfied(current)) throw new Error(`fresh runtime closeout postcondition failed: ${JSON.stringify(normalizeState(current))}`);
  }
  process.stdout.write(`FRESH_RUNTIME_CONTRACT_PREFLIGHT_OK pending=${state === 'pending' ? migration.id : 'none'}\n`);
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
    if (lock.rows[0]?.acquired !== true) throw new Error('Another fresh runtime contract closeout migration process holds the advisory lock');
    locked = true;

    if (mode === 'apply') await ensureSchemaMigrations(client);
    const done = await preflight(client, migration);
    if (mode === 'preflight') return;
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');
    if (done) {
      process.stdout.write('FRESH_RUNTIME_CONTRACT_MIGRATION_APPLIED already_applied\n');
      return;
    }

    await client.query('BEGIN');
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
      VALUES ($1,$2,current_user,'running',$3::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
    [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
    await client.query(unwrapTransaction(migration.sql));
    const current = await fetchCurrentState(client);
    if (!postconditionSatisfied(current)) {
      throw new Error(`fresh runtime closeout postcondition failed: ${JSON.stringify(normalizeState(current))}`);
    }
    const details = normalizeState(current);
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`FRESH_RUNTIME_CONTRACT_MIGRATION_APPLIED ${migration.id}\n`);
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
    migrationStateFromRows,
    normalizeState,
    postconditionSatisfied,
  },
};
