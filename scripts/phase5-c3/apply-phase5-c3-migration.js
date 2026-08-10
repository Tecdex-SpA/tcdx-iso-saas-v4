#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const { bootstrapIndicators } = require(path.join(root, 'backend/src/services/indicators/indicatorBootstrap.service'));
const { syncMathGovernanceCatalog } = require(
  path.join(root, 'backend/src/services/math-governance/formulaBootstrap.service')
);
const { bootstrapSemanticRegistry } = require(
  path.join(root, 'backend/src/services/semantic/semanticBootstrap.service')
);
const MIGRATION_ID = '20260807_phase5_c3_indicators_trust_snapshots';
const MIGRATION_FILE = path.join(root, 'database/migrations/20260807_phase5_c3_indicators_trust_snapshots.sql');
const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026080703;

function sanitize(error) {
  return String(error?.message || 'phase5-c3 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]').slice(0, 1000);
}
function migration() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  return { sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}
function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL is required for Phase 5-C3 DDL migrations');
  return value;
}
function unwrap(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('Phase 5-C3 migration must contain one outer BEGIN/COMMIT pair');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}
async function ledger(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_id text PRIMARY KEY, checksum char(64) NOT NULL, applied_at timestamptz,
    applied_by text NOT NULL, duration_ms bigint NOT NULL DEFAULT 0 CHECK(duration_ms>=0),
    status text NOT NULL CHECK(status IN ('running','applied','failed')), details jsonb NOT NULL DEFAULT '{}'::jsonb)`);
}
async function preflight(client) {
  const result = await client.query(`SELECT current_user AS migration_user,
    has_schema_privilege(current_user,'public','CREATE') AS can_create,
    to_regclass('public.metric_definitions') IS NOT NULL AS metrics_ready,
    to_regclass('public.metric_source_bindings') IS NOT NULL AS bindings_ready,
    to_regclass('public.calculation_runs') IS NOT NULL AS calculations_ready,
    to_regclass('public.data_source_contract_versions') IS NOT NULL AS semantic_ready,
    to_regclass('public.tcdx_async_jobs') IS NOT NULL AS jobs_ready,
    to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_ready`);
  for (const [key,value] of Object.entries(result.rows[0])) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(result.rows[0]).filter(([key,value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`Phase 5-C3 preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}
