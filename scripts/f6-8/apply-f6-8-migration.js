#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATIONS = Object.freeze([
  {
    id: '20260818_f6_8_01_hf2_manual_observation_contract_bootstrap',
    file: path.join(root, 'database/migrations/20260818_f6_8_01_hf2_manual_observation_contract_bootstrap.sql'),
    postconditions: postconditionsManualObservationContract,
  },
  {
    id: '20260818_f6_8_02_governed_observation_emitter_outbox',
    file: path.join(root, 'database/migrations/20260818_f6_8_02_governed_observation_emitter_outbox.sql'),
    postconditions: postconditionsObservationEmitterOutbox,
  },
]);
const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026081806;

function sanitize(error) {
  return String(error?.message || 'F6.8 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration(migration) {
  if (!fs.existsSync(migration.file)) throw new Error(`F6.8 migration file missing: ${path.relative(root, migration.file)}`);
  const sql = fs.readFileSync(migration.file, 'utf8');
  return { ...migration, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required for F6.8 migrations');
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('F6.8 migration must contain one outer BEGIN/COMMIT pair');
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
    to_regclass('public.data_source_contracts') IS NOT NULL AS contracts_ready,
    to_regclass('public.data_source_contract_versions') IS NOT NULL AS versions_ready,
    to_regclass('public.data_snapshots') IS NOT NULL AS snapshots_ready,
    to_regclass('public.grc_observations') IS NOT NULL AS observations_ready,
    to_regclass('public.grc_observation_relations') IS NOT NULL AS relations_ready,
    to_regclass('public.grc_observation_links') IS NULL AS no_parallel_links,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname='trg_semantic_contract_version_immutable' AND tgenabled='O'
    ) AS published_versions_immutable,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname='trg_semantic_observation_history' AND tgenabled='O'
    ) AS observation_history_immutable`);
  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`F6.8 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function alreadyApplied(client, migration) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1', [migration.id]);
  if (!result.rowCount) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return true;
  if (row.status === 'applied') {
    const error = new Error(`F6.8 migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditionsManualObservationContract(client) {
  const result = await client.query(`SELECT
    (SELECT COUNT(*)::int
       FROM data_source_contracts
      WHERE tenant_id IS NULL
        AND source_code='grc.manual_observations'
        AND status='published') AS global_contracts,
    (SELECT COUNT(*)::int
       FROM data_source_contract_versions version
       JOIN data_source_contracts contract ON contract.id=version.contract_id
      WHERE contract.tenant_id IS NULL
        AND contract.source_code='grc.manual_observations'
        AND version.version_number=1
        AND version.status='published') AS published_v1,
    (SELECT COUNT(*)::int
       FROM data_source_contracts contract
       JOIN data_source_contract_versions version ON version.id=contract.current_version_id
      WHERE contract.tenant_id IS NULL
        AND contract.source_code='grc.manual_observations'
        AND version.version_number=1
        AND version.status='published') AS current_version_matches,
    (SELECT COUNT(*)::int
       FROM data_source_contracts
      WHERE tenant_id IS NOT NULL
        AND source_code='grc.manual_observations') AS tenant_specific_contracts,
    to_regclass('public.grc_observation_links') IS NULL AS no_parallel_links,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname='trg_semantic_observation_history' AND tgenabled='O'
    ) AS observation_history_immutable`);
  const row = result.rows[0] || {};
  if (row.global_contracts !== 1 || row.published_v1 !== 1 || row.current_version_matches !== 1 ||
      row.tenant_specific_contracts !== 0 || row.no_parallel_links !== true || row.observation_history_immutable !== true) {
    throw new Error(`F6.8 manual observation contract postcondition failed: ${JSON.stringify(row)}`);
  }
  return row;
}

async function postconditionsObservationEmitterOutbox(client) {
  const result = await client.query(`SELECT
    to_regclass('public.grc_observation_emission_outbox') IS NOT NULL AS outbox_ready,
    to_regclass('public.grc_observations') IS NOT NULL AS observations_ready,
    to_regclass('public.grc_observation_relations') IS NOT NULL AS relations_ready,
    to_regclass('public.grc_observation_links') IS NULL AS no_parallel_links,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname='trg_semantic_observation_history' AND tgenabled='O'
    ) AS observation_history_immutable,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='grc_observation_emission_outbox'
        AND indexname='grc_observation_emission_outbox_tenant_id_idempotency_key_key'
    ) AS idempotency_unique,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='grc_observation_emission_outbox'
        AND indexname='idx_grc_observation_emission_pending'
    ) AS pending_index`);
  const row = result.rows[0] || {};
  if (row.outbox_ready !== true || row.observations_ready !== true || row.relations_ready !== true ||
      row.no_parallel_links !== true || row.observation_history_immutable !== true ||
      row.idempotency_unique !== true || row.pending_index !== true) {
    throw new Error(`F6.8 observation emitter outbox postcondition failed: ${JSON.stringify(row)}`);
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
    if (lock.rows[0]?.acquired !== true) throw new Error('Another F6.8 migration process holds the advisory lock');
    locked = true;
    await ensureLedger(client);
    await preflight(client);
    const states = [];
    for (const migration of migrations) states.push({ migration, done: await alreadyApplied(client, migration) });
    if (mode === 'preflight') {
      const pending = states.filter((state) => !state.done).map((state) => state.migration.id);
      process.stdout.write(`F6.8 migration preflight OK: pending=${pending.length ? pending.join(',') : 'none'}\n`);
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
      process.stdout.write(`F6.8 migration applied: ${done ? 'already_applied' : migration.id}\n`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    let failedMigration = migrations.find((migration) => String(error.message || '').includes(migration.id)) || null;
    if (!failedMigration) {
      for (const migration of migrations) {
        const state = await client.query('SELECT status FROM schema_migrations WHERE migration_id=$1', [migration.id]).catch(() => ({ rows: [] }));
        if (state.rows[0]?.status === 'running') {
          failedMigration = migration;
          break;
        }
      }
    }
    failedMigration = failedMigration || migrations[migrations.length - 1];
    const ledgerState = await client.query('SELECT status FROM schema_migrations WHERE migration_id=$1', [failedMigration.id]).catch(() => ({ rows: [] }));
    const preserveAppliedLedger = ledgerState.rows[0]?.status === 'applied';
    if (!error.preserveLedger && !preserveAppliedLedger) {
      await client.query(`INSERT INTO schema_migrations (migration_id,checksum,applied_by,duration_ms,status,details)
        VALUES ($1,$2,current_user,$3,'failed',$4::jsonb)
        ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='failed',details=EXCLUDED.details`,
      [failedMigration.id, failedMigration.checksum, Date.now() - started, JSON.stringify({ error: sanitize(error) })]).catch(() => null);
    }
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1,$2)', [LOCK_NAMESPACE, LOCK_KEY]).catch(() => null);
    await client.end();
  }
}

run((process.argv[2] || '--checksum').replace(/^--/, '')).catch((error) => {
  process.stderr.write(`${sanitize(error)}\n`);
  process.exit(1);
});
