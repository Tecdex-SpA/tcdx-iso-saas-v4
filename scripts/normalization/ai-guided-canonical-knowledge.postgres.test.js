#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');
const {
  REQUIRED_PROBLEM_TYPES,
  LEGACY_AI_CORE_OBJECTS,
  assertPostconditions,
  readBusinessCounts,
  readMigration,
} = require('./apply-ai-guided-product-ready-knowledge-catalog');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const commercialRuntimePath = path.join(root, 'database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql');
const pythonTestDeps = '/private/tmp/tcdx-ai-engine-test-deps-reqonly';
const { Client } = require(path.join(root, 'backend/node_modules/pg'));

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`ai-guided-canonical:${label}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function databaseEnv(pg) {
  return pg.container
    ? { AI_CORE_DB_HOST: '127.0.0.1', AI_CORE_DB_PORT: String(pg.port) }
    : { AI_CORE_DB_HOST: pg.socketDir, AI_CORE_DB_PORT: String(pg.port) };
}

function pgClientConfig(pg) {
  return pg.container
    ? { host: '127.0.0.1', port: Number(pg.port), database: 'postgres', user: 'postgres' }
    : { host: pg.socketDir, port: Number(pg.port), database: 'postgres', user: 'postgres' };
}

function migrationDatabaseUrl(pg) {
  if (pg.container) {
    return `postgresql://postgres@127.0.0.1:${pg.port}/postgres`;
  }
  return `postgresql://postgres@localhost:${pg.port}/postgres?host=${encodeURIComponent(pg.socketDir)}`;
}

