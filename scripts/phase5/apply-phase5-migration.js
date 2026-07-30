#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

process.stdout.on('error', (error) => {
  if (error?.code === 'EPIPE') process.exit(0);
  throw error;
});

const ADVISORY_LOCK_NAMESPACE = 844332;
const ADVISORY_LOCK_KEY = 2026073005;
const MIGRATIONS = [
  {
    id: '20260729_phase5_data_metrics_bi_reporting',
    file: path.join(root, 'database/migrations/20260729_phase5_data_metrics_bi_reporting.sql'),
  },
  {
    id: '20260730_phase5_tenant_shell_grc_data_integration',
    file: path.join(root, 'database/migrations/20260730_phase5_tenant_shell_grc_data_integration.sql'),
  },
  {
    id: '20260730_phase5_5_official_math_governance',
    file: path.join(root, 'database/migrations/20260730_phase5_5_official_math_governance.sql'),
  },
];

function sanitizeError(error) {
  return String(error?.message || 'phase5 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration(migration) {
  const sql = fs.readFileSync(migration.file, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  return { sql, checksum };
}

function requireMigrationDatabaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!value) throw new Error('MIGRATION_DATABASE_URL is required for Phase 5 DDL migrations');
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error('MIGRATION_DATABASE_URL must be a PostgreSQL connection URL');
  return value;
}

function unwrapMigrationTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit < 0 || begin >= commit) throw new Error('Phase 5 migration must contain one outer BEGIN/COMMIT pair');
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
  if (result.rows[0]?.acquired !== true) throw new Error('Another Phase 5 migration process holds the advisory lock');
}

