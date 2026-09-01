#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260901_reconcile_ai_addon_after_historical_reapply',
  file: path.join(root, 'database/migrations/20260901_reconcile_ai_addon_after_historical_reapply.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026090103;
const STANDARD_PLAN_KEYS = Object.freeze(['pyme', 'empresa', 'enterprise']);
const AI_CAPABILITIES = Object.freeze(['ai.compliance', 'ai.auditor']);

function sanitize(error) {
  return String(error?.message || 'AI Add-on reconciliation migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`AI Add-on reconciliation migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\binsert\s+into\s+(?:public\.)?commercial_addons\b/,
    /\binsert\s+into\s+(?:public\.)?plan_version_addons\b/,
    /\bupdate\s+(?:public\.)?plan_version_modules\b/,
    /'ai\.compliance'/,
    /'ai\.auditor'/,
    /'ai_addon'/,
    /20260901_reconcile_ai_addon_after_historical_reapply/,
  ];
  const forbidden = [
    /\binsert\s+into\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_subscriptions|tenant_contracts|tenants|tenant_subscription_addons)\b/,
    /\bupdate\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_subscriptions|tenant_contracts|tenants|tenant_subscription_addons)\b/,
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\balter\s+\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`AI Add-on reconciliation migration contains forbidden SQL scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`AI Add-on reconciliation migration missing expected SQL operation/token: ${missing}`);
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for AI Add-on reconciliation migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('AI Add-on reconciliation migration must contain one outer BEGIN/COMMIT pair');
  }
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

function boolValue(value) {
  return value === true || value === 'true';
}

function numberValue(value) {
  return Number(value || 0);
}

function normalizeState(row) {
  return {
    ai_addon_ready: boolValue(row.ai_addon_ready),
    ai_capabilities_ready: numberValue(row.ai_capabilities_ready),
    ai_capabilities_historical_classification: numberValue(row.ai_capabilities_historical_classification),
    base_plans_do_not_include_ai: boolValue(row.base_plans_do_not_include_ai),
    base_plan_ai_capabilities: numberValue(row.base_plan_ai_capabilities),
    enterprise_ai_compliance_included: boolValue(row.enterprise_ai_compliance_included),
    compatible_standard_plan_versions: numberValue(row.compatible_standard_plan_versions),
    standard_plan_versions: numberValue(row.standard_plan_versions),
  };
}

function isPostconditionSatisfied(state) {
  const normalized = normalizeState(state);
  return (
    normalized.ai_addon_ready === true &&
    normalized.ai_capabilities_ready === AI_CAPABILITIES.length &&
    normalized.base_plans_do_not_include_ai === true &&
    normalized.compatible_standard_plan_versions === STANDARD_PLAN_KEYS.length &&
    normalized.standard_plan_versions === STANDARD_PLAN_KEYS.length
  );
}

function isKnownHistoricalReapplyState(state) {
  const normalized = normalizeState(state);
  return (
    normalized.ai_addon_ready === true &&
    normalized.ai_capabilities_ready === 0 &&
    normalized.ai_capabilities_historical_classification === AI_CAPABILITIES.length &&
    normalized.base_plans_do_not_include_ai === false &&
    normalized.base_plan_ai_capabilities > 0 &&
    normalized.enterprise_ai_compliance_included === true &&
    normalized.compatible_standard_plan_versions === STANDARD_PLAN_KEYS.length &&
    normalized.standard_plan_versions === STANDARD_PLAN_KEYS.length
  );
}

function assertPreflightState(state) {
  if (isPostconditionSatisfied(state) || isKnownHistoricalReapplyState(state)) return;
  throw new Error(`AI Add-on reconciliation preflight failed: unsupported state ${JSON.stringify(normalizeState(state))}`);
}

function assertPostconditions(state) {
  if (isPostconditionSatisfied(state)) return normalizeState(state);
  throw new Error(`AI Add-on reconciliation postcondition failed: ${JSON.stringify(normalizeState(state))}`);
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
    const error = new Error(`AI Add-on reconciliation migration checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`AI Add-on reconciliation migration ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`AI Add-on reconciliation migration ledger has unsupported status ${state}: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
}

