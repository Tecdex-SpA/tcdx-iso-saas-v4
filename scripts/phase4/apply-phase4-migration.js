#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const MIGRATION_ID = '20260729_phase4_commercial_product';
const MIGRATION_FILE = path.join(root, 'database/migrations/20260729_phase4_commercial_product.sql');
const ADVISORY_LOCK_NAMESPACE = 844332;
const ADVISORY_LOCK_KEY = 20260729;

function sanitizeError(error) {
  return String(error?.message || 'migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  return { sql, checksum };
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) throw new Error('MIGRATION_DATABASE_URL is required for Phase 4 DDL migrations');
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  return value;
}

function unwrapMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit < 0 || begin >= commit) throw new Error('Phase 4 migration must contain one outer BEGIN/COMMIT pair');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      migration_id text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz,
      applied_by text NOT NULL,
      duration_ms bigint NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
      status text NOT NULL CHECK (status IN ('running', 'applied', 'failed')),
      details jsonb NOT NULL DEFAULT '{}'::jsonb
    )`);
}

async function acquireLock(client) {
  const result = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  if (result.rows[0]?.acquired !== true) throw new Error('Another Phase 4 migration process holds the advisory lock');
}

async function releaseLock(client) {
  const result = await client.query('SELECT pg_advisory_unlock($1, $2) AS released', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  if (result.rows[0]?.released !== true) throw new Error('Phase 4 advisory lock was not released by this session');
}

async function preflight(client) {
  const result = await client.query(`
    SELECT
      current_user AS migration_user,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_tables,
      has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_extensions,
      EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgcrypto') AS pgcrypto_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_contracts') AS tenant_contracts_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') AS tenants_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') AS permissions_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') AS role_permissions_available`);
  const row = result.rows[0];
  const visible = {
    migration_user: row.migration_user,
    can_create_tables: row.can_create_tables === true,
    can_create_indexes: row.can_create_tables === true,
    pgcrypto_available: row.pgcrypto_available === true,
    tenant_contracts_available: row.tenant_contracts_available === true,
  };
  Object.entries(visible).forEach(([key, value]) => process.stdout.write(`${key}=${value}\n`));
  if (!visible.can_create_tables || !visible.pgcrypto_available || !row.tenants_available || !row.permissions_available || !row.role_permissions_available) {
    throw new Error('Phase 4 migration privilege preflight failed');
  }
  return visible;
}

async function alreadyApplied(client, checksum) {
  const result = await client.query('SELECT checksum, status FROM schema_migrations WHERE migration_id = $1', [MIGRATION_ID]);
  if (result.rowCount === 0) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === checksum) return true;
  if (row.status === 'applied' && row.checksum !== checksum) {
    const error = new Error('Phase 4 migration checksum differs from applied ledger entry');
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditions(client) {
  const required = [
    'product_families', 'commercial_editions', 'commercial_plans', 'commercial_plan_versions',
    'commercial_modules', 'commercial_addons', 'commercial_features', 'commercial_technical_capabilities',
    'tenant_subscriptions', 'tenant_feature_overrides', 'tenant_usage_limits', 'usage_measurements',
    'trials', 'commercial_events', 'pack_definitions', 'pack_versions', 'pack_items',
    'risk_methodology_versions', 'audit_workpaper_template_versions'
  ];
  const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [required]);
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = required.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`Phase 4 postcondition missing tables: ${missing.join(', ')}`);
  const expectedViews = ['v_commercial_plan_capabilities','v_commercial_tenant_subscription','v_commercial_tenant_modules','v_commercial_tenant_capabilities','v_commercial_tenant_health','v_tenant_commercial_entitlements'];
  const views = await client.query(`SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [expectedViews]);
  if (views.rowCount !== expectedViews.length) throw new Error('Phase 4 postcondition missing compatibility views');
  return { tables: required.length, views: views.rowCount };
}

async function run(mode) {
  const { sql, checksum } = readMigration();
  if (mode === 'checksum') {
    process.stdout.write(`${MIGRATION_ID} checksum=${checksum}\n`);
    return;
  }
  const databaseUrl = requireMigrationDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });
  const started = Date.now();
  await client.connect();
  let lockHeld = false;
  try {
    await acquireLock(client);
    lockHeld = true;
    await ensureLedger(client);
    await preflight(client);
    if (await alreadyApplied(client, checksum)) {
      process.stdout.write(`Phase 4 migration already applied: ${MIGRATION_ID}\n`);
      return;
    }
    if (mode === 'preflight') {
      process.stdout.write(`Phase 4 migration preflight OK: ${MIGRATION_ID}\n`);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');
    await client.query('BEGIN');
    await client.query(`INSERT INTO schema_migrations (migration_id, checksum, applied_by, status, details) VALUES ($1,$2,current_user,'running',$3::jsonb) ON CONFLICT (migration_id) DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = current_user, status = 'running', details = EXCLUDED.details`, [MIGRATION_ID, checksum, JSON.stringify({ file: path.relative(root, MIGRATION_FILE) })]);
    await client.query(unwrapMigrationTransaction(sql));
    const details = await postconditions(client);
    await client.query(`UPDATE schema_migrations SET applied_at = now(), applied_by = current_user, duration_ms = $2, status = 'applied', details = details || $3::jsonb WHERE migration_id = $1`, [MIGRATION_ID, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`Phase 4 migration applied: ${MIGRATION_ID} checksum=${checksum}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger) {
      await client.query(`INSERT INTO schema_migrations (migration_id, checksum, applied_by, duration_ms, status, details) VALUES ($1,$2,current_user,$3,'failed',$4::jsonb) ON CONFLICT (migration_id) DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = current_user, duration_ms = EXCLUDED.duration_ms, status = 'failed', details = EXCLUDED.details`, [MIGRATION_ID, checksum, Date.now() - started, JSON.stringify({ error: sanitizeError(error) })]).catch(() => null);
    }
    throw error;
  } finally {
    if (lockHeld) await releaseLock(client).catch((error) => process.stderr.write(`${sanitizeError(error)}\n`));
    await client.end();
  }
}

const arg = process.argv[2] || '--checksum';
run(arg.replace(/^--/, '')).catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
