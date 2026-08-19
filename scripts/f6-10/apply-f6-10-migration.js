#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATIONS = Object.freeze([
  {
    id: '20260819_f6_10_01_knowledge_document_model',
    file: path.join(root, 'database/migrations/20260819_f6_10_01_knowledge_document_model.sql'),
    postconditions: postconditionsKnowledgeDocumentModel,
  },
]);
const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026081910;

function sanitize(error) {
  return String(error?.message || 'F6.10 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration(migration) {
  if (!fs.existsSync(migration.file)) throw new Error(`F6.10 migration file missing: ${path.relative(root, migration.file)}`);
  const sql = fs.readFileSync(migration.file, 'utf8');
  return { ...migration, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required for F6.10 migrations');
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('F6.10 migration must contain one outer BEGIN/COMMIT pair');
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
    to_regclass('public.knowledge_sources') IS NOT NULL AS knowledge_sources_ready,
    to_regclass('public.knowledge_items') IS NOT NULL AS knowledge_items_ready,
    to_regclass('public.knowledge_rules') IS NOT NULL AS knowledge_rules_ready,
    to_regclass('public.knowledge_evidence_expectations') IS NOT NULL AS evidence_expectations_ready,
    to_regclass('public.knowledge_base_v3') IS NULL AS no_second_kb`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`F6.10 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function alreadyApplied(client, migration) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1', [migration.id]);
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return true;
  if (row.status === 'applied') {
    const error = new Error(`F6.10 migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditionsKnowledgeDocumentModel(client) {
  const result = await client.query(`SELECT
    to_regclass('public.knowledge_documents') IS NOT NULL AS knowledge_documents_ready,
    to_regclass('public.knowledge_items') IS NOT NULL AS knowledge_items_preserved,
    to_regclass('public.knowledge_rules') IS NOT NULL AS knowledge_rules_preserved,
    to_regclass('public.knowledge_base_v3') IS NULL AS no_second_kb,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='knowledge_sources'
        AND column_name='knowledge_document_id'
    ) AS knowledge_sources_link_ready,
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname='knowledge_documents_tenant_scope_check'
    ) AS tenant_scope_constraint_ready,
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname='knowledge_documents_status_check'
    ) AS lifecycle_constraint_ready,
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='knowledge_documents'
        AND column_name IN ('embedding','embedding_vector','content_vector')
    ) AS no_vector_columns`);
  const row = result.rows[0] || {};
  if (Object.values(row).some((value) => value !== true)) {
    throw new Error(`F6.10 knowledge document model postcondition failed: ${JSON.stringify(row)}`);
  }
  return row;
}

async function run(mode) {
  const migrations = MIGRATIONS.map(readMigration);
  if (mode === 'checksum') {
    for (const migration of migrations) process.stdout.write(`${migration.id} checksum=${migration.checksum}\n`);
    return;
  }
  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now();
  let locked = false;
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) throw new Error('Another F6.10 migration process holds the advisory lock');
    locked = true;
    await ensureLedger(client);
    await preflight(client);
    const states = [];
    for (const migration of migrations) states.push({ migration, done: await alreadyApplied(client, migration) });
    if (mode === 'preflight') {
      const pending = states.filter((state) => !state.done).map((state) => state.migration.id);
      process.stdout.write(`F6.10 migration preflight OK: pending=${pending.length ? pending.join(',') : 'none'}\n`);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');
    for (const { migration, done } of states) {
      await client.query('BEGIN');
      if (!done) {
        await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
          VALUES ($1,$2,current_user,'running',$3::jsonb)
          ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
        [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
        await client.query(unwrapTransaction(migration.sql));
      }
      const details = await migration.postconditions(client);
      await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
        VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
      [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
      await client.query('COMMIT');
      process.stdout.write(`F6.10 migration applied: ${done ? 'already_applied' : migration.id}\n`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger) {
      const failedMigration = migrations.find((migration) => String(error.message || '').includes(migration.id)) || migrations[0];
      if (failedMigration) {
        await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,status,details)
          VALUES ($1,$2,current_user,'failed',$3::jsonb)
          ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='failed',details=EXCLUDED.details`,
        [failedMigration.id, failedMigration.checksum, JSON.stringify({ error: sanitize(error) })]).catch(() => null);
      }
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