function runCatalogRunner(pg, mode) {
  const result = spawnSync('node', ['scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js', mode], {
    cwd: root,
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: migrationDatabaseUrl(pg),
    },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.doesNotMatch(result.stdout + result.stderr, /password=|postgres:\/\/[^/]|postgresql:\/\/[^/]/i, 'runner output must not leak credentials');
  return result;
}

async function captureBusinessCounts(pg) {
  const client = new Client(pgClientConfig(pg));
  await client.connect();
  try {
    return await readBusinessCounts(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function applyCatalogMigration(pg) {
  const checksum = runCatalogRunner(pg, '--checksum');
  assert.equal(checksum.status, 0, `checksum failed\nstdout=${checksum.stdout}\nstderr=${checksum.stderr}`);
  const checksumPayload = JSON.parse(checksum.stdout);
  assert.equal(checksumPayload.command, 'checksum');
  assert.ok(/^[a-f0-9]{64}$/.test(checksumPayload.checksum), 'checksum command must return sha256 hex');

  const beforePreflight = await captureBusinessCounts(pg);
  const preflight = runCatalogRunner(pg, '--preflight');
  assert.equal(preflight.status, 0, `preflight failed\nstdout=${preflight.stdout}\nstderr=${preflight.stderr}`);
  const preflightPayload = JSON.parse(preflight.stdout);
  assert.equal(preflightPayload.command, 'preflight');
  assert.equal(preflightPayload.migration_state, 'pending');
  const afterPreflight = await captureBusinessCounts(pg);
  assert.deepEqual(afterPreflight, beforePreflight, 'preflight must not modify catalog counts or schema_migrations ledger');

  const first = runCatalogRunner(pg, '--apply');
  assert.equal(first.status, 0, `first apply failed\nstdout=${first.stdout}\nstderr=${first.stderr}`);
  const firstPayload = JSON.parse(first.stdout);
  assert.equal(firstPayload.applied, true, 'first catalog migration run must apply');
  assert.equal(firstPayload.status, 'applied');

  const second = runCatalogRunner(pg, '--apply');
  assert.equal(second.status, 0, `second apply failed\nstdout=${second.stdout}\nstderr=${second.stderr}`);
  const secondPayload = JSON.parse(second.stdout);
  assert.equal(secondPayload.applied, false, 'second catalog migration run must be idempotent');
  assert.equal(secondPayload.status, 'already_applied');

  const client = new Client(pgClientConfig(pg));
  await client.connect();
  try {
    const migration = readMigration();
    await assertPostconditions(client);
    await client.query(
      'UPDATE public.schema_migrations SET checksum = $2 WHERE migration_id = $1',
      [migration.id, 'f'.repeat(64)],
    );
    const mismatch = runCatalogRunner(pg, '--preflight');
    assert.notEqual(mismatch.status, 0, 'checksum mismatch must fail closed');
    assert.match(mismatch.stderr + mismatch.stdout, /checksum mismatch/i);
    await client.query(
      'UPDATE public.schema_migrations SET checksum = $2 WHERE migration_id = $1',
      [migration.id, migration.checksum],
    );
  } finally {
    await client.end().catch(() => {});
  }
}

function insertTenantFixtures(pg) {
  const tenantA = uuid('tenant-a');
  const tenantB = uuid('tenant-b');
  const userA = uuid('user-a');
  const controlCatalogA = uuid('catalog-control-a');
  const controlCatalogB = uuid('catalog-control-b');
  const tenantControlA = uuid('tenant-control-a');
  const tenantControlB = uuid('tenant-control-b');

  psqlExec(pg, `
    INSERT INTO tenants (id, slug, name)
    VALUES
      ('${tenantA}', 'ai-guided-tenant-a', 'AI Guided Tenant A'),
      ('${tenantB}', 'ai-guided-tenant-b', 'AI Guided Tenant B');

    INSERT INTO users (id, tenant_id, email, name, role)
    VALUES ('${userA}', '${tenantA}', 'ai-guided-a@example.invalid', 'AI Guided A', 'admin');

    INSERT INTO standards (standard_code, display_name, family, version_label, is_active)
    VALUES ('ISO27001', 'ISO 27001', 'ISO', '2022', true)
    ON CONFLICT (standard_code) DO NOTHING;

    INSERT INTO tenant_standards (id, tenant_id, standard_code, is_active)
    VALUES
      ('${uuid('tenant-standard-a')}', '${tenantA}', 'ISO27001', true),
      ('${uuid('tenant-standard-b')}', '${tenantB}', 'ISO27001', true);

    INSERT INTO controls_catalog (id, tenant_id, code, clause, title, iso, is_active)
    VALUES
      ('${controlCatalogA}', NULL, 'AI-GUIDED-A.1', 'AI-GUIDED-A.1', 'Access Review Tenant A', 'ISO27001', true),
      ('${controlCatalogB}', NULL, 'AI-GUIDED-B.1', 'AI-GUIDED-B.1', 'Tenant B Control Sentinel', 'ISO27001', true);

    INSERT INTO tenant_controls (id, tenant_id, control_id, tenant_standard_id, implementation_status, status)
    VALUES
      ('${tenantControlA}', '${tenantA}', '${controlCatalogA}', '${uuid('tenant-standard-a')}', 'partial', 'active'),
      ('${tenantControlB}', '${tenantB}', '${controlCatalogB}', '${uuid('tenant-standard-b')}', 'not_implemented', 'active');

    INSERT INTO findings (id, tenant_id, tenant_control_id, catalog_control_id, title, severity, status, iso_code)
    VALUES
      ('${uuid('finding-a-open')}', '${tenantA}', '${tenantControlA}', '${controlCatalogA}', 'Falta evidencia de revisión de accesos', 'alta', 'open', 'ISO27001'),
      ('${uuid('finding-a-closed')}', '${tenantA}', '${tenantControlA}', '${controlCatalogA}', 'Hallazgo histórico cerrado', 'alta', 'closed', 'ISO27001'),
      ('${uuid('finding-b')}', '${tenantB}', '${tenantControlB}', '${controlCatalogB}', 'Tenant B secret finding sentinel', 'alta', 'open', 'ISO27001');

    INSERT INTO metric_snapshots (id, tenant_id, metric_code, numeric_value, publication_state, coverage, effective_at, snapshot_status)
    VALUES
      ('${uuid('metric-a')}', '${tenantA}', 'F5_5_GRC_HEALTH', 81, 'published', 0.91, '2026-09-14T10:00:00Z', 'published'),
      ('${uuid('metric-b')}', '${tenantB}', 'F5_5_GRC_HEALTH', 22, 'published', 0.33, '2026-09-14T10:00:00Z', 'published');

    INSERT INTO tenant_applicable_evidence_requirements (tenant_id, related_control_id, evidence_type, evidence_name, requirement_reason, priority, active, visible_to_tenant, source)
    VALUES ('${tenantA}', '${tenantControlA}', 'record', 'Revisión tenant-scoped', 'profile_engine', 'alta', true, true, 'profile_engine');
  `);

  return { tenantA, tenantB };
}

function runPythonGuided(pg, tenantA, tenantB, options = {}) {
  const problemType = options.problemType || 'access_review_missing';
  const domainCode = options.domainCode || 'access_management';
  const userText = options.userText || 'Falta evidencia de revisión de accesos privilegiados';
  const script = `
import json
import sys
sys.path.insert(0, ${sqlLiteral(path.join(root, 'ai-engine'))})
from app.services.solution_engine import generate_guided_solution
result = generate_guided_solution(
    user_text=${sqlLiteral(userText)},
    tenant_id=${sqlLiteral(tenantA)},
    standard_code='ISO27001',
    forced_problem_type=${sqlLiteral(problemType)},
    forced_domain_code=${sqlLiteral(domainCode)},
)
text = json.dumps(result, ensure_ascii=False, default=str)
print(text)
if ${sqlLiteral(tenantB)} in text or 'Tenant B secret finding sentinel' in text or 'Tenant B Control Sentinel' in text:
    raise SystemExit('cross tenant leakage detected')
if result.get('solution', {}).get('can_auto_close') is not False:
    raise SystemExit('guided AI must not auto-close')
`;
  const result = spawnSync('python3', ['-c', script], {
    cwd: root,
    env: {
      ...process.env,
      ...databaseEnv(pg),
      AI_CORE_DB_NAME: 'postgres',
      AI_CORE_DB_USER: 'postgres',
      AI_CORE_DB_PASSWORD: '',
      PYTHONPATH: pythonTestDeps,
      PYTHONPYCACHEPREFIX: '/private/tmp/tcdx-ai-pycache',
    },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Python guided run failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  assert.doesNotMatch(result.stdout + result.stderr, /password=|postgres:\/\/|postgresql:\/\//i, 'output must not leak connection strings');
  return JSON.parse(result.stdout);
}

function assertCatalogCoverage(pg) {
  const result = psqlExec(pg, `
    WITH required(problem_type_code) AS (
      SELECT unnest(ARRAY[${REQUIRED_PROBLEM_TYPES.map(sqlLiteral).join(',')}]::text[])
    )
    SELECT count(*) FILTER (WHERE i.item_key IS NOT NULL)::int || '|' ||
           count(*) FILTER (
             WHERE i.item_key IS NOT NULL
               AND EXISTS (SELECT 1 FROM knowledge_mappings m WHERE m.item_key = i.item_key)
               AND EXISTS (SELECT 1 FROM knowledge_recommended_actions a WHERE a.item_key = i.item_key)
               AND EXISTS (SELECT 1 FROM knowledge_evidence_expectations e WHERE e.item_key = i.item_key)
               AND EXISTS (SELECT 1 FROM knowledge_audit_questions q WHERE q.item_key = i.item_key)
               AND EXISTS (SELECT 1 FROM knowledge_rules r WHERE r.item_key = i.item_key)
           )::int
    FROM required r
    LEFT JOIN knowledge_items i
      ON i.item_key = r.problem_type_code
     AND i.source_key = 'tecdx_ai_guided_problem_catalog_v1'
     AND i.item_type = 'ai_guided_problem_catalog';
  `).stdout.trim();
  assert.equal(result, `${REQUIRED_PROBLEM_TYPES.length}|${REQUIRED_PROBLEM_TYPES.length}`);

  const accessMapping = psqlExec(pg, `
    SELECT standard_code || '|' || domain
    FROM knowledge_mappings
    WHERE item_key = 'access_review_missing'
      AND mapping_key = 'ai_guided_catalog_map:access_review_missing'
  `).stdout.trim();
  assert.equal(accessMapping, 'ISO27001|access_management');
}

function assertNoLegacyObjects(pg) {
  const values = LEGACY_AI_CORE_OBJECTS.map((name) => `('ai_core.${name}')`).join(',');
  const result = psqlExec(pg, `
    WITH legacy(name) AS (VALUES ${values})
    SELECT COUNT(*)::int
    FROM legacy
    WHERE to_regclass(name) IS NOT NULL;
  `).stdout.trim();
  assert.equal(result, '0', 'isolated canonical DB must not create legacy AI Core objects');
}

async function main() {
  assert.ok(fs.existsSync(schemaPath), 'production_schema_v1.sql missing');
  assert.ok(fs.existsSync(seedPath), 'production_seed_v1.sql missing');
  assert.ok(fs.existsSync(commercialRuntimePath), 'commercial runtime migration missing');

  const pg = createPostgres();
  try {
    psqlExec(pg, fs.readFileSync(schemaPath, 'utf8'), { timeout: 120000 });
    psqlExec(pg, fs.readFileSync(seedPath, 'utf8'), { timeout: 120000 });
    psqlExec(pg, fs.readFileSync(commercialRuntimePath, 'utf8'), { timeout: 120000 });
    assertNoLegacyObjects(pg);
    await applyCatalogMigration(pg);
    assertCatalogCoverage(pg);
    const { tenantA, tenantB } = insertTenantFixtures(pg);

    const accessResult = runPythonGuided(pg, tenantA, tenantB);
    assert.equal(accessResult.ok, true);
    assert.equal(accessResult.knowledge_sources.base_problem_knowledge, true);
    assert.equal(accessResult.knowledge_sources.domain_knowledge, true);
    assert.ok(accessResult.solution.concrete_actions.length > 0, 'access_review_missing must produce recommended actions');
    assert.ok(accessResult.solution.expected_deliverables.length > 0, 'access_review_missing must produce evidence expectations');
    assert.equal(accessResult.solution.can_auto_close, false);
    assert.equal(accessResult.knowledge_sources.trace_counts.canonical_knowledge_item_count, 1);
    assert.equal(accessResult.knowledge_sources.trace_counts.canonical_knowledge_match_count, 1);
    assert.equal(accessResult.knowledge_sources.trace_counts.canonical_mapping_match_count, 1);
    assert.ok((accessResult.raw_context.open_findings || []).every((row) => row.active_gap_signal === true));
    assert.ok((accessResult.raw_context.closed_findings || []).some((row) => row.active_gap_signal === false));

    const missingEvidenceResult = runPythonGuided(pg, tenantA, tenantB, {
      problemType: 'missing_evidence',
      domainCode: 'evidence_management',
      userText: 'No existe evidencia objetiva del control evaluado',
    });
    assert.equal(missingEvidenceResult.ok, true);
    assert.equal(missingEvidenceResult.knowledge_sources.base_problem_knowledge, true);
    assert.equal(missingEvidenceResult.knowledge_sources.domain_knowledge, true);
    assert.ok(missingEvidenceResult.solution.concrete_actions.length > 0, 'missing_evidence must produce recommended actions');
    assert.ok(missingEvidenceResult.solution.expected_deliverables.length > 0, 'missing_evidence must produce evidence expectations');
    assert.equal(missingEvidenceResult.solution.can_auto_close, false);

    const unknownResult = runPythonGuided(pg, tenantA, tenantB, {
      problemType: 'unknown_problem_without_exact_knowledge',
      domainCode: 'evidence_management',
      userText: 'Necesito revisar una brecha no catalogada',
    });
    assert.equal(unknownResult.ok, true);
    assert.equal(unknownResult.knowledge_sources.base_problem_knowledge, false);
    assert.equal(unknownResult.solution.can_auto_close, false);
    assert.equal(unknownResult.domain.standard_applicability.state, 'unknown');

    console.log('AI_GUIDED_PRODUCT_READY_PREFLIGHT_READ_ONLY=PASS');
    console.log('RUNNER_APPLY_IDEMPOTENT=PASS');
    console.log('RUNNER_CHECKSUM_FAIL_CLOSED=PASS');
    console.log('AI_GUIDED_CANONICAL_TRACE_COUNTS=PASS');
    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_POSTGRES PASS');
    console.log('AI_GUIDED_RUNTIME_PROBLEM_CATALOG_COVERAGE PASS');
    console.log('MULTITENANT_ISOLATION PASS tenant_b_not_serialized=1');
    console.log('EMPTY_KNOWLEDGE_DEGRADATION PASS');
    console.log('LEGACY_AI_CORE_OBJECTS_PRESENT=0');
  } finally {
    stopPostgres(pg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
