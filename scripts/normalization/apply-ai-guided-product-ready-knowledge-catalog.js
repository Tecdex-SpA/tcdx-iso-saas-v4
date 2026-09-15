#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260914_ai_guided_product_ready_knowledge_catalog',
  file: path.join(root, 'database/migrations/20260914_ai_guided_product_ready_knowledge_catalog.sql'),
});

const REQUIRED_PROBLEM_TYPES = Object.freeze([
  'access_review_missing',
  'backup_restore_test_missing',
  'kpi_deteriorated',
  'kpi_without_source',
  'risk_without_treatment',
  'high_residual_risk',
  'asset_without_owner',
  'supplier_without_evaluation',
  'training_without_record',
  'management_review_gap',
  'document_obsolete',
  'procedure_missing',
  'procedure_not_implemented',
  'control_not_executed',
  'finding_open',
  'finding_recurrent',
  'nonconformity_open',
  'action_overdue',
  'action_without_evidence',
  'missing_evidence',
  'weak_evidence',
  'expired_evidence',
  'invalid_evidence',
  'control_without_owner',
  'control_overdue_review',
]);

const LEGACY_AI_CORE_OBJECTS = Object.freeze([
  'problem_types',
  'priority_rules',
  'solution_playbooks',
  'evidence_expectations',
  'closure_criteria',
  'invalid_evidence_patterns',
  'response_templates',
  'domain_problem_type_map',
  'domain_solution_playbooks',
  'domain_evidence_expectations',
  'domain_closure_criteria',
  'domains_catalog',
  'standard_domain_map',
  'standard_specific_overrides',
  'standards_catalog',
  'trusted_external_sources',
  'v_ai_useful_feedback_cases',
  'v_finding_scenarios_active',
]);

const BUSINESS_TABLES = Object.freeze([
  'knowledge_sources',
  'knowledge_items',
  'knowledge_mappings',
  'knowledge_common_gaps',
  'knowledge_recommended_actions',
  'knowledge_evidence_expectations',
  'knowledge_audit_questions',
  'knowledge_rules',
  'knowledge_rule_hints',
]);

