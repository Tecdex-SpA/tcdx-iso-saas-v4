#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

const MIGRATION = Object.freeze({
  id: '20260914_ai_guided_canonical_knowledge_runtime_grants',
  file: path.join(root, 'database/migrations/20260914_ai_guided_canonical_knowledge_runtime_grants.sql'),
});

const LOCK_NAMESPACE = 844332;
const LOCK_KEY = 2026091402;

const CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS = Object.freeze([
  'public.knowledge_audit_questions',
  'public.knowledge_common_gaps',
  'public.knowledge_evidence_expectations',
  'public.knowledge_mappings',
  'public.knowledge_recommended_actions',
  'public.knowledge_rule_hints',
  'public.knowledge_rules',
]);

const PREEXISTING_CANONICAL_KNOWLEDGE_RUNTIME_SELECT_RELATIONS = Object.freeze([
  'public.iso_evidence_expectations',
  'public.knowledge_items',
  'public.knowledge_sources',
  'public.recommendation_decision_ledger',
  'public.tenant_applicable_evidence_requirements',
]);

const RUNTIME_PUBLIC_SELECT_CONTRACT_FILES = Object.freeze([
  'database/baseline/production_schema_v1.sql',
  'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql',
  'database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql',
  'database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql',
  'database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql',
  'database/migrations/20260910_tcdx_fresh_baseline_runtime_dependency_systemic_closeout.sql',
  'database/migrations/20260910_tcdx_saasv2_grc_runtime_contract_closeout_v3.sql',
  'database/migrations/20260911_tcdx_control_lifecycle_systemic_closeout.sql',
  'database/migrations/20260911_tcdx_post_lifecycle_runtime_consumers_systemic_closeout.sql',
  'database/migrations/20260914_ai_core_runtime_context_view_grants.sql',
  'database/migrations/20260914_ai_guided_canonical_knowledge_runtime_grants.sql',
]);

