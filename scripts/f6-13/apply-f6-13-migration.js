#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260824_f6_13_a_operational_learning',
  file: path.join(root, 'database/migrations/20260824_f6_13_a_operational_learning.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026082413;

function sanitize(error) {
  return String(error?.message || 'F6.13 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) throw new Error(`F6.13 migration file missing: ${path.relative(root, MIGRATION.file)}`);
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required for F6.13 migrations');
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('F6.13 migration must contain one outer BEGIN/COMMIT pair');
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

async function preflight(client) {
  const result = await client.query(`SELECT
    current_user AS migration_user,
    EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto') AS pgcrypto_available,
    to_regclass('public.tenants') IS NOT NULL AS tenants_ready,
    to_regclass('public.users') IS NOT NULL AS users_ready,
    to_regclass('public.audit_event_log') IS NOT NULL AS audit_event_log_ready,
    to_regclass('public.iso_operational_suggestions') IS NOT NULL AS iso_operational_suggestions_ready,
    to_regclass('public.iso_recommended_action_conversions') IS NOT NULL AS recommended_action_conversions_ready,
    to_regclass('public.grc_gaps') IS NOT NULL AS grc_gaps_ready,
    to_regclass('public.grc_observations') IS NOT NULL AS grc_observations_ready,
    to_regclass('public.knowledge_base_v3') IS NULL AS no_second_kb,
    to_regclass('public.priority_engine_results') IS NULL AS no_priority_store`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`F6.13 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function alreadyApplied(client, migration) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1', [migration.id]);
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return true;
  if (row.status === 'applied') {
    const error = new Error(`F6.13 migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditions(client) {
  const result = await client.query(`SELECT
    to_regclass('public.recommendation_decision_ledger') IS NOT NULL AS decision_ledger_ready,
    to_regclass('public.recommendation_effectiveness_evaluations') IS NOT NULL AS effectiveness_evaluations_ready,
    to_regclass('public.operational_memory_cases') IS NOT NULL AS operational_memory_ready,
    to_regclass('public.operational_memory_case_links') IS NOT NULL AS operational_memory_links_ready,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='recommendation_decision_ledger'
        AND indexname='ux_recommendation_decision_ledger_tenant_idempotency'
    ) AS decision_idempotency_ready,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='recommendation_effectiveness_evaluations'
        AND indexname='ux_recommendation_effectiveness_tenant_idempotency'
    ) AS effectiveness_idempotency_ready,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='operational_memory_cases'
        AND indexname='ux_operational_memory_cases_tenant_idempotency'
    ) AS memory_idempotency_ready,
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname='chk_operational_memory_confirmation'
    ) AS memory_confirmation_gate_ready,
    NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN (
          'parallel_decision_truth',
          'parallel_priority_store',
          'parallel_observation_store',
          'shadow_gap_store',
          'second_operational_memory',
          'knowledge_base_v3',
          'second_retrieval_engine'
        )
    ) AS no_parallel_truth_storage`);
  const row = result.rows[0] || {};
  if (Object.values(row).some((value) => value !== true)) {
    throw new Error(`F6.13-A operational learning postcondition failed: ${JSON.stringify(row)}`);
  }
  return row;
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
    if (lock.rows[0]?.acquired !== true) throw new Error('Another F6.13 migration process holds the advisory lock');
    locked = true;
    await ensureLedger(client);
    await preflight(client);
    const done = await alreadyApplied(client, migration);
    if (mode === 'preflight') {
      process.stdout.write(`F6.13 migration preflight OK: pending=${done ? 'none' : migration.id}\n`);
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
    process.stdout.write(`F6.13 migration applied: ${done ? 'already_applied' : migration.id}\n`);
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
