#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const { bootstrapSemanticRegistry } = require(path.join(root, 'backend/src/services/semantic/semanticBootstrap.service'));

const MIGRATION_ID = '20260803_phase5_c2_semantic_layer';
const MIGRATION_FILE = path.join(root, 'database/migrations/20260803_phase5_c2_semantic_layer.sql');
const ADVISORY_LOCK_NAMESPACE = 844332;
const ADVISORY_LOCK_KEY = 2026080302;

function sanitizeError(error) {
  return String(error?.message || 'phase5-c2 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION_FILE)) throw new Error('Phase 5-C2 migration file is missing');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  return { sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) throw new Error('MIGRATION_DATABASE_URL is required for Phase 5-C2 DDL migrations');
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  return value;
}

function unwrapMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit < 0 || begin >= commit) throw new Error('Phase 5-C2 migration must contain one outer BEGIN/COMMIT pair');
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
  if (result.rows[0]?.acquired !== true) throw new Error('Another Phase 5-C2 migration process holds the advisory lock');
}

async function releaseLock(client) {
  const result = await client.query('SELECT pg_advisory_unlock($1,$2) AS released', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  if (result.rows[0]?.released !== true) throw new Error('Phase 5-C2 advisory lock was not released by this session');
}

async function preflight(client) {
  const result = await client.query(`SELECT
    current_user AS migration_user,
    has_schema_privilege(current_user,'public','CREATE') AS can_create_tables,
    EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto') AS pgcrypto_available,
    to_regclass('public.tenants') IS NOT NULL AS tenants_available,
    to_regclass('public.users') IS NOT NULL AS users_available,
    to_regclass('public.data_sources') IS NOT NULL AS data_sources_available,
    to_regclass('public.data_snapshots') IS NOT NULL AS data_snapshots_available,
    to_regclass('public.data_lineage_edges') IS NOT NULL AS lineage_available,
    to_regclass('public.official_formula_source_contracts') IS NOT NULL AS formula_contracts_available`);
  const row = result.rows[0];
  const visible = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === 'migration_user' ? value : value === true]));
  Object.entries(visible).forEach(([key, value]) => process.stdout.write(`${key}=${value}\n`));
  const failed = Object.entries(visible).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`Phase 5-C2 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
  return visible;
}

async function alreadyApplied(client, checksum) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1', [MIGRATION_ID]);
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === checksum) return true;
  if (row.status === 'applied' && row.checksum !== checksum) {
    const error = new Error('Phase 5-C2 migration checksum differs from applied ledger entry');
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditions(client) {
  const required = ['data_source_contracts','data_source_contract_versions','data_source_field_mappings','grc_observations','grc_observation_relations','metric_sufficiency_rules'];
  const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])`, [required]);
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = required.filter((table) => !found.has(table));
  if (missing.length) throw new Error(`Phase 5-C2 postcondition missing tables: ${missing.join(', ')}`);
  const constraints = await client.query(`SELECT
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_semantic_contract_version_immutable' AND tgenabled='O') AS contract_immutable,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_semantic_sufficiency_rule_immutable' AND tgenabled='O') AS sufficiency_immutable,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_semantic_observation_history' AND tgenabled='O') AS observation_immutable,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_semantic_source_snapshot_immutable' AND tgenabled='O') AS snapshot_immutable,
    EXISTS (SELECT 1 FROM commercial_technical_capabilities WHERE capability_key='data.semantic_layer' AND status='active') AS capability_ready`);
  if (Object.values(constraints.rows[0]).some((value) => value !== true)) throw new Error('Phase 5-C2 postcondition failed for immutability or capability');
  const bootstrap = await bootstrapSemanticRegistry(client);
  if (Number(bootstrap.contracts || 0) < 1 || Number(bootstrap.versioned || 0) < 1) throw new Error('Phase 5-C2 semantic registry bootstrap produced no versioned contracts');
  return { tables: required.length, bootstrap };
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
      process.stdout.write(`Phase 5-C2 migration preflight OK: pending=${applied ? 'none' : MIGRATION_ID}\n`);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');
    await client.query('BEGIN');
    if (!applied) {
      await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
        VALUES ($1,$2,current_user,'running',$3::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
      [MIGRATION_ID, migration.checksum, JSON.stringify({ file: path.relative(root, MIGRATION_FILE) })]);
      await client.query(unwrapMigrationTransaction(migration.sql));
    }
    const details = await postconditions(client);
    await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [MIGRATION_ID, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`Phase 5-C2 migration applied: ${applied ? 'already_applied' : MIGRATION_ID}\n`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      process.stderr.write(`Phase 5-C2 rollback error: ${sanitizeError(rollbackError)}\n`);
    }
    if (!error.preserveLedger) {
      try {
        await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,duration_ms,status,details)
          VALUES ($1,$2,current_user,$3,'failed',$4::jsonb)
          ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='failed',details=EXCLUDED.details`,
        [MIGRATION_ID, migration.checksum, Date.now() - started, JSON.stringify({ error: sanitizeError(error) })]);
      } catch (ledgerError) {
        process.stderr.write(`Phase 5-C2 ledger error: ${sanitizeError(ledgerError)}\n`);
      }
    }
    throw error;
  } finally {
    if (lockHeld) await releaseLock(client).catch((error) => process.stderr.write(`${sanitizeError(error)}\n`));
    await client.end();
  }
}

run((process.argv[2] || '--checksum').replace(/^--/, '')).catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
