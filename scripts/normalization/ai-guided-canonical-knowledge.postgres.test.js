#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const commercialRuntimePath = path.join(root, 'database/migrations/20260910_tcdx_commercial_runtime_integral_closeout.sql');
const pythonTestDeps = '/private/tmp/tcdx-ai-engine-test-deps-reqonly';

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

function insertFixtures(pg) {
  const tenantA = uuid('tenant-a');
  const tenantB = uuid('tenant-b');
  const userA = uuid('user-a');
  const controlCatalogA = uuid('catalog-control-a');
  const controlCatalogB = uuid('catalog-control-b');
  const tenantControlA = uuid('tenant-control-a');
  const tenantControlB = uuid('tenant-control-b');
  const sourceId = uuid('knowledge-source');
  const itemId = uuid('knowledge-item');

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
      ('${uuid('finding-a')}', '${tenantA}', '${tenantControlA}', '${controlCatalogA}', 'Falta evidencia de revisión de accesos', 'alta', 'open', 'ISO27001'),
      ('${uuid('finding-b')}', '${tenantB}', '${tenantControlB}', '${controlCatalogB}', 'Tenant B secret finding sentinel', 'alta', 'open', 'ISO27001');

    INSERT INTO metric_snapshots (id, tenant_id, metric_code, numeric_value, publication_state, coverage, effective_at, snapshot_status)
    VALUES
      ('${uuid('metric-a')}', '${tenantA}', 'F5_5_GRC_HEALTH', 81, 'published', 0.91, '2026-09-14T10:00:00Z', 'published'),
      ('${uuid('metric-b')}', '${tenantB}', 'F5_5_GRC_HEALTH', 22, 'published', 0.33, '2026-09-14T10:00:00Z', 'published');

    INSERT INTO knowledge_sources (id, source_key, source_name, source_type, license_class, use_in_system, active)
    VALUES ('${sourceId}', 'ai-guided-canonical-source', 'AI Guided Canonical Source', 'derived_summary', 'derived_summary', ARRAY['ai'], true);

    INSERT INTO knowledge_items (
      id, source_id, item_key, source_key, source_record_id, standard_family, standard_code,
      clause_or_control, title, domain, item_type, intent_summary, license_class,
      use_in_system, search_text, implementation_guidance, tags, severity_default, lifecycle_state, is_active
    )
    VALUES (
      '${itemId}', '${sourceId}', 'access_review_missing', 'ai-guided-canonical-source',
      'access_review_missing', 'ISO', 'ISO27001', 'AI-GUIDED-A.1', 'Revision de accesos',
      'access_management', 'control_guidance', 'Revisar accesos privilegiados con trazabilidad.',
      'derived_summary', ARRAY['ai'], 'revision accesos evidencia privilegios',
      'Validar periodo, responsable y aprobacion.', ARRAY['access_review_missing'], 'alta', 'active', true
    );

    INSERT INTO knowledge_mappings (item_id, item_key, mapping_key, target_type, target_key, standard_code, clause_or_control, domain, match_weight, confidence)
    VALUES ('${itemId}', 'access_review_missing', 'access-review-problem', 'problem_type', 'access_review_missing', 'ISO27001', 'AI-GUIDED-A.1', 'access_management', 1.00, 0.9500);

    INSERT INTO knowledge_common_gaps (item_id, item_key, gap_key, description, gap_text, severity_default)
    VALUES ('${itemId}', 'access_review_missing', 'access-review-gap', 'Falta revisión de accesos', 'No hay evidencia trazable de revisión de accesos.', 'alta');

    INSERT INTO knowledge_recommended_actions (item_id, item_key, action_key, description, action_text, action_basis, priority_default)
    VALUES ('${itemId}', 'access_review_missing', 'review-accesses', 'Completar revisión de accesos', 'Revisar accesos privilegiados y documentar aprobación.', 'canonical_knowledge', 'alta');

    INSERT INTO knowledge_evidence_expectations (item_id, item_key, expectation_key, description, expectation_text, evidence_type, required_level)
    VALUES ('${itemId}', 'access_review_missing', 'access-review-evidence', 'Registro de revisión', 'Acta o registro con fecha, responsable, alcance y aprobación.', 'record', 'required');

    INSERT INTO knowledge_audit_questions (item_id, item_key, question_key, question_text)
    VALUES ('${itemId}', 'access_review_missing', 'access-review-question', '¿La revisión cubre accesos privilegiados del periodo?');

    INSERT INTO tenant_applicable_evidence_requirements (tenant_id, related_control_id, evidence_type, evidence_name, requirement_reason, priority, active, visible_to_tenant, source)
    VALUES ('${tenantA}', '${tenantControlA}', 'record', 'Revisión tenant-scoped', 'profile_engine', 'alta', true, true, 'profile_engine');
  `);

  return { tenantA, tenantB };
}

function runPythonGuided(pg, tenantA, tenantB, problemType = 'access_review_missing') {
  const script = `
import json
import sys
sys.path.insert(0, ${sqlLiteral(path.join(root, 'ai-engine'))})
from app.services.solution_engine import generate_guided_solution
result = generate_guided_solution(
    user_text='Falta evidencia de revisión de accesos privilegiados',
    tenant_id=${sqlLiteral(tenantA)},
    standard_code='ISO27001',
    forced_problem_type=${sqlLiteral(problemType)},
    forced_domain_code='access_management',
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

function assertNoLegacyObjects(pg) {
  const legacy = [
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
  ];
  const values = legacy.map((name) => `('ai_core.${name}')`).join(',');
  const result = psqlExec(pg, `
    WITH legacy(name) AS (VALUES ${values})
    SELECT COUNT(*)::int
    FROM legacy
    WHERE to_regclass(name) IS NOT NULL;
  `).stdout.trim();
  assert.equal(result, '0', 'isolated canonical DB must not create legacy AI Core objects');
}

function main() {
  assert.ok(fs.existsSync(schemaPath), 'production_schema_v1.sql missing');
  assert.ok(fs.existsSync(seedPath), 'production_seed_v1.sql missing');
  assert.ok(fs.existsSync(commercialRuntimePath), 'commercial runtime migration missing');

  const pg = createPostgres();
  try {
    psqlExec(pg, fs.readFileSync(schemaPath, 'utf8'), { timeout: 120000 });
    psqlExec(pg, fs.readFileSync(seedPath, 'utf8'), { timeout: 120000 });
    psqlExec(pg, fs.readFileSync(commercialRuntimePath, 'utf8'), { timeout: 120000 });
    assertNoLegacyObjects(pg);
    const { tenantA, tenantB } = insertFixtures(pg);
    const result = runPythonGuided(pg, tenantA, tenantB);
    assert.equal(result.ok, true);
    assert.equal(result.knowledge_sources.base_problem_knowledge, true);
    assert.equal(result.knowledge_sources.domain_knowledge, true);
    assert.match(JSON.stringify(result), /Revisar accesos privilegiados/);

    const emptyResult = runPythonGuided(pg, tenantA, tenantB, 'unknown_problem_without_exact_knowledge');
    assert.equal(emptyResult.ok, true);
    assert.equal(emptyResult.solution.can_auto_close, false);

    console.log('AI_GUIDED_CANONICAL_KNOWLEDGE_POSTGRES PASS');
    console.log('MULTITENANT_ISOLATION PASS tenant_b_not_serialized=1');
    console.log('EMPTY_KNOWLEDGE_DEGRADATION PASS');
    console.log('LEGACY_AI_CORE_OBJECTS_PRESENT=0');
  } finally {
    stopPostgres(pg);
  }
}

main();
