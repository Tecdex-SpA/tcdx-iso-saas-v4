#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION_ID = '20260803_demo_tenant_iso_grc';
const MIGRATION_FILE = path.join(root, 'database/migrations/20260803_demo_tenant_iso_grc.sql');
const ADVISORY_LOCK_NAMESPACE = 844332;
const ADVISORY_LOCK_KEY = 2026080303;

function sanitizeError(error) {
  return String(error?.message || 'demo tenant migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .replace(/secret\s*=\s*\S+/gi, 'secret=[redacted]')
    .slice(0, 1200);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION_FILE)) throw new Error('Demo tenant migration file is missing');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  return { sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) throw new Error('MIGRATION_DATABASE_URL is required for demo tenant data migrations');
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  if (/prod|production/i.test(value) && process.env.ALLOW_DEMO_PRODUCTION_WRITE !== 'I_UNDERSTAND') {
    throw new Error('Refusing to run demo tenant migration against a production-looking database URL');
  }
  return value;
}

function unwrapMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit < 0 || begin >= commit) throw new Error('Demo migration must contain one outer BEGIN/COMMIT pair');
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

async function acquireLock(client) {
  const result = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  if (result.rows[0]?.acquired !== true) throw new Error('Another demo tenant migration process holds the advisory lock');
}

async function releaseLock(client) {
  await client.query('SELECT pg_advisory_unlock($1,$2)', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
}

async function preflight(client) {
  const result = await client.query(`SELECT
    current_database() AS database_name,
    current_user AS migration_user,
    has_schema_privilege(current_user,'public','CREATE') AS can_create_public,
    EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto') AS pgcrypto_available,
    to_regclass('public.tenants') IS NOT NULL AS tenants_available,
    to_regclass('public.users') IS NOT NULL AS users_available,
    to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_available,
    to_regclass('public.data_source_contracts') IS NOT NULL AS semantic_available,
    to_regclass('public.metric_definitions') IS NOT NULL AS metrics_available,
    to_regclass('public.dashboard_definitions') IS NOT NULL AS dashboards_available,
    to_regclass('public.report_definitions') IS NOT NULL AS reports_available`);
  const row = result.rows[0];
  const required = [
    'can_create_public',
    'pgcrypto_available',
    'tenants_available',
    'users_available',
    'commercial_available',
    'semantic_available',
    'metrics_available',
    'dashboards_available',
    'reports_available',
  ];
  for (const key of ['database_name', 'migration_user', ...required]) {
    process.stdout.write(`${key}=${row[key]}\n`);
  }
  const failed = required.filter((key) => row[key] !== true);
  if (failed.length) throw new Error(`Demo tenant migration preflight failed: ${failed.join(', ')}`);
}

async function alreadyApplied(client, checksum) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1', [MIGRATION_ID]);
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === checksum) return true;
  if (row.status === 'applied' && row.checksum !== checksum) {
    const error = new Error('Demo tenant migration checksum differs from applied ledger entry');
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditions(client) {
  const tenantId = '76c44a0e-6041-8bda-99c7-b740fccea001';
  const result = await client.query(`SELECT jsonb_build_object(
    'tenant', (SELECT count(*) FROM tenants WHERE id=$1::uuid AND service_status='active'),
    'users', (SELECT count(*) FROM users WHERE tenant_id=$1::uuid AND email IN ('admin.demo@tcdx.demo','auditor.demo@tcdx.demo')),
    'semantic_layer', (SELECT count(*) FROM tenant_feature_overrides WHERE tenant_id=$1::uuid AND capability_key='data.semantic_layer' AND enabled=true AND status='active'),
    'standards', (SELECT count(*) FROM tenant_standards WHERE tenant_id=$1::uuid AND is_active),
    'risks', (SELECT count(*) FROM asset_risks ar JOIN assets a ON a.id=ar.asset_id WHERE a.tenant_id=$1::uuid),
    'controls', (SELECT count(*) FROM tenant_controls WHERE tenant_id=$1::uuid),
    'evidences', (SELECT count(*) FROM evidences WHERE tenant_id=$1::uuid),
    'findings', (SELECT count(*) FROM findings WHERE tenant_id=$1::uuid),
    'actions', (SELECT count(*) FROM action_plans WHERE tenant_id=$1::uuid),
    'measurements', (SELECT count(*) FROM metric_measurements WHERE tenant_id=$1::uuid),
    'semantic_contracts', (SELECT count(*) FROM data_source_contracts WHERE tenant_id=$1::uuid),
    'dashboards', (SELECT count(*) FROM dashboard_definitions WHERE tenant_id=$1::uuid AND status='published'),
    'reports', (SELECT count(*) FROM report_definitions WHERE tenant_id=$1::uuid AND status='published')
  ) AS checks`, [tenantId]);
  const checks = result.rows[0].checks;
  const minimums = {
    tenant: 1,
    users: 2,
    semantic_layer: 1,
    standards: 2,
    risks: 24,
    controls: 55,
    evidences: 80,
    findings: 18,
    actions: 24,
    measurements: 144,
    semantic_contracts: 6,
    dashboards: 4,
    reports: 4,
  };
  for (const [key, minimum] of Object.entries(minimums)) {
    if (Number(checks[key] || 0) < minimum) throw new Error(`Demo tenant postcondition failed: ${key}=${checks[key]} minimum=${minimum}`);
  }
  process.stdout.write(`demo_tenant_postconditions=${JSON.stringify(checks)}\n`);
  return checks;
}

async function run(mode) {
  const migration = readMigration();
  if (mode === 'checksum') {
    process.stdout.write(`${MIGRATION_ID} checksum=${migration.checksum}\n`);
    return;
  }

  const client = new Client({ connectionString: requireMigrationDatabaseUrl() });
  const started = Date.now();
  let lockHeld = false;
  await client.connect();
  try {
    await acquireLock(client);
    lockHeld = true;
    await ensureLedger(client);
    await preflight(client);
    const applied = await alreadyApplied(client, migration.checksum);
    if (mode === 'preflight') {
      process.stdout.write(`Demo tenant migration preflight OK: pending=${applied ? 'none' : MIGRATION_ID}\n`);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');

    await client.query('BEGIN');
    if (!applied) {
      await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
        VALUES ($1,$2,current_user,'running',$3::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
      [MIGRATION_ID, migration.checksum, JSON.stringify({ file: path.relative(root, MIGRATION_FILE), scope: 'demo-tenant-only' })]);
      await client.query(unwrapMigrationTransaction(migration.sql));
    }
    const details = await postconditions(client);
    await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [MIGRATION_ID, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`Demo tenant migration applied: ${applied ? 'already_applied' : MIGRATION_ID}\n`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) { process.stderr.write(`rollback_error=${sanitizeError(rollbackError)}\n`); }
    if (!error.preserveLedger) {
      try {
        await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,duration_ms,status,details)
          VALUES ($1,$2,current_user,$3,'failed',$4::jsonb)
          ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='failed',details=EXCLUDED.details`,
        [MIGRATION_ID, migration.checksum, Date.now() - started, JSON.stringify({ error: sanitizeError(error) })]);
      } catch (ledgerError) {
        process.stderr.write(`ledger_error=${sanitizeError(ledgerError)}\n`);
      }
    }
    throw error;
  } finally {
    if (lockHeld) await releaseLock(client).catch((error) => process.stderr.write(`unlock_error=${sanitizeError(error)}\n`));
    await client.end();
  }
}

run((process.argv[2] || '--checksum').replace(/^--/, '')).catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
