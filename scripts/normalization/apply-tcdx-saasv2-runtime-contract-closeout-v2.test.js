#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const v1MigrationPath = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_schema_privilege_closeout.sql');
const v2MigrationPath = path.join(root, 'database/migrations/20260909_tcdx_saasv2_runtime_contract_closeout_v2.sql');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

function readSql(file) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

const schemaSql = readSql(schemaPath);
const seedSql = readSql(seedPath);
const v1MigrationSql = readSql(v1MigrationPath);
const v2MigrationSql = readSql(v2MigrationPath);

for (const [name, sql] of [
  ['schema', schemaSql],
  ['seed', seedSql],
  ['v1', v1MigrationSql],
  ['v2', v2MigrationSql],
]) {
  assert.doesNotMatch(sql, /\btcdx_saasv2\b/i, `${name} must not reference the real DB`);
  assert.doesNotMatch(sql, /\btecdex_saas\b/i, `${name} must not reference legacy production DB`);
}

assert.match(v2MigrationSql, /BEGIN;/, 'V2 migration must be transactional');
assert.match(v2MigrationSql, /COMMIT;/, 'V2 migration must close transaction');
assert.match(v2MigrationSql, /pg_try_advisory_xact_lock\(844332,\s*2026090902\)/, 'V2 migration must use its own advisory lock');
assert.doesNotMatch(v2MigrationSql, /GRANT\s+[^;]*\bON ALL TABLES IN SCHEMA\b/i, 'V2 must not grant all tables');
assert.doesNotMatch(v2MigrationSql, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\b/i, 'V2 must not grant all functions');

function quoteList(values) {
  return values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(',');
}

function assertScalar(pg, name, sql, expected) {
  const actual = psqlExec(pg, sql).stdout.trim();
  assert.equal(actual, String(expected), `${name}: expected ${expected}, got ${actual || '<empty>'}`);
  console.log(`${name} PASS`);
}

function assertSql(pg, name, sql) {
  psqlExec(pg, sql);
  console.log(`${name} PASS`);
}

function assertSqlFails(pg, name, sql, pattern = /violates foreign key constraint|permission denied|diverges/i) {
  const result = psqlExec(pg, sql, { allowFailure: true });
  assert.notEqual(result.status, 0, `${name}: SQL unexpectedly succeeded`);
  assert.match(result.stderr, pattern, `${name}: unexpected failure: ${result.stderr}`);
  console.log(`${name} PASS`);
}