async function releaseLock(client) {
  const result = await client.query('SELECT pg_advisory_unlock($1, $2) AS released', [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  if (result.rows[0]?.released !== true) throw new Error('Phase 5 advisory lock was not released by this session');
}

async function preflight(client) {
  const result = await client.query(`
    SELECT
      current_user AS migration_user,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_tables,
      EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgcrypto') AS pgcrypto_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') AS tenants_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS users_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') AS permissions_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') AS role_permissions_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commercial_technical_capabilities') AS capabilities_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_limit_definitions') AS limits_available,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tcdx_async_jobs') AS jobs_available`);
  const row = result.rows[0];
  const visible = {
    migration_user: row.migration_user,
    can_create_tables: row.can_create_tables === true,
    pgcrypto_available: row.pgcrypto_available === true,
    tenants_available: row.tenants_available === true,
    users_available: row.users_available === true,
    permissions_available: row.permissions_available === true,
    role_permissions_available: row.role_permissions_available === true,
    capabilities_available: row.capabilities_available === true,
    limits_available: row.limits_available === true,
    jobs_available: row.jobs_available === true,
  };
  Object.entries(visible).forEach(([key, value]) => process.stdout.write(`${key}=${value}\n`));
  const failed = Object.entries(visible).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`Phase 5 migration privilege/schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
  return visible;
}

async function alreadyApplied(client, migrationId, checksum) {
  const result = await client.query('SELECT checksum, status FROM schema_migrations WHERE migration_id = $1', [migrationId]);
  if (result.rowCount === 0) return false;
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === checksum) return true;
  if (row.status === 'applied' && row.checksum !== checksum) {
    const error = new Error('Phase 5 migration checksum differs from applied ledger entry');
    error.preserveLedger = true;
    throw error;
  }
  return false;
}

async function postconditions(client) {
  const requiredTables = [
    'data_domains','data_elements','data_definitions','data_owners','data_sources','data_quality_rules',
    'data_quality_assessments','data_lineage_edges','data_snapshots','data_comparisons','data_trust_scores',
    'metric_definitions','metric_formula_versions','metric_dimensions','metric_sources','metric_thresholds',
    'metric_measurements','metric_validations','metric_impact_rules','metric_snapshots',
    'survey_definitions','survey_versions','survey_sections','survey_questions','survey_question_options',
    'assessment_campaigns','assessment_recipients','survey_responses','survey_response_items',
    'survey_evaluations','survey_approvals','assurance_test_definitions','assurance_test_executions',
    'assurance_test_samples','assurance_test_results','assurance_test_exceptions','loss_events','loss_recoveries',
    'dashboard_definitions','dashboard_widgets','dashboard_permissions','report_definitions',
    'report_template_versions','report_schedules','report_generations','report_artifacts','report_approvals',
  ];
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables]
  );
  const found = new Set(tables.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`Phase 5 postcondition missing tables: ${missing.join(', ')}`);

  const catalog = await client.query(`SELECT COUNT(*)::int AS count FROM metric_definitions WHERE tenant_id IS NULL AND status = 'published'`);
  const permissions = await client.query(`SELECT COUNT(*)::int AS count FROM permissions WHERE permission_group IN ('data','metrics','surveys','assurance','loss','bi','reports')`);
  const capabilities = await client.query(`SELECT COUNT(*)::int AS count FROM commercial_technical_capabilities WHERE capability_key LIKE 'reporting.%' OR capability_key IN ('data.governance','metrics.catalog','metrics.engine','metrics.data_trust','data.lineage','data.impact_graph','surveys.engine','assurance.testing','loss.events','bi.dashboard_builder','bi.executive_dashboards')`);
  if (Number(catalog.rows[0]?.count || 0) < 20) throw new Error('Phase 5 postcondition missing initial metric catalog');
  if (Number(permissions.rows[0]?.count || 0) < 30) throw new Error('Phase 5 postcondition missing permissions');
  if (Number(capabilities.rows[0]?.count || 0) < 16) throw new Error('Phase 5 postcondition missing capabilities');
  const hotfix = await client.query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='grc_analytical_impact_rules') AS impact_rules,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='grc_analytical_impact_events') AS impact_events,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='data_trust_score_versions') AS trust_versions,
      (SELECT COUNT(*)::int FROM grc_analytical_impact_rules WHERE status='published') AS impact_rules_count,
      (SELECT COUNT(*)::int FROM data_trust_score_versions WHERE version_key='data_trust_score' AND version_number=2 AND status='published') AS trust_v2_count`);
  const hotfixRow = hotfix.rows[0];
  if (hotfixRow.impact_rules !== true || hotfixRow.impact_events !== true || hotfixRow.trust_versions !== true) {
    throw new Error('Phase 5 hotfix postcondition missing analytical tables');
  }
  if (Number(hotfixRow.impact_rules_count || 0) < 7) throw new Error('Phase 5 hotfix postcondition missing impact rules');
  if (Number(hotfixRow.trust_v2_count || 0) < 1) throw new Error('Phase 5 hotfix postcondition missing trust score v2');

  return { tables: requiredTables.length, global_metrics: Number(catalog.rows[0].count), permissions: Number(permissions.rows[0].count), capabilities: Number(capabilities.rows[0].count), impact_rules: Number(hotfixRow.impact_rules_count), trust_score_version: 2 };
}

async function run(mode) {
  if (mode === 'checksum') {
    for (const migration of MIGRATIONS) {
      const { checksum } = readMigration(migration);
      process.stdout.write(`${migration.id} checksum=${checksum}\n`);
    }
    return;
  }

  const client = new Client({ connectionString: requireMigrationDatabaseUrl() });
  const started = Date.now();
  await client.connect();
  let lockHeld = false;
  let pendingForFailure = [];
  try {
    await acquireLock(client);
    lockHeld = true;
    await ensureLedger(client);
    await preflight(client);
    const readable = MIGRATIONS.map((migration) => ({ ...migration, ...readMigration(migration) }));
    const pending = [];
    for (const migration of readable) {
      if (await alreadyApplied(client, migration.id, migration.checksum)) {
        process.stdout.write(`Phase 5 migration already applied: ${migration.id}\n`);
      } else {
        pending.push(migration);
      }
    }
    pendingForFailure = pending;
    if (mode === 'preflight') {
      process.stdout.write(`Phase 5 migration preflight OK: pending=${pending.map((migration) => migration.id).join(',') || 'none'}\n`);
      return;
    }
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');

    await client.query('BEGIN');
    for (const migration of pending) {
      await client.query(
        `INSERT INTO schema_migrations (migration_id, checksum, applied_by, status, details)
         VALUES ($1,$2,current_user,'running',$3::jsonb)
         ON CONFLICT (migration_id) DO UPDATE
         SET checksum = EXCLUDED.checksum, applied_by = current_user, status = 'running', details = EXCLUDED.details`,
        [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]
      );
      await client.query(unwrapMigrationTransaction(migration.sql));
      await client.query(
        `UPDATE schema_migrations
         SET applied_at = now(), applied_by = current_user, duration_ms = $2, status = 'applied', details = details || $3::jsonb
         WHERE migration_id = $1`,
        [migration.id, Date.now() - started, JSON.stringify({ applied: true })]
      );
    }
    const details = await postconditions(client);
    for (const migration of readable) {
      await client.query(
        `UPDATE schema_migrations
         SET duration_ms = GREATEST(duration_ms, $2), details = details || $3::jsonb
         WHERE migration_id = $1`,
        [migration.id, Date.now() - started, JSON.stringify(details)]
      );
    }
    await client.query('COMMIT');
    process.stdout.write(`Phase 5 migrations applied: ${pending.map((migration) => migration.id).join(',') || 'none'}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (!error.preserveLedger) {
      for (const migration of pendingForFailure.length ? pendingForFailure : MIGRATIONS.map((item) => ({ ...item, ...readMigration(item) }))) {
        await client.query(
          `INSERT INTO schema_migrations (migration_id, checksum, applied_by, duration_ms, status, details)
           VALUES ($1,$2,current_user,$3,'failed',$4::jsonb)
           ON CONFLICT (migration_id) DO UPDATE
           SET checksum = EXCLUDED.checksum, applied_by = current_user, duration_ms = EXCLUDED.duration_ms, status = 'failed', details = EXCLUDED.details`,
          [migration.id, migration.checksum, Date.now() - started, JSON.stringify({ error: sanitizeError(error) })]
        ).catch(() => null);
      }
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