async function c3SchemaAlreadyInstalled(client) {
  const result = await client.query(`SELECT
    to_regclass('public.metric_definition_versions') IS NOT NULL
    AND to_regclass('public.metric_trust_policies') IS NOT NULL
    AND to_regclass('public.metric_trust_assessments') IS NOT NULL
    AND to_regclass('public.metric_interpretations') IS NOT NULL
    AND to_regclass('public.metric_action_proposals') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.metric_measurements'::regclass
        AND conname='metric_measurements_legacy_or_official_value_check'
    )
    AND EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.metric_measurements'::regclass
        AND conname='metric_measurements_official_value_contract'
    )
    AND EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname='trg_metric_snapshot_immutable' AND tgenabled='O'
    ) AS installed`);
  return result.rows[0]?.installed === true;
}
async function applied(client, hash) {
  const result = await client.query('SELECT checksum,status FROM schema_migrations WHERE migration_id=$1',[MIGRATION_ID]);
  if (!result.rowCount) return false;
  if (result.rows[0].status === 'applied' && result.rows[0].checksum === hash) return true;
  if (result.rows[0].status === 'applied') {
    const error = new Error('Phase 5-C3 migration checksum differs from applied ledger entry');
    error.preserveLedger=true;
    throw error;
  }
  if (result.rows[0].status === 'failed' && result.rows[0].checksum === hash && await c3SchemaAlreadyInstalled(client)) {
    process.stdout.write('Phase 5-C3 recovery: schema already installed; skipping DDL and retrying registry/bootstrap\n');
    return true;
  }
  return false;
}
async function postconditions(client) {
  const required = ['metric_definition_versions','metric_trust_policies','metric_trust_assessments','metric_interpretations','metric_action_proposals','metric_job_policies'];
  const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])`,[required]);
  if (tables.rowCount !== required.length) throw new Error('Phase 5-C3 postcondition missing tables');
  const checks = await client.query(`SELECT
    (SELECT count(*)>=22 FROM metric_definition_versions WHERE tenant_id IS NULL AND status='published') AS catalog_ready,
    (SELECT count(*)>=22 FROM metric_source_bindings WHERE tenant_id IS NULL AND binding_status='published') AS bindings_ready,
    (SELECT count(*)=1 FROM metric_trust_policies WHERE tenant_id IS NULL AND status='published') AS trust_ready,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_metric_snapshot_immutable' AND tgenabled='O') AS snapshots_immutable,
    EXISTS(SELECT 1 FROM commercial_technical_capabilities WHERE capability_key='metrics.indicators.read' AND status='active') AS capability_ready`);
  if (Object.values(checks.rows[0]).some((value) => value !== true)) throw new Error('Phase 5-C3 postcondition failed for catalog, binding, trust, immutability or capability');
  return { tables:required.length,catalog:22 };
}
async function run(mode) {
  const source = migration();
  if (mode === 'checksum') { process.stdout.write(`${MIGRATION_ID} checksum=${source.checksum}\n`); return; }
  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now(); let locked=false;
  await client.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1,$2) AS acquired',[LOCK_NAMESPACE,LOCK_KEY]);
    if (lock.rows[0]?.acquired !== true) throw new Error('Another Phase 5-C3 migration process holds the advisory lock');
    locked=true; await ledger(client); await preflight(client);
    const done = await applied(client,source.checksum);
    if (mode === 'preflight') { process.stdout.write(`Phase 5-C3 migration preflight OK: pending=${done?'none':MIGRATION_ID}\n`); return; }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');
    await client.query('BEGIN');
    if (!done) {
      await client.query(`INSERT INTO schema_migrations(migration_id,checksum,applied_by,status,details) VALUES($1,$2,current_user,'running',$3::jsonb)
        ON CONFLICT(migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,[MIGRATION_ID,source.checksum,JSON.stringify({file:path.relative(root,MIGRATION_FILE)})]);
      await client.query(unwrap(source.sql));
    }
    const mathGovernance = await syncMathGovernanceCatalog(client, {});
    const semanticRegistry = await bootstrapSemanticRegistry(client);
    const bootstrap = await bootstrapIndicators(client);
    const details = {
      ...(await postconditions(client)),
      math_governance: mathGovernance,
      semantic_registry: semanticRegistry,
      bootstrap,
    };
    await client.query(`INSERT INTO schema_migrations(migration_id,checksum,applied_at,applied_by,duration_ms,status,details) VALUES($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT(migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,[MIGRATION_ID,source.checksum,Date.now()-started,JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`Phase 5-C3 migration applied: ${done?'already_applied':MIGRATION_ID}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(()=>null);
    const ledgerState = await client.query(
      'SELECT status FROM schema_migrations WHERE migration_id=$1',
      [MIGRATION_ID]
    ).catch(() => ({ rows: [] }));
    const preserveAppliedLedger = ledgerState.rows[0]?.status === 'applied';
    if (!error.preserveLedger && !preserveAppliedLedger) await client.query(`INSERT INTO schema_migrations(migration_id,checksum,applied_by,duration_ms,status,details) VALUES($1,$2,current_user,$3,'failed',$4::jsonb)
      ON CONFLICT(migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='failed',details=EXCLUDED.details`,[MIGRATION_ID,source.checksum,Date.now()-started,JSON.stringify({error:sanitize(error)})]).catch(()=>null);
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1,$2)',[LOCK_NAMESPACE,LOCK_KEY]).catch(()=>null);
    await client.end();
  }
}

run((process.argv[2]||'--checksum').replace(/^--/,'')).catch((error)=>{ process.stderr.write(`${sanitize(error)}\n`); process.exit(1); });