function sanitize(error) {
  return String(error?.message || 'AI Guided product-ready knowledge catalog migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function validateSql(sql) {
  const stripped = stripSqlComments(sql);
  const normalized = stripped.replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bpg_try_advisory_xact_lock\(844332,\s*2026091403\)/,
    /\bpublic\.knowledge_sources\b/,
    /\bpublic\.knowledge_items\b/,
    /\bpublic\.knowledge_mappings\b/,
    /\bpublic\.knowledge_recommended_actions\b/,
    /\bpublic\.knowledge_evidence_expectations\b/,
    /\bpublic\.knowledge_audit_questions\b/,
    /\bpublic\.knowledge_rules\b/,
    /\bpublic\.knowledge_rule_hints\b/,
    /\btecdx_ai_guided_problem_catalog_v1\b/,
    /\bofficial_standard_text'\s*,\s*false\b/,
    /\bcan_auto_close'\s*,\s*false\b/,
  ];
  for (const code of REQUIRED_PROBLEM_TYPES) {
    required.push(new RegExp(`"${code}"`));
  }
  const forbidden = [
    /\bgrant\b/,
    /\bdrop\s+\b/,
    /\btruncate\s+\b/,
    /\bdelete\s+from\b/,
    /\balter\s+(?:role|schema|database)\b/,
    /\bcreate\s+(?:role|schema|database)\b/,
    /\bon\s+all\s+tables\s+in\s+schema\b/,
    /\btcdx_backend_app\b/,
    /\bai_reader\b/,
    /\btcdx_saasv2\b/,
    /\b9d89ba9a-0e08-43ed-80ec-d85337d0890f\b/,
    /00000000-0000-0000-0000-000000000000/,
    /@tcdx\.local\b/,
    /@tecdex\.net\b/,
  ];
  for (const legacy of LEGACY_AI_CORE_OBJECTS) {
    forbidden.push(new RegExp(`\\bai_core\\.${legacy}\\b`));
  }
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`AI Guided product-ready knowledge catalog SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`AI Guided product-ready knowledge catalog SQL missing required token: ${missing}`);
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) {
    throw new Error(`migration file missing: ${path.relative(root, MIGRATION.file)}`);
  }
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for AI Guided product-ready knowledge catalog');
  }
  return value;
}

function unwrapTransaction(sql) {
  const lines = sql.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().toUpperCase() === 'BEGIN;');
  const commit = lines.findIndex((line) => line.trim().toUpperCase() === 'COMMIT;');
  if (begin < 0 || commit <= begin) throw new Error('migration must contain one outer BEGIN/COMMIT pair');
  return [...lines.slice(0, begin), ...lines.slice(begin + 1, commit), ...lines.slice(commit + 1)].join('\n');
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

async function schemaMigrationsExists(client) {
  const result = await client.query("SELECT to_regclass('public.schema_migrations') AS regclass");
  return Boolean(result.rows[0]?.regclass);
}

async function readLedger(client, migrationId) {
  const result = await client.query(
    'SELECT migration_id, checksum, status FROM public.schema_migrations WHERE migration_id = $1',
    [migrationId],
  );
  return result.rows[0] || null;
}

async function readLedgerIfExists(client, migrationId) {
  if (!(await schemaMigrationsExists(client))) {
    return { schema_migrations_present: false, row: null };
  }
  return { schema_migrations_present: true, row: await readLedger(client, migrationId) };
}

async function assertRequiredTables(client) {
  const required = [
    'knowledge_sources',
    'knowledge_items',
    'knowledge_mappings',
    'knowledge_common_gaps',
    'knowledge_recommended_actions',
    'knowledge_evidence_expectations',
    'knowledge_audit_questions',
    'knowledge_rules',
    'knowledge_rule_hints',
  ];
  const result = await client.query(`
    SELECT relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY($1::text[])
      AND c.relkind IN ('r','p','v','m')
  `, [required]);
  const found = new Set(result.rows.map((row) => row.relname));
  const missing = required.filter((name) => !found.has(name));
  if (missing.length) {
    throw new Error(`AI_GUIDED_REQUIRED_CANONICAL_TABLES_MISSING=${missing.join(',')}`);
  }
}

async function readBusinessCounts(client) {
  const counts = {};
  for (const table of BUSINESS_TABLES) {
    const result = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
    counts[table] = Number(result.rows[0]?.count || 0);
  }

  const ledger = await readLedgerIfExists(client, MIGRATION.id);
  counts.schema_migrations_present = ledger.schema_migrations_present;
  counts.schema_migrations_row = ledger.row
    ? {
      checksum: ledger.row.checksum,
      status: ledger.row.status,
    }
    : null;
  return counts;
}

async function assertPostconditions(client) {
  const coverage = await client.query(`
    WITH required(problem_type_code) AS (
      SELECT unnest($1::text[])
    )
    SELECT
      count(*) FILTER (WHERE i.item_key IS NOT NULL) AS item_count,
      count(*) FILTER (
        WHERE i.item_key IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.knowledge_mappings m WHERE m.item_key = i.item_key)
          AND EXISTS (SELECT 1 FROM public.knowledge_recommended_actions a WHERE a.item_key = i.item_key)
          AND EXISTS (SELECT 1 FROM public.knowledge_evidence_expectations e WHERE e.item_key = i.item_key)
          AND EXISTS (SELECT 1 FROM public.knowledge_audit_questions q WHERE q.item_key = i.item_key)
          AND EXISTS (SELECT 1 FROM public.knowledge_rules r WHERE r.item_key = i.item_key)
      ) AS fully_covered_count
    FROM required r
    LEFT JOIN public.knowledge_items i
      ON i.item_key = r.problem_type_code
     AND i.source_key = 'tecdx_ai_guided_problem_catalog_v1'
     AND i.item_type = 'ai_guided_problem_catalog'
     AND i.is_active IS DISTINCT FROM false
  `, [REQUIRED_PROBLEM_TYPES]);
  const row = coverage.rows[0] || {};
  if (Number(row.item_count) !== REQUIRED_PROBLEM_TYPES.length || Number(row.fully_covered_count) !== REQUIRED_PROBLEM_TYPES.length) {
    throw new Error(`AI_GUIDED_KNOWLEDGE_COVERAGE_FAIL items=${row.item_count} fully_covered=${row.fully_covered_count}`);
  }

  const requiredCases = await client.query(`
    SELECT i.item_key,
      EXISTS (SELECT 1 FROM public.knowledge_mappings m WHERE m.item_key = i.item_key) AS has_mapping,
      EXISTS (SELECT 1 FROM public.knowledge_recommended_actions a WHERE a.item_key = i.item_key) AS has_action,
      EXISTS (SELECT 1 FROM public.knowledge_evidence_expectations e WHERE e.item_key = i.item_key) AS has_evidence
    FROM public.knowledge_items i
    WHERE i.item_key IN ('access_review_missing', 'missing_evidence')
      AND i.source_key = 'tecdx_ai_guided_problem_catalog_v1'
  `);
  if (requiredCases.rows.length !== 2 || requiredCases.rows.some((r) => !r.has_mapping || !r.has_action || !r.has_evidence)) {
    throw new Error('AI_GUIDED_REQUIRED_CASE_COVERAGE_FAIL access_review_missing/missing_evidence incomplete');
  }

  const legacy = await client.query(`
    SELECT count(*)::int AS count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ai_core'
      AND c.relname = ANY($1::text[])
  `, [LEGACY_AI_CORE_OBJECTS]);
  if (Number(legacy.rows[0]?.count || 0) !== 0) {
    throw new Error(`LEGACY_AI_CORE_OBJECTS_PRESENT=${legacy.rows[0].count}`);
  }
}

async function preflightMigration(client, migration) {
  await assertRequiredTables(client);
  const ledger = await readLedgerIfExists(client, migration.id);
  const state = {
    migration_state: 'pending',
    ledger_status: ledger.schema_migrations_present ? 'no_row' : 'schema_migrations_absent',
    schema_migrations_present: ledger.schema_migrations_present,
    checksum: migration.checksum,
    business_counts: await readBusinessCounts(client),
  };

  if (!ledger.row) {
    return state;
  }

  state.ledger_status = ledger.row.status;
  if (ledger.row.status === 'applied') {
    if (ledger.row.checksum !== migration.checksum) {
      state.migration_state = 'checksum_mismatch';
      throw new Error(`schema_migrations checksum mismatch for ${migration.id}`);
    }
    await assertPostconditions(client);
    state.migration_state = 'already_applied';
    return state;
  }

  if (ledger.row.status === 'running') {
    state.migration_state = 'running';
    throw new Error(`schema_migrations running state present for ${migration.id}`);
  }

  if (ledger.row.status === 'failed') {
    state.migration_state = 'pending';
    state.ledger_status = 'failed';
  }

  return state;
}

async function applyMigration(client, migration) {
  const existing = await readLedger(client, migration.id);
  if (existing?.status === 'applied') {
    if (existing.checksum !== migration.checksum) {
      throw new Error(`schema_migrations checksum mismatch for ${migration.id}`);
    }
    await assertPostconditions(client);
    return { applied: false, status: 'already_applied', checksum: migration.checksum };
  }

  const started = Date.now();
  await client.query('BEGIN');
  try {
    await client.query(`
      INSERT INTO public.schema_migrations (migration_id, checksum, applied_by, status, details)
      VALUES ($1, $2, current_user, 'running', '{}'::jsonb)
      ON CONFLICT (migration_id) DO UPDATE SET
        checksum = EXCLUDED.checksum,
        applied_by = current_user,
        applied_at = NULL,
        status = 'running',
        details = '{}'::jsonb
      WHERE public.schema_migrations.status <> 'applied'
    `, [migration.id, migration.checksum]);
    await client.query(unwrapTransaction(migration.sql));
    await assertPostconditions(client);
    await client.query(`
      UPDATE public.schema_migrations
      SET status = 'applied',
          applied_at = now(),
          applied_by = current_user,
          duration_ms = $2,
          details = jsonb_build_object(
            'required_problem_types', $3::text[],
            'source_key', 'tecdx_ai_guided_problem_catalog_v1'
          )
      WHERE migration_id = $1
    `, [migration.id, Date.now() - started, REQUIRED_PROBLEM_TYPES]);
    await client.query('COMMIT');
    return { applied: true, status: 'applied', checksum: migration.checksum };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    await client.query(`
      INSERT INTO public.schema_migrations (migration_id, checksum, applied_by, status, details)
      VALUES ($1, $2, current_user, 'failed', jsonb_build_object('error', $3))
      ON CONFLICT (migration_id) DO UPDATE SET
        checksum = EXCLUDED.checksum,
        applied_by = current_user,
        applied_at = now(),
        status = 'failed',
        details = jsonb_build_object('error', $3)
    `, [migration.id, migration.checksum, sanitize(error)]).catch(() => {});
    throw error;
  }
}

function parseMode(argv) {
  const args = argv.filter(Boolean);
  if (args.length !== 1 || !['--checksum', '--preflight', '--apply'].includes(args[0])) {
    throw new Error('usage: apply-ai-guided-product-ready-knowledge-catalog.js --checksum|--preflight|--apply');
  }
  return args[0];
}

async function main() {
  let client = null;
  try {
    const mode = parseMode(process.argv.slice(2));
    const migration = readMigration();
    if (mode === '--checksum') {
      console.log(JSON.stringify({
        ok: true,
        command: 'checksum',
        migration_id: migration.id,
        checksum: migration.checksum,
        required_problem_types: REQUIRED_PROBLEM_TYPES.length,
        source_key: 'tecdx_ai_guided_problem_catalog_v1',
      }, null, 2));
      return;
    }

    client = new Client({ connectionString: databaseUrl() });
    await client.connect();
    const result = mode === '--preflight'
      ? await preflightMigration(client, migration)
      : await (async () => {
        await ensureSchemaMigrations(client);
        return applyMigration(client, migration);
      })();
    console.log(JSON.stringify({
      ok: true,
      command: mode.replace(/^--/, ''),
      migration_id: migration.id,
      status: result.status,
      applied: result.applied,
      migration_state: result.migration_state || result.status,
      ledger_status: result.ledger_status,
      checksum: result.checksum,
      required_problem_types: REQUIRED_PROBLEM_TYPES.length,
      source_key: 'tecdx_ai_guided_problem_catalog_v1',
      business_counts: result.business_counts,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: sanitize(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.end().catch(() => {});
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  MIGRATION,
  REQUIRED_PROBLEM_TYPES,
  LEGACY_AI_CORE_OBJECTS,
  applyMigration,
  assertPostconditions,
  assertRequiredTables,
  ensureSchemaMigrations,
  preflightMigration,
  readMigration,
  readBusinessCounts,
  validateSql,
};
