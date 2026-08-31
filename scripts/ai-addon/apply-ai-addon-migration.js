#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260831_ai_addon_commercial_visibility',
  file: path.join(root, 'database/migrations/20260831_ai_addon_commercial_visibility.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026083101;
const STANDARD_PLAN_KEYS = Object.freeze(['pyme', 'empresa', 'enterprise']);
const AI_CAPABILITIES = Object.freeze(['ai.compliance', 'ai.auditor']);

function sanitize(error) {
  return String(error?.message || 'AI Add-on migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .slice(0, 1000);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`AI Add-on migration file missing: ${path.relative(root, MIGRATION.file)}`);
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
    /\binsert\s+into\s+(?:public\.)?tenant_subscription_addons\b/,
    /\bcreate\s+or\s+replace\s+view\s+v_commercial_tenant_modules\b/,
    /\bcreate\s+or\s+replace\s+view\s+v_commercial_tenant_capabilities\b/,
    /'ai\.compliance'/,
    /'ai\.auditor'/,
    /'ai'/,
  ];
  const forbidden = [
    /\binsert\s+into\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_contracts)\b/,
    /\bupdate\s+(?:public\.)?(users|app_roles|role_permissions|permissions|tenant_contracts)\b/,
    /\bdelete\s+from\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\balter\s+\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`AI Add-on migration contains forbidden SQL scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`AI Add-on migration missing expected SQL operation/token: ${missing}`);
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for AI Add-on migrations');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('AI Add-on migration must contain one outer BEGIN/COMMIT pair');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
}

async function requireBaseSchema(client) {
  const result = await client.query(`WITH required_columns(table_name, column_name) AS (
      VALUES
        ('commercial_addons','addon_key'),
        ('commercial_addons','metadata'),
        ('commercial_plan_versions','id'),
        ('commercial_plan_versions','plan_key'),
        ('plan_version_addons','plan_version_id'),
        ('plan_version_addons','addon_key'),
        ('tenant_subscription_addons','tenant_subscription_id'),
        ('tenant_subscription_addons','addon_key'),
        ('tenant_subscription_addons','status'),
        ('commercial_technical_capabilities','capability_key'),
        ('schema_migrations','migration_id'),
        ('schema_migrations','checksum'),
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
      to_regclass('public.plan_version_addons') IS NOT NULL AS plan_version_addons_ready,
      to_regclass('public.tenant_subscription_addons') IS NOT NULL AS tenant_subscription_addons_ready,
      to_regclass('public.v_commercial_tenant_capabilities') IS NOT NULL AS v_commercial_tenant_capabilities_ready,
      COALESCE(bool_and(ready), false) AS required_columns_ready
    FROM column_state`);

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  const failed = Object.entries(row).filter(([key, value]) => key !== 'migration_user' && value !== true);
  if (failed.length) throw new Error(`AI Add-on schema preflight failed: ${failed.map(([key]) => key).join(', ')}`);
}

async function postconditions(client) {
  const result = await client.query(
    `WITH standard_versions AS (
       SELECT id
       FROM commercial_plan_versions
       WHERE status = 'published'
         AND plan_key = ANY($1::text[])
     ), ai_plan_capabilities AS (
       SELECT capability_key
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
       NOT EXISTS (SELECT 1 FROM ai_plan_capabilities) AS base_plans_do_not_include_ai,
       (
         SELECT COUNT(*)::int
         FROM standard_versions sv
         JOIN plan_version_addons pva
           ON pva.plan_version_id = sv.id
          AND pva.addon_key = 'ai'
          AND pva.included = true
       ) AS compatible_plan_versions,
       (SELECT COUNT(*)::int FROM standard_versions) AS standard_plan_versions
     `,
    [STANDARD_PLAN_KEYS, AI_CAPABILITIES],
  );

  const row = result.rows[0] || {};
  for (const [key, value] of Object.entries(row)) process.stdout.write(`${key}=${value}\n`);
  if (row.ai_addon_ready !== true) throw new Error('AI Add-on postcondition failed: ai_addon_ready=false');
  if (Number(row.ai_capabilities_ready) !== AI_CAPABILITIES.length) throw new Error('AI Add-on postcondition failed: ai capabilities not classified as AI_ADDON');
  if (row.base_plans_do_not_include_ai !== true) throw new Error('AI Add-on postcondition failed: base plans still include AI capabilities');
  if (Number(row.compatible_plan_versions) !== Number(row.standard_plan_versions)) throw new Error('AI Add-on postcondition failed: not all standard plan versions can contract AI');
  return row;
}

async function ensureSchemaMigrations(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_id text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'applied',
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
}

async function run() {
  const args = new Set(process.argv.slice(2));
  const migration = readMigration();

  if (args.has('--checksum')) {
    process.stdout.write(`${migration.id} ${migration.checksum}\n`);
    return;
  }

  if (!args.has('--preflight') && !args.has('--apply')) {
    throw new Error('Usage: apply-ai-addon-migration.js --checksum | --preflight | --apply');
  }

  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await ensureSchemaMigrations(client);
    await requireBaseSchema(client);
    if (args.has('--preflight')) {
      await postconditions(client).catch((error) => {
        process.stdout.write(`postconditions=pending (${sanitize(error)})\n`);
      });
      return;
    }

    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock($1, $2) AS locked', [LOCK_NAMESPACE, LOCK_KEY]);
    if (lock.rows[0]?.locked !== true) throw new Error('AI Add-on migration lock not acquired');

    const existing = await client.query('SELECT checksum, status FROM schema_migrations WHERE migration_id = $1 FOR UPDATE', [migration.id]);
    if (existing.rowCount > 0) {
      if (existing.rows[0].checksum !== migration.checksum) throw new Error('AI Add-on migration checksum mismatch');
      await client.query('COMMIT');
      process.stdout.write('already_applied=true\n');
      await postconditions(client);
      return;
    }

    await client.query(unwrapTransaction(migration.sql));
    const details = await postconditions(client);
    await client.query(
      `INSERT INTO schema_migrations (migration_id, checksum, status, details)
       VALUES ($1, $2, 'applied', $3::jsonb)`,
      [migration.id, migration.checksum, JSON.stringify(details)],
    );
    await client.query('COMMIT');
    process.stdout.write('AI_ADDON_MIGRATION_APPLIED\n');
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