function assertRelations(pg, name, relationNames) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM unnest(ARRAY[${quoteList(relationNames)}]) AS required(name)
    WHERE to_regclass('public.' || required.name) IS NOT NULL;
    `,
    relationNames.length
  );
}

function assertColumns(pg, name, tableName, columns) {
  assertScalar(
    pg,
    name,
    `
    SELECT count(*)::int
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${tableName}'
      AND column_name = ANY(ARRAY[${quoteList(columns)}]);
    `,
    columns.length
  );
}

function assertBackendPrivilege(pg, name, relationName, privileges) {
  for (const privilege of privileges) {
    assertScalar(
      pg,
      `${name}_${privilege}`,
      `SELECT has_table_privilege('tcdx_backend_runtime', '${relationName}', '${privilege}')::text;`,
      'true'
    );
  }
}

const pg = createPostgres();
try {
  psqlExec(pg, schemaSql);
  psqlExec(pg, seedSql);
  console.log('BASELINE_AND_SEED_FRESH PASS');

  assertRelations(pg, 'BASELINE_FRESH_OBJECTS', [
    'tenant_standards',
    'tenant_nonconformities',
    'evidences',
    'evidence_document_extracts',
    'vw_evidence_current_extracts',
    'evidence_ai_assessments',
    'vw_evidence_current_ai_assessments',
    'evidence_ai_jobs',
    'evidence_knowledge_chunks',
    'standard_lifecycle_stage_catalog',
    'standard_lifecycle_status',
    'standard_lifecycle_snapshots',
    'standard_lifecycle_stage_requests',
    'standard_lifecycle_ai_feed',
  ]);

  psqlExec(pg, v1MigrationSql);
  console.log('V1_ON_FRESH_BASELINE PASS');
  psqlExec(pg, v2MigrationSql);
  console.log('V2_APPLY_1 PASS');
  psqlExec(pg, v2MigrationSql);
  console.log('V2_APPLY_2_IDEMPOTENT PASS');

  assertColumns(pg, 'TENANT_STANDARDS_V2_COLUMNS', 'tenant_standards', [
    'catalog_mode',
    'initialized_at',
    'contracted_at',
    'deactivated_at',
    'paused_at',
    'permanently_deactivated_at',
    'updated_at',
    'metadata',
  ]);

  assertColumns(pg, 'TENANT_NONCONFORMITIES_V2_COLUMNS', 'tenant_nonconformities', [
    'control_id',
    'control_description',
    'tenant_control_id',
    'title',
    'description',
    'severity',
    'status',
    'detected_at',
    'resolved_at',
    'updated_at',
  ]);

  assertColumns(pg, 'EVIDENCES_V2_COLUMNS', 'evidences', [
    'control_id',
    'tenant_control_id',
    'catalog_control_id',
    'title',
    'description',
    'file_name',
    'file_path',
    'file_mime_type',
    'file_size_bytes',
    'reviewed_by',
    'reviewed_at',
    'rejection_reason',
    'content_fingerprint',
    'document_extraction_status',
    'last_extracted_at',
    'ai_last_error',
    'ai_model_name',
    'ai_model_version',
  ]);

  assertColumns(pg, 'CURRENT_EXTRACT_VIEW_COLUMNS', 'vw_evidence_current_extracts', [
    'id',
    'evidence_id',
    'extraction_status',
    'file_type',
    'mime_type',
    'raw_text',
    'structured_json',
    'text_char_count',
    'ocr_used',
    'detected_language',
    'page_count',
    'sheet_count',
    'image_count',
  ]);

  assertColumns(pg, 'CURRENT_AI_ASSESSMENT_VIEW_COLUMNS', 'vw_evidence_current_ai_assessments', [
    'id',
    'evidence_id',
    'extract_id',
    'analysis_status',
    'validity_result',
    'contribution_level',
    'pertinence_score',
    'sufficiency_score',
    'freshness_score',
    'traceability_score',
    'consistency_score',
    'compliance_impact_score',
    'recommended_standard_code',
    'recommended_clause',
    'recommended_control_id',
    'recommended_operation_id',
    'headline',
    'narrative',
    'risks_json',
    'next_steps_json',
    'extracted_entities_json',
    'control_fit',
    'gap_summary',
    'duplicate_of_evidence_id',
    'appears_expired',
    'appears_complete',
    'appears_authentic',
    'model_name',
    'model_version',
    'source_system',
    'raw_response_json',
    'ai_trace_id',
    'ai_source_level',
    'ai_source_label',
    'ai_confidence',
    'ai_confidence_score',
    'ai_orchestration_json',
    'ai_enhanced_answer_json',
    'analyzed_at',
  ]);

  assertScalar(
    pg,
    'ENQUEUE_EVIDENCE_AI_JOB_SIGNATURE',
    `
    SELECT (to_regprocedure('public.enqueue_evidence_ai_job(uuid,uuid,text,jsonb,smallint,timestamp without time zone,uuid)') IS NOT NULL)::text;
    `,
    'true'
  );

  assertScalar(
    pg,
    'TENANT_AWARE_FKS',
    `
    SELECT count(*)::int
    FROM pg_constraint
    WHERE conname = ANY(ARRAY[
      'fk_evidence_document_extracts_evidence_same_tenant',
      'fk_evidence_ai_assessments_evidence_same_tenant',
      'fk_evidence_ai_jobs_evidence_same_tenant',
      'fk_evidence_knowledge_chunks_evidence_same_tenant',
      'fk_standard_lifecycle_status_operation_same_tenant',
      'fk_standard_lifecycle_snapshots_operation_same_tenant',
      'fk_standard_lifecycle_requests_operation_same_tenant',
      'fk_standard_lifecycle_ai_feed_operation_same_tenant'
    ]);
    `,
    8
  );

  for (const table of [
    'evidence_document_extracts',
    'evidence_ai_assessments',
    'evidence_ai_jobs',
    'evidence_knowledge_chunks',
    'standard_lifecycle_status',
    'standard_lifecycle_snapshots',
    'standard_lifecycle_stage_requests',
    'standard_lifecycle_ai_feed',
  ]) {
    assertBackendPrivilege(pg, `RUNTIME_GRANTS_${table}`, table, ['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
  }

  for (const view of [
    'vw_evidence_current_extracts',
    'vw_evidence_current_ai_assessments',
    'standard_lifecycle_stage_catalog',
  ]) {
    assertBackendPrivilege(pg, `RUNTIME_GRANTS_${view}`, view, ['SELECT']);
  }

  assertScalar(
    pg,
    'RUNTIME_ENQUEUE_EXECUTE_GRANT',
    `
    SELECT has_function_privilege(
      'tcdx_backend_runtime',
      'public.enqueue_evidence_ai_job(uuid,uuid,text,jsonb,smallint,timestamp without time zone,uuid)',
      'EXECUTE'
    )::text;
    `,
    'true'
  );

  assertScalar(
    pg,
    'RUNTIME_NO_EXCESSIVE_PRIVILEGES',
    `
    SELECT (
      NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'tcdx_backend_runtime'
          AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
      )
      AND has_schema_privilege('tcdx_backend_runtime', 'public', 'CREATE') IS FALSE
      AND has_function_privilege('tcdx_backend_runtime', 'public.reconcile_evidence_contract()', 'EXECUTE') IS FALSE
    )::text;
    `,
    'true'
  );

  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';
  const userA = 'aaaaaaaa-1111-4111-8111-111111111111';
  const operationA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const operationB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const catalogControl = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const tenantControlA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const evidenceA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const extractA = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const assessmentA = '99999999-9999-4999-8999-999999999999';

  assertSql(
    pg,
    'V2_RUNTIME_FIXTURE',
    `
    INSERT INTO tenants(id, slug, name) VALUES
      ('${tenantA}', 'runtime-v2-a', 'Runtime V2 A'),
      ('${tenantB}', 'runtime-v2-b', 'Runtime V2 B');
    INSERT INTO users(id, tenant_id, email, role) VALUES
      ('${userA}', '${tenantA}', 'runtime-v2@example.test', 'tenant_admin');
    INSERT INTO controls_catalog(id, code, title, description, iso)
    VALUES ('${catalogControl}', 'A.1', 'Control A1', 'Control description', 'ISO_27001_2022');
    INSERT INTO tenant_standards(tenant_id, standard_code, catalog_mode)
    VALUES ('${tenantA}', 'ISO_27001_2022', 'mixed');
    INSERT INTO tenant_operations(id, tenant_id, operation_key, name) VALUES
      ('${operationA}', '${tenantA}', 'op-a', 'Operation A'),
      ('${operationB}', '${tenantB}', 'op-b', 'Operation B');
    INSERT INTO tenant_controls(id, tenant_id, control_id, operation_id)
    VALUES ('${tenantControlA}', '${tenantA}', '${catalogControl}', '${operationA}');
    `
  );

  assertSql(
    pg,
    'NONCONFORMITY_TITLELESS_INSERT_RECONCILES',
    `
    INSERT INTO tenant_nonconformities (tenant_id, control_id, control_description, status, detected_at)
    VALUES ('${tenantA}', '${catalogControl}', 'NC control description', 'abierta', NOW());
    `
  );
  assertScalar(
    pg,
    'NONCONFORMITY_RECONCILED_VALUES',
    `
    SELECT (
      count(*) = 1
      AND bool_and(tenant_control_id = '${tenantControlA}'::uuid)
      AND bool_and(title = 'NC control description')
      AND bool_and(description = 'NC control description')
    )::text
    FROM tenant_nonconformities
    WHERE tenant_id = '${tenantA}';
    `,
    'true'
  );

  assertSql(
    pg,
    'EVIDENCE_TITLELESS_INSERT_RECONCILES',
    `
    INSERT INTO evidences (
      id, tenant_id, control_id, description, file_name, file_path, file_mime_type, file_size_bytes
    )
    VALUES (
      '${evidenceA}', '${tenantA}', '${catalogControl}', 'Evidence description', 'evidence.pdf', 'evidence.pdf', 'application/pdf', 123
    );
    `
  );
  assertScalar(
    pg,
    'EVIDENCE_RECONCILED_VALUES',
    `
    SELECT (
      tenant_control_id = '${tenantControlA}'::uuid
      AND control_id = '${catalogControl}'::uuid
      AND catalog_control_id = '${catalogControl}'::uuid
      AND title = 'Evidence description'
    )::text
    FROM evidences
    WHERE id = '${evidenceA}';
    `,
    'true'
  );

  assertSql(
    pg,
    'EVIDENCE_AI_RUNTIME_INSERTS',
    `
    SELECT enqueue_evidence_ai_job(
      '${tenantA}', '${evidenceA}', 'extract_document', '{"source":"test"}'::jsonb, 95::smallint, NOW()::timestamp, '${userA}'
    );
    INSERT INTO evidence_document_extracts (
      id, tenant_id, evidence_id, is_current, extraction_status, file_type, mime_type, raw_text, structured_json, text_char_count
    )
    VALUES (
      '${extractA}', '${tenantA}', '${evidenceA}', true, 'completed', 'pdf', 'application/pdf', 'raw evidence text', '{}'::jsonb, 17
    );
    INSERT INTO evidence_ai_assessments (
      id, tenant_id, evidence_id, extract_id, is_current, analysis_status, validity_result,
      contribution_level, headline, risks_json, next_steps_json, extracted_entities_json, analyzed_at
    )
    VALUES (
      '${assessmentA}', '${tenantA}', '${evidenceA}', '${extractA}', true, 'completed', 'valida',
      'alta', 'Evidence OK', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NOW()
    );
    INSERT INTO evidence_knowledge_chunks (
      tenant_id, evidence_id, assessment_id, extract_id, chunk_index, content, content_hash
    )
    VALUES (
      '${tenantA}', '${evidenceA}', '${assessmentA}', '${extractA}', 0, 'raw evidence text', md5('raw evidence text')
    );
    `
  );

  assertScalar(pg, 'CURRENT_EXTRACT_VIEW_ROWS', `SELECT count(*)::int FROM vw_evidence_current_extracts WHERE evidence_id = '${evidenceA}';`, 1);
  assertScalar(pg, 'CURRENT_AI_ASSESSMENT_VIEW_ROWS', `SELECT count(*)::int FROM vw_evidence_current_ai_assessments WHERE evidence_id = '${evidenceA}';`, 1);
  assertScalar(pg, 'EVIDENCE_AI_JOB_CREATED', `SELECT count(*)::int FROM evidence_ai_jobs WHERE evidence_id = '${evidenceA}' AND status = 'pending';`, 1);

  assertSql(
    pg,
    'LIFECYCLE_RUNTIME_INSERTS',
    `
    INSERT INTO standard_lifecycle_status (
      tenant_id, standard_code, operation_id, calculated_stage_code, confirmed_stage_code, effective_stage_code,
      health_status, maturity_score, metrics_json
    )
    VALUES (
      '${tenantA}', 'ISO_27001_2022', '${operationA}', 'diagnostico', 'diagnostico', 'diagnostico',
      'sin_datos', NULL, '{}'::jsonb
    );
    INSERT INTO standard_lifecycle_snapshots (
      tenant_id, standard_code, operation_id, calculated_stage_code, confirmed_stage_code, effective_stage_code,
      health_status, metrics_json
    )
    VALUES (
      '${tenantA}', 'ISO_27001_2022', '${operationA}', 'diagnostico', 'diagnostico', 'diagnostico',
      'sin_datos', '{}'::jsonb
    );
    INSERT INTO standard_lifecycle_stage_requests (
      tenant_id, standard_code, operation_id, from_stage_code, to_stage_code, request_status, requested_by
    )
    VALUES (
      '${tenantA}', 'ISO_27001_2022', '${operationA}', 'diagnostico', 'implementacion', 'por_confirmar', '${userA}'
    );
    INSERT INTO standard_lifecycle_ai_feed (
      tenant_id, standard_code, operation_id, event_type, content_text, payload
    )
    VALUES (
      '${tenantA}', 'ISO_27001_2022', '${operationA}', 'evidence_ai_processed', 'AI lifecycle feed', '{}'::jsonb
    );
    `
  );

  assertSqlFails(
    pg,
    'LIFECYCLE_CROSS_TENANT_OPERATION_FK_BLOCK',
    `
    INSERT INTO standard_lifecycle_status (tenant_id, standard_code, operation_id, effective_stage_code)
    VALUES ('${tenantA}', 'ISO_27001_2022', '${operationB}', 'diagnostico');
    `,
    /fk_standard_lifecycle_status_operation_same_tenant|violates foreign key constraint/i
  );

  assertSqlFails(
    pg,
    'EVIDENCE_CONTROL_DIVERGENCE_BLOCK',
    `
    INSERT INTO evidences (
      tenant_id, tenant_control_id, control_id, catalog_control_id, title
    )
    VALUES (
      '${tenantA}', '${tenantControlA}', gen_random_uuid(), '${catalogControl}', 'Divergent evidence'
    );
    `,
    /diverges|violates foreign key constraint/i
  );

  assertSql(pg, 'TENANT_FIXTURE_CLEANUP', "DELETE FROM tenants WHERE slug LIKE 'runtime-v2-%';");
  assertScalar(pg, 'FINAL_TENANTS_ZERO', 'SELECT count(*)::int FROM tenants;', 0);

  console.log('TCDX_SAASV2_RUNTIME_CONTRACT_CLOSEOUT_V2_TEST PASS');
} finally {
  stopPostgres(pg);
}