async function requireBaseSchema(client) {
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('commercial_addons','addon_key'),
        ('commercial_addons','status'),
        ('commercial_addons','metadata'),
        ('commercial_modules','module_key'),
        ('commercial_features','feature_key'),
        ('commercial_technical_capabilities','capability_key'),
        ('commercial_technical_capabilities','required_permission'),
        ('commercial_technical_capabilities','status'),
        ('commercial_technical_capabilities','metadata'),
        ('module_features','module_key'),
        ('module_features','feature_key'),
        ('feature_capabilities','feature_key'),
        ('feature_capabilities','capability_key'),
        ('commercial_plan_versions','id'),
        ('commercial_plan_versions','plan_key'),
        ('commercial_plan_versions','status'),
        ('plan_version_modules','plan_version_id'),
        ('plan_version_modules','module_key'),
        ('plan_version_modules','included'),
        ('plan_version_addons','plan_version_id'),
        ('plan_version_addons','addon_key'),
        ('plan_version_addons','included'),
        ('schema_migrations','migration_id'),
        ('schema_migrations','checksum'),
        ('schema_migrations','applied_at'),
        ('schema_migrations','applied_by'),
        ('schema_migrations','duration_ms'),
        ('schema_migrations','status'),
        ('schema_migrations','details')
    ),
    column_state AS (
      SELECT rc.table_name, rc.column_name, (c.column_name IS NOT NULL) AS ready
      FROM required_columns rc
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = rc.table_name
       AND c.column_name = rc.column_name
    )
    SELECT
      current_user AS migration_user,
      to_regclass('public.commercial_addons') IS NOT NULL AS commercial_addons_ready,
      to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_technical_capabilities_ready,
      to_regclass('public.plan_version_modules') IS NOT NULL AS plan_version_modules_ready,
      to_regclass('public.plan_version_addons') IS NOT NULL AS plan_version_addons_ready,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready,
      to_regclass('public.v_commercial_plan_capabilities') IS NOT NULL AS v_commercial_plan_capabilities_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready
    FROM column_state`);

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`AI Add-on reconciliation schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function fetchCurrentState(client) {
  const result = await client.query(
    `WITH standard_versions AS (
       SELECT id, plan_key
       FROM commercial_plan_versions
       WHERE status = 'published'
         AND plan_key = ANY($1::text[])
     ),
     ai_plan_capabilities AS (
       SELECT plan_key, capability_key
       FROM v_commercial_plan_capabilities
       WHERE plan_key = ANY($1::text[])
         AND capability_key = ANY($2::text[])
     )
     SELECT
       EXISTS (
         SELECT 1
         FROM commercial_addons
         WHERE addon_key = 'ai'
           AND status = 'active'
           AND metadata->>'canonical_key' = 'ai'
       ) AS ai_addon_ready,
       (
         SELECT COUNT(*)::int
         FROM commercial_technical_capabilities
         WHERE capability_key = ANY($2::text[])
           AND status = 'active'
           AND metadata->>'commercial_classification' = 'AI_ADDON'
           AND metadata->>'addon_key' = 'ai'
       ) AS ai_capabilities_ready,
       (
         SELECT COUNT(*)::int
         FROM commercial_technical_capabilities
         WHERE capability_key = ANY($2::text[])
           AND status = 'active'
           AND metadata->>'commercial_classification' = 'GRC_ADVANCED'
           AND metadata->>'addon_key' = 'ai'
       ) AS ai_capabilities_historical_classification,
       NOT EXISTS (SELECT 1 FROM ai_plan_capabilities) AS base_plans_do_not_include_ai,
       (SELECT COUNT(*)::int FROM ai_plan_capabilities) AS base_plan_ai_capabilities,
       EXISTS (
         SELECT 1
         FROM ai_plan_capabilities
         WHERE plan_key = 'enterprise'
           AND capability_key = 'ai.compliance'
       ) AS enterprise_ai_compliance_included,
       (
         SELECT COUNT(*)::int
         FROM standard_versions sv
         JOIN plan_version_addons pva
           ON pva.plan_version_id = sv.id
          AND pva.addon_key = 'ai'
          AND pva.included = true
       ) AS compatible_standard_plan_versions,
       (SELECT COUNT(*)::int FROM standard_versions) AS standard_plan_versions`,
    [STANDARD_PLAN_KEYS, AI_CAPABILITIES],
  );

  return normalizeState(result.rows[0] || {});
}