function sanitize(error) {
  return String(error?.message || 'AI Guided canonical knowledge runtime grants migration error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .slice(0, 1200);
}

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeRelationToken(token) {
  let value = token.trim().replace(/^ONLY\s+/i, '').replace(/^(TABLE|VIEW|MATERIALIZED\s+VIEW)\s+/i, '');
  value = value.replace(/\s+/g, '');
  if (!value || value.includes('(')) return null;
  value = value.replace(/"/g, '').toLowerCase();
  if (!value.includes('.')) value = `public.${value}`;
  const parts = value.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return `${parts[0]}.${parts[1]}`;
}

function extractRuntimeSelectRelationsFromSql(sql) {
  const relations = new Set();
  const text = stripSqlComments(sql);
  const grantPattern = /^\s*GRANT\s+([\s\S]+?)\s+ON\s+([\s\S]+?)\s+TO\s+([\s\S]+?)\s*$/i;
  for (const statement of text.split(';')) {
    const match = statement.match(grantPattern);
    if (!match) continue;
    const privileges = match[1];
    const objectClause = match[2].trim();
    const grantees = match[3];
    if (!/\bSELECT\b/i.test(privileges)) continue;
    if (!/\btcdx_backend_runtime\b/i.test(grantees)) continue;
    if (/^(SCHEMA|FUNCTION|PROCEDURE|SEQUENCE|TYPE|DATABASE)\b/i.test(objectClause)) continue;
    for (const token of objectClause.split(',')) {
      const relation = normalizeRelationToken(token);
      if (relation && relation.startsWith('public.')) relations.add(relation);
    }
  }
  return [...relations].sort();
}

function readAuthorizedRuntimePublicSelectRelations() {
  const authorized = new Set();
  for (const relativeFile of RUNTIME_PUBLIC_SELECT_CONTRACT_FILES) {
    const file = path.join(root, relativeFile);
    if (!fs.existsSync(file)) throw new Error(`runtime ACL contract file missing: ${relativeFile}`);
    for (const relation of extractRuntimeSelectRelationsFromSql(fs.readFileSync(file, 'utf8'))) {
      authorized.add(relation);
    }
  }
  for (const relation of CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS) authorized.add(relation);
  return [...authorized].sort();
}

const AUTHORIZED_RUNTIME_PUBLIC_SELECT_RELATIONS = Object.freeze(readAuthorizedRuntimePublicSelectRelations());

const authorizedRuntimePublicSelectValuesSql = AUTHORIZED_RUNTIME_PUBLIC_SELECT_RELATIONS
  .map((relation) => `('${relation}')`)
  .join(',\n        ');

function validateSql(sql) {
  const stripped = stripSqlComments(sql);
  const normalized = stripped.replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    /\bpg_try_advisory_xact_lock\(844332,\s*2026091402\)/,
    /\bto_regrole\('tcdx_backend_runtime'\)/,
    /\bto_regrole\('tcdx_backend_app'\)/,
    /\bto_regnamespace\('public'\)/,
    /\bhas_schema_privilege\('tcdx_backend_runtime',\s*'public',\s*'usage'\)/,
    /\bpg_has_role\('tcdx_backend_app',\s*'tcdx_backend_runtime',\s*'member'\)/,
    /\brolinherit\b[\s\S]*\btcdx_backend_app\b/,
    /\brolcanlogin\b[\s\S]*\btcdx_backend_runtime\b/,
    /\baclexplode\b[\s\S]*\btcdx_backend_app\b/,
  ];
  for (const relation of CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS) {
    required.push(new RegExp(`\\bgrant\\s+select\\s+on\\s+${relation.replace('.', '\\.')}\\s+to\\s+tcdx_backend_runtime\\b`));
    required.push(new RegExp(`'${relation.split('.')[1]}'`));
  }
  const forbidden = [
    /\bgrant\s+all\b/,
    /\bgrant\s+[^;]*\bon\s+all\s+tables\s+in\s+schema\b/,
    /\bgrant\s+[^;]*\bto\s+tcdx_backend_app\b/,
    /\bgrant\s+[^;]*\bto\s+ai_reader\b/,
    /\bgrant\s+usage\s+on\s+schema\b/,
    /\balter\s+(?:view|table|schema|role)\b/,
    /\bcreate\s+(?:view|table|schema|role)\b/,
    /\bdrop\s+\b/,
    /\binsert\s+into\s+(?!schema_migrations\b)/,
    /\bdelete\s+from\b/,
    /\bupdate\s+(?!schema_migrations\b)/,
    /\btruncate\s+\b/,
    /\bowner\s+to\b/,
    /\btecdex_saas\b/,
    /\btcdx_saasv2\b/,
    /@tcdx\.local\b/,
    /@tecdex\.net\b/,
  ];
  const violation = forbidden.find((pattern) => pattern.test(normalized));
  if (violation) throw new Error(`AI Guided canonical knowledge runtime grants SQL contains forbidden scope: ${violation}`);
  const missing = required.find((pattern) => !pattern.test(normalized));
  if (missing) throw new Error(`AI Guided canonical knowledge runtime grants SQL missing required token: ${missing}`);

  const grantMatches = normalized.match(/\bgrant\s+select\s+on\s+public\.knowledge_[a-z_]+\s+to\s+tcdx_backend_runtime\b/g) || [];
  if (grantMatches.length !== CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS.length) {
    throw new Error(`AI Guided canonical knowledge runtime grants SQL must contain exactly ${CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS.length} SELECT grants`);
  }
}

function readMigration() {
  if (!fs.existsSync(MIGRATION.file)) throw new Error(`migration file missing: ${path.relative(root, MIGRATION.file)}`);
  const sql = fs.readFileSync(MIGRATION.file, 'utf8');
  validateSql(sql);
  return { ...MIGRATION, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
}

function databaseUrl() {
  const value = String(process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error('MIGRATION_DATABASE_URL is required for AI Guided canonical knowledge runtime grants');
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

async function requireBaseContract(client) {
  const result = await client.query(`
    WITH required_relations(name) AS (
      VALUES
        ('knowledge_audit_questions'),
        ('knowledge_common_gaps'),
        ('knowledge_evidence_expectations'),
        ('knowledge_mappings'),
        ('knowledge_recommended_actions'),
        ('knowledge_rule_hints'),
        ('knowledge_rules')
    )
    SELECT
      current_user AS migration_user,
      current_database() AS migration_database,
      to_regrole('tcdx_backend_runtime') IS NOT NULL AS runtime_role_exists,
      to_regrole('tcdx_backend_app') IS NOT NULL AS app_role_exists,
      to_regnamespace('public') IS NOT NULL AS public_schema_exists,
      COALESCE(bool_and(to_regclass('public.' || name) IS NOT NULL), false) AS required_relations_exist,
      has_schema_privilege('tcdx_backend_runtime', 'public', 'USAGE') AS runtime_schema_usage,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS runtime_can_login,
      COALESCE(pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member'), false) AS app_member_of_runtime,
      (
        SELECT rolinherit
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_app'
      ) AS app_inherit
    FROM required_relations
  `);
  const row = result.rows[0] || {};
  process.stdout.write(`migration_user=${row.migration_user}\n`);
  process.stdout.write(`migration_database=${row.migration_database}\n`);
  process.stdout.write(`runtime_role_exists=${row.runtime_role_exists}\n`);
  process.stdout.write(`app_role_exists=${row.app_role_exists}\n`);
  process.stdout.write(`public_schema_exists=${row.public_schema_exists}\n`);
  process.stdout.write(`required_relations_exist=${row.required_relations_exist}\n`);
  process.stdout.write(`runtime_schema_usage=${row.runtime_schema_usage}\n`);
  process.stdout.write(`runtime_can_login=${row.runtime_can_login}\n`);
  process.stdout.write(`app_member_of_runtime=${row.app_member_of_runtime}\n`);
  process.stdout.write(`app_inherit=${row.app_inherit}\n`);
  if (
    row.runtime_role_exists !== true ||
    row.app_role_exists !== true ||
    row.public_schema_exists !== true ||
    row.required_relations_exist !== true ||
    row.runtime_schema_usage !== true ||
    row.runtime_can_login !== false ||
    row.app_member_of_runtime !== true ||
    row.app_inherit !== true
  ) {
    throw new Error('AI Guided canonical knowledge runtime grants base preflight failed');
  }
}

async function fetchCurrentState(client) {
  const result = await client.query(`
    WITH required_relations(name) AS (
      VALUES
        ('public.knowledge_audit_questions'),
        ('public.knowledge_common_gaps'),
        ('public.knowledge_evidence_expectations'),
        ('public.knowledge_mappings'),
        ('public.knowledge_recommended_actions'),
        ('public.knowledge_rule_hints'),
        ('public.knowledge_rules')
    ),
    authorized_runtime_select(name) AS (
      VALUES
        ${authorizedRuntimePublicSelectValuesSql}
    ),
    relation_oids AS (
      SELECT name, to_regclass(name) AS relation_oid
      FROM required_relations
    )
    SELECT
      has_schema_privilege('tcdx_backend_runtime', 'public', 'USAGE') AS runtime_schema_usage,
      COALESCE(bool_and(relation_oid IS NOT NULL), false) AS required_relations_exist,
      COALESCE(count(*) FILTER (WHERE has_table_privilege('tcdx_backend_runtime', relation_oid, 'SELECT')), 0)::int AS runtime_select_count,
      COALESCE(bool_and(has_table_privilege('tcdx_backend_runtime', relation_oid, 'SELECT')), false) AS runtime_select_ready,
      COALESCE(bool_and(has_table_privilege('tcdx_backend_app', relation_oid, 'SELECT')), false) AS app_inherited_select_ready,
      COALESCE(count(*) FILTER (WHERE has_table_privilege('ai_reader', relation_oid, 'SELECT')), 0)::int AS ai_reader_select_count,
      COALESCE(count(*) FILTER (
        WHERE has_table_privilege('tcdx_backend_runtime', relation_oid, 'INSERT')
           OR has_table_privilege('tcdx_backend_runtime', relation_oid, 'UPDATE')
           OR has_table_privilege('tcdx_backend_runtime', relation_oid, 'DELETE')
           OR has_table_privilege('tcdx_backend_runtime', relation_oid, 'TRUNCATE')
           OR has_table_privilege('tcdx_backend_runtime', relation_oid, 'REFERENCES')
           OR has_table_privilege('tcdx_backend_runtime', relation_oid, 'TRIGGER')
      ), 0)::int AS runtime_dml_count,
      (
        SELECT count(*)::int
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
        JOIN pg_roles grantee ON grantee.oid = acl.grantee
        WHERE n.nspname = 'public'
          AND n.nspname || '.' || c.relname IN (SELECT name FROM required_relations)
          AND grantee.rolname = 'tcdx_backend_app'
          AND acl.privilege_type = 'SELECT'
      ) AS app_direct_select_count,
      (
        SELECT rolcanlogin
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
      ) AS runtime_can_login,
      COALESCE(pg_has_role('tcdx_backend_app', 'tcdx_backend_runtime', 'member'), false) AS app_member_of_runtime,
      (
        SELECT rolinherit
        FROM pg_roles
        WHERE rolname = 'tcdx_backend_app'
      ) AS app_inherit,
      (
        SELECT count(*)::int
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r','v','m','p')
          AND has_table_privilege('tcdx_backend_runtime', c.oid, 'SELECT')
          AND NOT EXISTS (
            SELECT 1
            FROM authorized_runtime_select allowed
            WHERE to_regclass(allowed.name) = c.oid
          )
      ) AS unexpected_runtime_public_select_count
    FROM relation_oids
  `);
  return result.rows[0] || {};
}

function preApplyStatePasses(state) {
  return (
    state.runtime_schema_usage === true &&
    state.required_relations_exist === true &&
    Number(state.runtime_select_count || 0) >= 0 &&
    Number(state.runtime_select_count || 0) <= CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS.length &&
    Number(state.ai_reader_select_count || 0) === 0 &&
    Number(state.runtime_dml_count || 0) === 0 &&
    Number(state.app_direct_select_count || 0) === 0 &&
    state.runtime_can_login === false &&
    state.app_member_of_runtime === true &&
    state.app_inherit === true &&
    Number(state.unexpected_runtime_public_select_count || 0) === 0
  );
}

function postApplyStatePasses(state) {
  return (
    state.runtime_schema_usage === true &&
    state.required_relations_exist === true &&
    Number(state.runtime_select_count || 0) === CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS.length &&
    state.runtime_select_ready === true &&
    state.app_inherited_select_ready === true &&
    Number(state.ai_reader_select_count || 0) === 0 &&
    Number(state.runtime_dml_count || 0) === 0 &&
    Number(state.app_direct_select_count || 0) === 0 &&
    state.runtime_can_login === false &&
    state.app_member_of_runtime === true &&
    state.app_inherit === true &&
    Number(state.unexpected_runtime_public_select_count || 0) === 0
  );
}

function printState(state) {
  for (const [key, value] of Object.entries(state)) process.stdout.write(`${key}=${value}\n`);
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
    const error = new Error(`AI Guided canonical knowledge runtime grants checksum differs from applied ledger entry: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (state === 'running') {
    const error = new Error(`AI Guided canonical knowledge runtime grants ledger is already running: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
  if (!['pending', 'already_applied'].includes(state)) {
    const error = new Error(`AI Guided canonical knowledge runtime grants ledger has unsupported status ${state}: ${migration.id}`);
    error.preserveLedger = true;
    throw error;
  }
}

async function readLedgerState(client, migration) {
  const result = await client.query(
    'SELECT migration_id, checksum, status FROM public.schema_migrations WHERE migration_id = $1',
    [migration.id]
  );
  const state = migrationStateFromRows(result.rows, migration);
  process.stdout.write(`migration_state=${state}\n`);
  assertMigrationStateIsSafe(state, migration);
  return state;
}

async function preflight() {
  const migration = readMigration();
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await ensureSchemaMigrations(client);
    await requireBaseContract(client);
    const state = await readLedgerState(client, migration);
    const current = await fetchCurrentState(client);
    printState(current);
    if (state === 'already_applied') {
      if (!postApplyStatePasses(current)) throw new Error('AI Guided canonical knowledge runtime grants postconditions failed for applied migration');
    } else if (!preApplyStatePasses(current)) {
      throw new Error('AI Guided canonical knowledge runtime grants pre-apply state failed closed');
    }
    process.stdout.write(`checksum=${migration.checksum}\n`);
    process.stdout.write('AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_PREFLIGHT_PASS\n');
  } finally {
    await client.end();
  }
}

async function apply() {
  const migration = readMigration();
  const client = new Client({ connectionString: databaseUrl() });
  const started = Date.now();
  let ledgerWritten = false;
  await client.connect();
  try {
    await ensureSchemaMigrations(client);
    await requireBaseContract(client);
    const state = await readLedgerState(client, migration);
    if (state !== 'already_applied') {
      const before = await fetchCurrentState(client);
      printState(before);
      if (!preApplyStatePasses(before)) {
        throw new Error('AI Guided canonical knowledge runtime grants pre-apply state failed closed');
      }
      await client.query('BEGIN');
      const lock = await client.query('SELECT pg_try_advisory_xact_lock($1,$2) AS locked', [LOCK_NAMESPACE, LOCK_KEY]);
      if (lock.rows[0]?.locked !== true) throw new Error('AI Guided canonical knowledge runtime grants runner lock not available');
      await client.query(
        `INSERT INTO public.schema_migrations (migration_id, checksum, applied_by, status, details)
         VALUES ($1, $2, current_user, 'running', '{}'::jsonb)
         ON CONFLICT (migration_id)
         DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = current_user, status = 'running', details = '{}'::jsonb`,
        [migration.id, migration.checksum]
      );
      ledgerWritten = true;
      await client.query(unwrapTransaction(migration.sql));
      const current = await fetchCurrentState(client);
      if (!postApplyStatePasses(current)) {
        printState(current);
        throw new Error('AI Guided canonical knowledge runtime grants postconditions failed after apply');
      }
      await client.query(
        `UPDATE public.schema_migrations
         SET status = 'applied', applied_at = now(), duration_ms = $2, details = $3::jsonb
         WHERE migration_id = $1`,
        [
          migration.id,
          Date.now() - started,
          JSON.stringify({ canonical_knowledge_runtime_select_grants: CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS }),
        ]
      );
      await client.query('COMMIT');
    }
    const finalState = await fetchCurrentState(client);
    printState(finalState);
    process.stdout.write(`checksum=${migration.checksum}\n`);
    process.stdout.write(state === 'already_applied' ? 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_ALREADY_APPLIED\n' : 'AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_APPLY_PASS\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    if (ledgerWritten && !error.preserveLedger) {
      await client.query(
        `UPDATE public.schema_migrations
         SET status = 'failed', duration_ms = $2, details = $3::jsonb
         WHERE migration_id = $1`,
        [migration.id, Date.now() - started, JSON.stringify({ error: sanitize(error) })]
      ).catch(() => null);
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const mode = process.argv[2];
  try {
    if (mode === '--checksum') {
      const migration = readMigration();
      process.stdout.write(`${migration.checksum}\n`);
      return;
    }
    if (mode === '--preflight') return await preflight();
    if (mode === '--apply') return await apply();
    throw new Error('Usage: apply-ai-guided-canonical-knowledge-runtime-grants.js --checksum|--preflight|--apply');
  } catch (error) {
    console.error(sanitize(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  AUTHORIZED_RUNTIME_PUBLIC_SELECT_RELATIONS,
  CANONICAL_KNOWLEDGE_RUNTIME_GRANT_RELATIONS,
  LOCK_KEY,
  LOCK_NAMESPACE,
  MIGRATION,
  PREEXISTING_CANONICAL_KNOWLEDGE_RUNTIME_SELECT_RELATIONS,
  RUNTIME_PUBLIC_SELECT_CONTRACT_FILES,
  extractRuntimeSelectRelationsFromSql,
  readAuthorizedRuntimePublicSelectRelations,
  readMigration,
  validateSql,
};
