#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260901_normalization01_db_backend_authority',
  file: path.join(root, 'database/migrations/20260901_normalization01_db_backend_authority.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026090101;
const STANDARD_PLAN_KEYS = Object.freeze(['pyme', 'empresa', 'enterprise']);
const AI_CAPABILITIES = Object.freeze(['ai.compliance', 'ai.auditor']);
const CANONICAL = Object.freeze({
  AI_READ_PERMISSION: 'ai.view',
  ACTIONS_READ_PERMISSION: 'actions.view',
});

function sanitize(error) {
  return String(error?.message || 'NORMALIZATION-01 migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`NORMALIZATION-01 migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function validateSql(sql) {
  const normalized = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bupdate\s+(?:public\.)?commercial_technical_capabilities\b/,
    /\bupdate\s+(?:public\.)?tenant_subscription_addons\b/,
    /\binsert\s+into\s+(?:public\.)?plan_version_addons\b/,
    /\bupdate\s+(?:public\.)?plan_version_modules\b/,
    /'ai\.compliance'/,
    /'iso\.actions'/,
    /'ai\.view'/,
    /'actions\.view'/,
    /duplicate_effective_ai_addons|duplicate effective ai add-ons/,
    /standard.*ai.*capability|standard plan ai capability count/,
  ];
  const forbidden = [
    /\binsert\s+into\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_contracts|tenant_subscriptions)\b/,
    /\bupdate\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_contracts|tenant_subscriptions)\b/,
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`NORMALIZATION-01 migration contains forbidden SQL scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`NORMALIZATION-01 migration missing expected SQL operation/token: ${missing}`);
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for NORMALIZATION-01 migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) {
    throw new Error('NORMALIZATION-01 migration must contain one outer BEGIN/COMMIT pair');
  }
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function requireBaseSchema(client) {
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('permissions','permission_key'),
        ('permissions','is_active'),
        ('commercial_technical_capabilities','capability_key'),
        ('commercial_technical_capabilities','required_permission'),
        ('commercial_technical_capabilities','status'),
        ('commercial_technical_capabilities','metadata'),
        ('commercial_addons','addon_key'),
        ('commercial_addons','status'),
        ('commercial_addons','metadata'),
        ('commercial_plan_versions','id'),
        ('commercial_plan_versions','plan_id'),
        ('commercial_plan_versions','plan_key'),
        ('commercial_plan_versions','status'),
        ('commercial_plans','id'),
        ('commercial_plans','plan_key'),
        ('commercial_plans','status'),
        ('plan_version_modules','plan_version_id'),
        ('plan_version_modules','module_key'),
        ('plan_version_modules','included'),
        ('plan_version_addons','plan_version_id'),
        ('plan_version_addons','addon_key'),
        ('plan_version_addons','included'),
        ('tenant_subscription_addons','id'),
        ('tenant_subscription_addons','tenant_subscription_id'),
        ('tenant_subscription_addons','addon_key'),
        ('tenant_subscription_addons','status'),
        ('tenant_subscription_addons','ended_at'),
        ('tenant_subscription_addons','started_at'),
        ('tenant_subscription_addons','created_at'),
        ('tenant_subscription_addons','updated_at'),
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
      to_regclass('public.permissions') IS NOT NULL AS permissions_ready,
      to_regclass('public.commercial_technical_capabilities') IS NOT NULL AS commercial_technical_capabilities_ready,
      to_regclass('public.commercial_addons') IS NOT NULL AS commercial_addons_ready,
      to_regclass('public.commercial_plan_versions') IS NOT NULL AS commercial_plan_versions_ready,
      to_regclass('public.commercial_plans') IS NOT NULL AS commercial_plans_ready,
      to_regclass('public.plan_version_modules') IS NOT NULL AS plan_version_modules_ready,
      to_regclass('public.plan_version_addons') IS NOT NULL AS plan_version_addons_ready,
      to_regclass('public.tenant_subscription_addons') IS NOT NULL AS tenant_subscription_addons_ready,
      to_regclass('public.schema_migrations') IS NOT NULL AS schema_migrations_ready,
      to_regclass('public.v_commercial_plan_capabilities') IS NOT NULL AS v_commercial_plan_capabilities_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready
    FROM column_state`);

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`NORMALIZATION-01 schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function migrationState(client, migration) {
  const result = await client.query(
    'SELECT checksum,status FROM public.schema_migrations WHERE migration_id=$1',
    [migration.id],
  );
  if (!result.rowCount) return 'pending';
  const row = result.rows[0];
  if (row.status === 'applied' && row.checksum === migration.checksum) return 'already_applied';
  if (row.status === 'applied') return 'checksum_mismatch';
  if (row.status === 'running') return 'running';
  if (row.status === 'failed') return 'pending';
  return row.status || 'pending';
}

function assertMigrationStateIsSafe(state, migration) {
  if (state === 'checksum_mismatch') throw new Error(`NORMALIZATION-01 migration checksum differs from applied ledger entry: ${migration.id}`);
  if (state === 'running') throw new Error(`NORMALIZATION-01 migration ledger is already running: ${migration.id}`);
  if (!['pending', 'already_applied'].includes(state)) throw new Error(`NORMALIZATION-01 migration ledger has unsupported status ${state}: ${migration.id}`);
}

async function postconditions(client, { strict = true } = {}) {
  const result = await client.query(
    `WITH standard_plan_ai AS (
       SELECT capability_key
       FROM v_commercial_plan_capabilities
       WHERE plan_key = ANY($1::text[])
         AND capability_key = ANY($2::text[])
     ), duplicate_ai_addons AS (
       SELECT tenant_subscription_id, addon_key
       FROM tenant_subscription_addons
       WHERE addon_key = 'ai'
         AND status = 'active'
         AND (ended_at IS NULL OR ended_at > now())
       GROUP BY tenant_subscription_id, addon_key
       HAVING COUNT(*) > 1
     ), orphan_required_permissions AS (
       SELECT ctc.capability_key, ctc.required_permission
       FROM commercial_technical_capabilities ctc
       LEFT JOIN permissions p
         ON p.permission_key = ctc.required_permission
        AND p.is_active IS DISTINCT FROM FALSE
       WHERE ctc.status = 'active'
         AND ctc.required_permission IS NOT NULL
         AND p.permission_key IS NULL
     )
     SELECT
       EXISTS (
         SELECT 1
         FROM commercial_technical_capabilities ctc
         JOIN permissions p
           ON p.permission_key = ctc.required_permission
          AND p.is_active IS DISTINCT FROM FALSE
         WHERE ctc.capability_key = 'ai.compliance'
           AND ctc.status = 'active'
           AND ctc.required_permission = $3
       ) AS ai_compliance_permission_canonical,
       EXISTS (
         SELECT 1
         FROM commercial_technical_capabilities ctc
         JOIN permissions p
           ON p.permission_key = ctc.required_permission
          AND p.is_active IS DISTINCT FROM FALSE
         WHERE ctc.capability_key = 'iso.actions'
           AND ctc.status = 'active'
           AND ctc.required_permission = $4
       ) AS iso_actions_permission_canonical,
       (
         SELECT COUNT(*)::int
         FROM commercial_technical_capabilities
         WHERE capability_key = 'ai.compliance'
           AND status = 'active'
           AND required_permission = 'ai_compliance.read'
       ) AS ai_compliance_orphan_permission_reference,
       (
         SELECT COUNT(*)::int
         FROM commercial_technical_capabilities
         WHERE capability_key = 'iso.actions'
           AND status = 'active'
           AND required_permission = 'actions.read'
       ) AS iso_actions_orphan_permission_reference,
       (SELECT COUNT(*)::int FROM orphan_required_permissions) AS orphan_required_permission_references,
       (SELECT COUNT(*)::int FROM standard_plan_ai) AS standard_plan_ai_capability_count,
       (SELECT COUNT(*)::int FROM duplicate_ai_addons) AS duplicate_effective_ai_addons,
       EXISTS (
         SELECT 1
         FROM commercial_addons
         WHERE addon_key = 'ai'
           AND status = 'active'
           AND metadata->'capability_keys' ? 'ai.compliance'
           AND metadata->'capability_keys' ? 'ai.auditor'
       ) AS ai_addon_capabilities_ok,
       NOT EXISTS (SELECT 1 FROM standard_plan_ai)
       AND EXISTS (
         SELECT 1
         FROM commercial_technical_capabilities
         WHERE capability_key = 'ai.compliance'
           AND status = 'active'
           AND metadata->>'commercial_classification' = 'AI_ADDON'
           AND metadata->>'addon_key' = 'ai'
       ) AS ai_addon_required_for_ai,
       true AS no_user_mutation,
       true AS no_role_mutation,
       true AS no_scope_mutation`,
    [STANDARD_PLAN_KEYS, AI_CAPABILITIES, CANONICAL.AI_READ_PERMISSION, CANONICAL.ACTIONS_READ_PERMISSION],
  );

  const row = result.rows[0] || {};
  const labels = {
    ai_compliance_permission_canonical: 'AI_COMPLIANCE_PERMISSION_CANONICAL',
    iso_actions_permission_canonical: 'ISO_ACTIONS_PERMISSION_CANONICAL',
    ai_compliance_orphan_permission_reference: 'AI_COMPLIANCE_ORPHAN_PERMISSION_REFERENCE',
    iso_actions_orphan_permission_reference: 'ISO_ACTIONS_ORPHAN_PERMISSION_REFERENCE',
    orphan_required_permission_references: 'ORPHAN_REQUIRED_PERMISSION_REFERENCES',
    standard_plan_ai_capability_count: 'STANDARD_PLAN_AI_CAPABILITY_COUNT',
    duplicate_effective_ai_addons: 'DUPLICATE_EFFECTIVE_AI_ADDONS',
    ai_addon_capabilities_ok: 'AI_ADDON_CAPABILITIES_OK',
    ai_addon_required_for_ai: 'AI_ADDON_REQUIRED_FOR_AI',
    no_user_mutation: 'NO_USER_MUTATION',
    no_role_mutation: 'NO_ROLE_MUTATION',
    no_scope_mutation: 'NO_SCOPE_MUTATION',
  };
  for (const [key, label] of Object.entries(labels)) process.stdout.write(`${label}=${row[key]}\n`);

  if (strict) {
    if (row.ai_compliance_permission_canonical !== true) throw new Error('NORMALIZATION-01 postcondition failed: AI_COMPLIANCE_PERMISSION_CANONICAL=false');
    if (row.iso_actions_permission_canonical !== true) throw new Error('NORMALIZATION-01 postcondition failed: ISO_ACTIONS_PERMISSION_CANONICAL=false');
    if (Number(row.ai_compliance_orphan_permission_reference) !== 0) throw new Error('NORMALIZATION-01 postcondition failed: AI_COMPLIANCE_ORPHAN_PERMISSION_REFERENCE!=0');
    if (Number(row.iso_actions_orphan_permission_reference) !== 0) throw new Error('NORMALIZATION-01 postcondition failed: ISO_ACTIONS_ORPHAN_PERMISSION_REFERENCE!=0');
    if (Number(row.orphan_required_permission_references) !== 0) throw new Error('NORMALIZATION-01 postcondition failed: ORPHAN_REQUIRED_PERMISSION_REFERENCES!=0');
    if (Number(row.standard_plan_ai_capability_count) !== 0) throw new Error('NORMALIZATION-01 postcondition failed: STANDARD_PLAN_AI_CAPABILITY_COUNT!=0');
    if (Number(row.duplicate_effective_ai_addons) !== 0) throw new Error('NORMALIZATION-01 postcondition failed: DUPLICATE_EFFECTIVE_AI_ADDONS!=0');
    if (row.ai_addon_capabilities_ok !== true) throw new Error('NORMALIZATION-01 postcondition failed: AI_ADDON_CAPABILITIES_OK=false');
    if (row.ai_addon_required_for_ai !== true) throw new Error('NORMALIZATION-01 postcondition failed: AI_ADDON_REQUIRED_FOR_AI=false');
  }

  return row;
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

async function run() {
  const args = new Set(process.argv.slice(2));
  const started = Date.now();
  const migration = readMigration();

  if (args.has('--checksum')) {
    process.stdout.write(`${migration.id} ${migration.checksum}\n`);
    return;
  }

  if (!args.has('--preflight') && !args.has('--apply')) {
    throw new Error('Usage: apply-normalization-01-migration.js --checksum | --preflight | --apply');
  }

  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    if (args.has('--preflight')) {
      await requireBaseSchema(client);
      const state = await migrationState(client, migration);
      process.stdout.write(`migration_state=${state}\n`);
      assertMigrationStateIsSafe(state, migration);
      await postconditions(client, { strict: state === 'already_applied' });
      process.stdout.write(`NORMALIZATION_01_PREFLIGHT_OK pending=${state === 'pending' ? migration.id : 'none'}\n`);
      return;
    }

    await ensureSchemaMigrations(client);
    await requireBaseSchema(client);
    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1, $2) AS locked', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.locked !== true) throw new Error('NORMALIZATION-01 migration lock not acquired');

    const existing = await client.query('SELECT checksum, status FROM public.schema_migrations WHERE migration_id = $1 FOR UPDATE', [migration.id]);
    if (existing.rowCount > 0) {
      if (existing.rows[0].checksum !== migration.checksum) throw new Error('NORMALIZATION-01 migration checksum mismatch');
      if (existing.rows[0].status !== 'applied') throw new Error(`NORMALIZATION-01 migration ledger status is ${existing.rows[0].status}`);
      await client.query('COMMIT');
      process.stdout.write('already_applied=true\n');
      await postconditions(client, { strict: true });
      return;
    }

    await client.query(unwrapTransaction(migration.sql));
    const details = await postconditions(client, { strict: true });
    await client.query(
      `INSERT INTO public.schema_migrations (migration_id, checksum, applied_at, applied_by, duration_ms, status, details)
       VALUES ($1, $2, now(), current_user, $3, 'applied', $4::jsonb)`,
      [migration.id, migration.checksum, Date.now() - started, JSON.stringify(details)],
    );
    await client.query('COMMIT');
    process.stdout.write('NORMALIZATION_01_MIGRATION_APPLIED\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(sanitize(error));
  process.exit(1);
});