function printState(state) {
  const normalized = normalizeState(state);
  process.stdout.write(`AI_ADDON_READY=${normalized.ai_addon_ready}\n`);
  process.stdout.write(`AI_CAPABILITIES_READY=${normalized.ai_capabilities_ready}\n`);
  process.stdout.write(`AI_CAPABILITIES_HISTORICAL_CLASSIFICATION=${normalized.ai_capabilities_historical_classification}\n`);
  process.stdout.write(`BASE_PLANS_DO_NOT_INCLUDE_AI=${normalized.base_plans_do_not_include_ai}\n`);
  process.stdout.write(`BASE_PLAN_AI_CAPABILITIES=${normalized.base_plan_ai_capabilities}\n`);
  process.stdout.write(`ENTERPRISE_AI_COMPLIANCE_INCLUDED=${normalized.enterprise_ai_compliance_included}\n`);
  process.stdout.write(`COMPATIBLE_STANDARD_PLAN_VERSIONS=${normalized.compatible_standard_plan_versions}\n`);
  process.stdout.write(`STANDARD_PLAN_VERSIONS=${normalized.standard_plan_versions}\n`);
  process.stdout.write(`RECONCILIATION_REQUIRED=${isKnownHistoricalReapplyState(normalized)}\n`);
}

async function migrationState(client, migration) {
  const result = await client.query(
    'SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1',
    [migration.id],
  );
  return migrationStateFromRows(result.rows, migration);
}

async function preflight(client, migration) {
  await requireBaseSchema(client);
  const state = await migrationState(client, migration);
  process.stdout.write(`migration_state=${state}\n`);
  assertMigrationStateIsSafe(state, migration);
  const currentState = await fetchCurrentState(client);
  printState(currentState);
  if (state === 'already_applied') {
    assertPostconditions(currentState);
  } else {
    assertPreflightState(currentState);
  }
  process.stdout.write(`AI Add-on reconciliation migration preflight OK: pending=${state === 'pending' ? migration.id : 'none'}\n`);
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
    if (lock.rows[0]?.acquired !== true) {
      throw new Error('Another AI Add-on reconciliation migration process holds the advisory lock');
    }
    locked = true;

    const done = await preflight(client, migration);
    if (mode === 'preflight') return;
    if (mode !== 'apply') throw new Error('Use --checksum, --preflight or --apply');

    if (done) {
      process.stdout.write('AI Add-on reconciliation migration applied: already_applied\n');
      return;
    }

    await client.query('BEGIN');
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_by,status,details)
      VALUES ($1,$2,current_user,'running',$3::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_by=current_user,status='running',details=EXCLUDED.details`,
    [migration.id, migration.checksum, JSON.stringify({ file: path.relative(root, migration.file) })]);
    await client.query(unwrapTransaction(migration.sql));
    const details = assertPostconditions(await fetchCurrentState(client));
    await client.query(`INSERT INTO public.schema_migrations (migration_id,checksum,applied_at,applied_by,duration_ms,status,details)
      VALUES ($1,$2,now(),current_user,$3,'applied',$4::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=now(),applied_by=current_user,duration_ms=EXCLUDED.duration_ms,status='applied',details=EXCLUDED.details`,
    [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)]);
    await client.query('COMMIT');
    process.stdout.write(`AI Add-on reconciliation migration applied: ${migration.id}\n`);
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
    AI_CAPABILITIES,
    STANDARD_PLAN_KEYS,
    assertPostconditions,
    assertPreflightState,
    isKnownHistoricalReapplyState,
    isPostconditionSatisfied,
    migrationStateFromRows,
    normalizeState,
  },
};
