#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const { Pool } = require(path.join(root, 'backend/node_modules/pg'));
const { createTenantAwarePool, withPlatformTransaction, withTenantTransaction } = require(path.join(root, 'backend/src/utils/dbTenantContext'));
const { loadProductionReferenceCatalogs } = require('./load-production-reference-catalogs');

const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

function uuid(label) {
  const hex = crypto.createHash('sha256').update(`db-n05:${label}`).digest('hex');
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

function pgVersion(pg) {
  return psqlExec(pg, "SHOW server_version;\n").stdout.trim();
}

async function requestJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method: 'GET', timeout: 4000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(new Error(`Invalid JSON from ${pathname}: ${error.message}; body=${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`HTTP timeout for ${pathname}`));
    });
    req.end();
  });
}

async function waitForReady(port, child) {
  const deadline = Date.now() + 15000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`backend exited before readiness check: ${child.exitCode}`);
    }
    try {
      const result = await requestJson(port, '/ready');
      if (result.status === 200 && result.body?.ok === true) return result;
      lastError = new Error(`unexpected /ready status ${result.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error('backend readiness timeout');
}

async function assertBackendStartup(pg) {
  psqlExec(pg, `CREATE ROLE dbn05_backend_probe LOGIN IN ROLE tcdx_backend_runtime; ALTER ROLE dbn05_backend_probe SET role TO tcdx_backend_runtime;`);
  const port = 41000 + crypto.randomInt(1000);
  const child = spawn(process.execPath, ['src/app.js'], {
    cwd: path.join(root, 'backend'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_HOST: pg.socketDir,
      DB_PORT: pg.port,
      DB_USER: 'dbn05_backend_probe',
      DB_PASSWORD: '',
      DB_NAME: 'postgres',
      DB_POOL_MAX: '2',
      DB_CONNECTION_TIMEOUT_MS: '1000',
      READINESS_DEPENDENCY_TIMEOUT_MS: '800',
      JWT_SECRET: 'db-n05-local-only',
      START_GRC_SCHEDULER: 'false',
      START_PHASE2_SCHEDULER: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    const ready = await waitForReady(port, child);
    assert.equal(ready.body.dependencies.database.ok, true, 'backend database readiness should pass');
    assert.equal(ready.body.dependencies.jobs.ok, true, 'backend jobs readiness should pass');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (child.exitCode === null) child.kill('SIGKILL');
  }

  assert.match(stdout, /Server running on port/, `backend startup log missing\nstdout=${stdout}\nstderr=${stderr}`);
  console.log('BACKEND_STARTUP PASS');
}

async function main() {
  assert.ok(fs.existsSync(schemaPath), 'production_schema_v1.sql missing');
  assert.ok(fs.existsSync(seedPath), 'production_seed_v1.sql missing');

  const pg = createPostgres();
  const tenantA = uuid('tenant-a');
  const tenantB = uuid('tenant-b');
  const operationA = uuid('operation-a');
  const operationB = uuid('operation-b');
	  const tenantStandardA = uuid('tenant-standard-a');
	  const tenantStandardB = uuid('tenant-standard-b');
	  const controlA = uuid('tenant-control-a');
	  const controlB = uuid('tenant-control-b');
	  const assetA = uuid('asset-a');
  const auditA = uuid('audit-a');
  const nonconformityA = uuid('nonconformity-a');
  const findingA = uuid('finding-a');
  const evidenceA = uuid('evidence-a');
  const actionA = uuid('action-a');
  const riskA = uuid('risk-a');
  const relationA = uuid('risk-control-a');
  const documentA = uuid('document-a');
	  const workflowA = uuid('workflow-a');
	  const calcRunA = uuid('calculation-run-a');
	  const readinessSnapshotA = uuid('readiness-snapshot-a');
  const readinessResultA = uuid('readiness-result-a');
  const readinessFindingA = uuid('readiness-finding-a');

  let pool;
  try {
    const version = pgVersion(pg);
    console.log(`POSTGRES_VERSION ${version}`);

    psqlExec(pg, fs.readFileSync(schemaPath, 'utf8'));
    psqlExec(pg, fs.readFileSync(seedPath, 'utf8'));
    psqlExec(pg, fs.readFileSync(schemaPath, 'utf8'));
    psqlExec(pg, fs.readFileSync(seedPath, 'utf8'));
    console.log('BOOTSTRAP_RERUN PASS');

    pool = createTenantAwarePool(new Pool({
      host: pg.socketDir,
      port: Number(pg.port),
      user: 'postgres',
      database: 'postgres',
      max: 3,
      connectionTimeoutMillis: 1000,
    }));

    await withPlatformTransaction(pool, { role: 'migration_runner', reason: 'dbn05_reference_catalog_loader' }, async (client) => {
      const tables = ['iso_standards','iso_standard_versions','iso_controls','iso_evidence_expectations','standards', 'controls_catalog', 'controls_catalog_standards', 'permissions',
        'commercial_technical_capabilities', 'plan_version_capabilities', 'saas_modules', 'official_formula_definitions', 'official_formula_versions',
        'official_formula_source_contracts', 'data_source_contracts', 'data_source_contract_versions',
        'metric_definitions', 'metric_definition_versions', 'metric_source_bindings', 'knowledge_sources', 'knowledge_items'];
      // The canonical KB loader rebuilds derived children; compare their logical content,
      // while retaining identity checks for source/item/catalog records.
      const derivedKbTables = ['knowledge_evidence_expectations','knowledge_audit_questions','knowledge_common_gaps',
        'knowledge_recommended_actions','knowledge_rules','knowledge_rule_hints','knowledge_mappings'];
      tables.push(...derivedKbTables);
      async function snapshot() {
        const result = {};
        for (const table of tables) {
          const volatileFields = derivedKbTables.includes(table) ? "'id','created_at','updated_at'" : "'updated_at','published_at','reviewed_at','approved_at'";
          result[table] = (await client.query(`SELECT count(*)::int AS count,
            md5(COALESCE(string_agg(payload::text, ',' ORDER BY payload::text), '')) AS fingerprint
            FROM (SELECT to_jsonb(t) - ARRAY[${volatileFields}] AS payload FROM ${table} t) stable`)).rows[0];
        }
        return result;
      }
      await loadProductionReferenceCatalogs({ db: pool, logger: { log() {} }, closePool: false });
      const first = await snapshot();
      console.log('CATALOG_LOAD_1 PASS');
      await loadProductionReferenceCatalogs({ db: pool, logger: { log() {} }, closePool: false });
      const second = await snapshot();
      console.log('CATALOG_LOAD_2 PASS');
      assert.deepEqual(second, first, 'catalog rerun must preserve identities, counts and stable payloads');
      const { FORMULAS } = require('../../backend/src/services/math-governance/formulaRegistry.service');
      const { listSourceContracts } = require('../../backend/src/services/math-governance/sourceContracts.service');
      const { FUNCTIONAL_INDICATORS } = require('../../backend/src/services/indicators/functionalIndicatorCatalog');
      const { COMMERCIAL_PLAN_CAPABILITIES, planAllowsCapability } = require('../../backend/src/services/commercial/commercialPlanMatrix.service');
      assert.equal(first.commercial_technical_capabilities.count, COMMERCIAL_PLAN_CAPABILITIES.length);
      const commercialRows = (await client.query('SELECT * FROM commercial_technical_capabilities ORDER BY capability_key')).rows;
      assert.deepEqual(commercialRows.map(c => c.capability_key), COMMERCIAL_PLAN_CAPABILITIES.map(c => c.capability_key).sort());
      for (const row of commercialRows) {
        const expected = COMMERCIAL_PLAN_CAPABILITIES.find(c => c.capability_key === row.capability_key);
        assert.equal(row.classification, expected.classification);
        assert.equal(row.required_permission, expected.required_permission);
      }
      for (const row of (await client.query('SELECT v.plan_key,c.capability_key,c.is_included FROM plan_version_capabilities c JOIN commercial_plan_versions v ON v.id=c.plan_version_id')).rows) {
        assert.equal(row.is_included, planAllowsCapability(row.plan_key,row.capability_key), 'canonical commercial plan/addon boundary');
      }
      assert.equal(first.official_formula_definitions.count, FORMULAS.length);
      assert.equal(first.official_formula_versions.count, FORMULAS.length);
      assert.equal(first.official_formula_source_contracts.count, listSourceContracts().length);
      assert.equal(first.metric_definitions.count, FUNCTIONAL_INDICATORS.length);
      assert.equal(first.knowledge_items.count, 1000);
      assert.equal(first.controls_catalog.count, first.controls_catalog_standards.count);
      assert.equal((await client.query('SELECT count(*)::int AS count FROM tenants')).rows[0].count, 0, 'reference loader must not seed tenants');
      const manifest = require('../../database/reference/iso/manifest.json');
      assert.equal(first.iso_standards.count,3);
      assert.equal(first.iso_standard_versions.count,4);
      assert.equal(first.iso_controls.count,61);
      assert.equal(first.iso_evidence_expectations.count,54);
      for (const source of manifest.standards) {
        const versions = await client.query('SELECT * FROM iso_standard_versions WHERE standard_code=$1 AND version_code=$2',[source.standard_code,source.version_code]);
        assert.equal(versions.rowCount,1);
        assert.equal(versions.rows[0].certifiable,source.certifiable);
        assert.equal(versions.rows[0].status,source.status);
        assert.equal(versions.rows[0].publication_status,source.publication_status);
        const controls = await client.query('SELECT count(*)::int AS n FROM iso_controls WHERE standard_code=$1 AND version_code=$2',[source.standard_code,source.version_code]);
        assert.equal(controls.rows[0].n,source.row_count);
        const evidence = await client.query('SELECT count(*)::int AS n FROM iso_evidence_expectations WHERE standard_code=$1 AND version_code=$2',[source.standard_code,source.version_code]);
        assert.equal(evidence.rows[0].n,source.evidence_row_count);
      }
      assert.equal((await client.query("SELECT count(*)::int AS n FROM standards WHERE version_label LIKE '%2026%'")).rows[0].n,0,'FDIS must not enter certifiable product catalog');
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM iso_evidence_expectations e
        LEFT JOIN iso_controls c ON c.id=e.control_id AND c.standard_code=e.standard_code AND c.version_code=e.version_code AND c.control_code=e.control_code
        WHERE c.id IS NULL`)).rows[0].n,0);
      const crossed = await client.query("SELECT id FROM iso_controls WHERE standard_code='ISO9001' AND version_code='2026_FDIS' LIMIT 1");
      await client.query('SAVEPOINT iso_cross_version');
      await assert.rejects(()=>client.query("UPDATE iso_evidence_expectations SET control_id=$1 WHERE standard_code='ISO9001' AND version_code='2015'",[crossed.rows[0].id]),error=>error.code==='23503');
      await client.query('ROLLBACK TO SAVEPOINT iso_cross_version');
      console.log('REFERENCE_CATALOG_LOADER PASS versioned=61 evidence=54 TRANSITION_ONLY=8');
      console.log('CATALOG_COUNTS ' + JSON.stringify(Object.fromEntries(Object.entries(first).map(([k,v]) => [k,v.count]))));
      assert.equal((await client.query("SELECT count(*)::int AS count FROM knowledge_import_runs WHERE status='completed'")).rows[0].count, 2, 'both KB import runs must complete');
      console.log('KB_DERIVED_CONTENT_IDEMPOTENT PASS');
      console.log('IDEMPOTENT PASS');
    });
    console.log('CATALOG_LOADER_RERUN PASS');

    await withPlatformTransaction(pool, { role: 'migration_runner', reason: 'dbn05_pgvector_validation' }, async (client) => {
      const extension = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      assert.equal(extension.rowCount, 1, 'pgvector extension must be enabled');
      const distance = await client.query("SELECT ('[1,0]'::vector <=> '[0,1]'::vector)::numeric AS distance");
      assert.ok(Number(distance.rows[0].distance) > 0, 'pgvector cosine distance operator must be usable');
      const column = await client.query(`
        SELECT udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_chunk_embeddings'
          AND column_name = 'embedding'
      `);
      assert.equal(column.rows[0]?.udt_name, 'vector', 'knowledge_chunk_embeddings.embedding must be vector');
    });
    console.log('PGVECTOR_VALIDATION PASS');

    await withPlatformTransaction(pool, { role: 'migration_runner', reason: 'dbn05_fresh_seed_validation' }, async (client) => {
      await client.query(`
        INSERT INTO tenants (id, name, slug, service_status)
        VALUES
          ($1, 'Fresh Tenant A', 'fresh-tenant-a', 'active'),
          ($2, 'Fresh Tenant B', 'fresh-tenant-b', 'active')
        ON CONFLICT (slug) DO NOTHING
      `, [tenantA, tenantB]);

      await client.query(`
        INSERT INTO tenant_subscriptions (tenant_id, plan_key, status)
        VALUES ($1, 'enterprise', 'active'), ($2, 'enterprise', 'active')
      `, [tenantA, tenantB]);

      await client.query(`
        INSERT INTO tenant_module_settings (tenant_id, module_key, enabled)
        SELECT tenant_id, module_key, true
        FROM (VALUES ($1::uuid), ($2::uuid)) tenants(tenant_id)
        CROSS JOIN saas_modules
        ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = true
      `, [tenantA, tenantB]);

      await client.query(`
        INSERT INTO tenant_standards (id, tenant_id, standard_code, is_active, lifecycle_status)
        VALUES
          ($1, $2, 'ISO_27001_2022', true, 'active'),
          ($3, $4, 'ISO_27001_2022', true, 'active')
      `, [tenantStandardA, tenantA, tenantStandardB, tenantB]);

      await client.query(`
        INSERT INTO tenant_operations (id, tenant_id, operation_key, name, status)
        VALUES
          ($1, $2, 'core-operation', 'Core operation A', 'active'),
          ($3, $4, 'core-operation', 'Core operation B', 'active')
      `, [operationA, tenantA, operationB, tenantB]);

      const catalog = await client.query("SELECT id FROM controls_catalog WHERE iso='ISO_27001_2022' AND code='A.5.1'");
      const catalogControlId = catalog.rows[0].id;

      await client.query(`
        INSERT INTO tenant_controls (id, tenant_id, control_id, tenant_standard_id, operation_id, applicability_status, implementation_status)
        VALUES
          ($1, $2, $3, $4, $5, 'applicable', 'in_progress'),
          ($6, $7, $3, $8, $9, 'applicable', 'implemented')
      `, [controlA, tenantA, catalogControlId, tenantStandardA, operationA, controlB, tenantB, tenantStandardB, operationB]);

	      await client.query(`
	        INSERT INTO users (tenant_id, email, name, role, effective_role, status)
        VALUES ($1, 'tenant-a-user@example.invalid', 'Tenant A User', 'tenant_admin', 'tenant_admin', 'active')
      `, [tenantA]);

      await client.query(`
        INSERT INTO assets (id, tenant_id, asset_key, name, criticality)
        VALUES ($1, $2, 'asset-primary', 'Primary asset', 'high')
      `, [assetA, tenantA]);

      await client.query(`
        INSERT INTO audits (id, tenant_id, audit_key, standard_code, status)
        VALUES ($1, $2, 'audit-readiness', 'ISO_27001_2022', 'planned')
      `, [auditA, tenantA]);

      await client.query(`
        INSERT INTO tenant_nonconformities (id, tenant_id, audit_id, tenant_control_id, severity, status, title)
        VALUES ($1, $2, $3, $4, 'medium', 'open', 'Fresh nonconformity')
      `, [nonconformityA, tenantA, auditA, controlA]);

      await client.query(`
        INSERT INTO findings (id, tenant_id, tenant_control_id, catalog_control_id, audit_id, asset_id, nonconformity_id, title, severity, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Fresh finding', 'high', 'open')
      `, [findingA, tenantA, controlA, catalogControlId, auditA, assetA, nonconformityA]);

	      await client.query(`
	        INSERT INTO evidences (id, tenant_id, tenant_control_id, catalog_control_id, title, status, validated)
	        VALUES ($1, $2, $3, $4, 'Fresh evidence', 'approved', TRUE)
	      `, [evidenceA, tenantA, controlA, catalogControlId]);

      await client.query(`
        INSERT INTO action_plans (id, tenant_id, tenant_control_id, finding_id, audit_id, asset_id, nonconformity_id, title, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Fresh action plan', 'open')
      `, [actionA, tenantA, controlA, findingA, auditA, assetA, nonconformityA]);

      await client.query(`
        INSERT INTO risks (id, tenant_id, risk_key, title, inherent_score, residual_score)
        VALUES ($1, $2, 'risk-primary', 'Primary risk', 15, 8)
      `, [riskA, tenantA]);

      await client.query(`
        INSERT INTO risk_control_relations (id, tenant_id, risk_id, tenant_control_id)
        VALUES ($1, $2, $3, $4)
      `, [relationA, tenantA, riskA, controlA]);

      await client.query(`
        INSERT INTO documents (id, tenant_id, document_key, title, document_type, status)
        VALUES ($1, $2, 'policy-main', 'Main security policy', 'policy', 'approved')
      `, [documentA, tenantA]);

      const workflowVersion = await client.query(`
        SELECT wv.id
        FROM grc_workflow_versions wv
        JOIN grc_workflow_definitions wd ON wd.id = wv.workflow_definition_id
        WHERE wd.workflow_key = 'finding_remediation'
        ORDER BY wv.version DESC
        LIMIT 1
      `);
      await client.query(`
        INSERT INTO grc_workflow_instances (id, tenant_id, workflow_version_id, subject_type, subject_id, status, state_key)
        VALUES ($1, $2, $3, 'finding', $4, 'open', 'in_progress')
      `, [workflowA, tenantA, workflowVersion.rows[0].id, findingA]);

      const formulaVersion = await client.query(`
        SELECT v.id FROM official_formula_versions v JOIN official_formula_definitions d ON d.id=v.formula_definition_id
        WHERE v.tenant_id IS NULL AND d.formula_code = 'F5_5_GRC_HEALTH' AND v.version_number = 2
      `);
      const sourceContract = await client.query(`
        SELECT id FROM official_formula_source_contracts
        WHERE tenant_id IS NULL
          AND source_code = 'grc_health_components'
          AND status = 'published'
        ORDER BY version_number DESC
        LIMIT 1
      `);
      assert.ok(sourceContract.rows[0]?.id, 'P03 source contract must exist for Health binding');
      await client.query(`
        INSERT INTO metric_source_bindings (
          tenant_id, metric_code, metric_key, formula_code, source_code, source_contract_id,
          binding_status, version_number, methodology_version, unit, published_at, metadata, official_formula_version_id
        )
        VALUES (
          $1, 'F5_5_GRC_HEALTH', 'F5_5_GRC_HEALTH', 'F5_5_GRC_HEALTH',
          'grc_health_components', $2, 'published', 1, 1, 'score', now(),
          '{"source":"dbn05_fresh_contract_test"}'::jsonb, $3
        )
      `, [tenantA, sourceContract.rows[0].id, formulaVersion.rows[0].id]);
      await client.query(`
        INSERT INTO calculation_runs (
          id, tenant_id, formula_version_id, formula_code, source_contract_id, run_key,
          status, run_status, coverage, completed_at, metadata
        )
        VALUES (
          $1, $2, $3, 'F5_5_GRC_HEALTH', $4, 'health-run-001',
          'completed', 'calculated', 1.00, now(), '{"pipeline":"F5_5_GRC_HEALTH_v2"}'::jsonb
        )
      `, [calcRunA, tenantA, formulaVersion.rows[0].id, sourceContract.rows[0].id]);
      await client.query(`
        INSERT INTO calculation_inputs (tenant_id, run_id, input_key, numeric_value, state)
        VALUES
          ($1, $2, 'risk', 80, 'available'),
          ($1, $2, 'compliance', 85, 'available'),
          ($1, $2, 'actions', 70, 'available'),
          ($1, $2, 'evidence', 90, 'available'),
          ($1, $2, 'dataTrust', 95, 'available')
      `, [tenantA, calcRunA]);
      await client.query(`
        INSERT INTO calculation_outputs (tenant_id, run_id, output_key, output_name, numeric_value, output_value, state, metadata)
        VALUES ($1, $2, 'grc_health_score', 'value', 84, '{"value":84}'::jsonb, 'measured', '{"source":"governed"}'::jsonb)
      `, [tenantA, calcRunA]);
      await client.query(`
	        INSERT INTO metric_snapshots (
	          tenant_id, metric_code, run_id, calculation_run_id, official_formula_version_id,
	          numeric_value, publication_state, coverage, metadata
	        )
	        VALUES
	          ($1, 'F5_5_GRC_HEALTH', $2, $2, $3, 84, dbn02_grc_health_publication_state(1.00, 0.80, 84), 1.00, '{"components":["risk","compliance","actions","evidence","dataTrust"]}'::jsonb),
	          ($1, 'F5_5_GRC_HEALTH_PARTIAL', $2, $2, $3, 55, dbn02_grc_health_publication_state(0.40, 0.80, 55), 0.40, '{}'::jsonb),
	          ($1, 'F5_5_GRC_HEALTH_MISSING', $2, $2, $3, NULL, dbn02_grc_health_publication_state(0.00, 0.80, NULL), 0.00, '{}'::jsonb),
	          ($1, 'F5_5_CONTROL_EFFECTIVENESS', $2, $2, $3, 82, dbn02_grc_health_publication_state(1.00, 0.80, 82), 1.00, jsonb_build_object('tenant_control_id', $4::text, 'source', 'governed_control_health'))
	      `, [tenantA, calcRunA, formulaVersion.rows[0].id, controlA]);

      await client.query(`
        INSERT INTO grc_readiness_snapshots (id, tenant_id, snapshot_key, readiness_score, state)
        VALUES ($1, $2, 'readiness-001', 84, 'measured')
      `, [readinessSnapshotA, tenantA]);
      await client.query(`
        INSERT INTO grc_readiness_results (id, tenant_id, snapshot_id, result_key, result_value, state)
        VALUES ($1, $2, $3, 'overall', 84, 'measured')
      `, [readinessResultA, tenantA, readinessSnapshotA]);
      await client.query(`
        INSERT INTO grc_readiness_findings (id, tenant_id, snapshot_id, result_id, finding_id, status)
        VALUES ($1, $2, $3, $4, $5, 'open')
      `, [readinessFindingA, tenantA, readinessSnapshotA, readinessResultA, findingA]);
    });

    await withTenantTransaction(pool, { tenantId: tenantA, role: 'tenant_runtime' }, async (client) => {
	      const health = await client.query(`
	        SELECT metric_code, numeric_value, publication_state
	        FROM metric_snapshots
	        WHERE tenant_id = $1
	          AND metric_code IN ('F5_5_GRC_HEALTH','F5_5_GRC_HEALTH_PARTIAL','F5_5_GRC_HEALTH_MISSING')
	        ORDER BY metric_code
	      `, [tenantA]);
      const states = Object.fromEntries(health.rows.map((row) => [row.metric_code, row.publication_state]));
      assert.equal(states.F5_5_GRC_HEALTH, 'measured');
      assert.equal(states.F5_5_GRC_HEALTH_PARTIAL, 'insufficient_coverage');
	      assert.equal(states.F5_5_GRC_HEALTH_MISSING, 'not_calculable');

	      const controlHealth = await client.query(`
	        SELECT tenant_control_id, catalog_control_id, standard_code, effective_health_score, effective_health_status,
	          health_trace_json->>'authority' AS authority
	        FROM v_iso_control_effective_health
	        WHERE tenant_id = $1 AND tenant_control_id = $2
	      `, [tenantA, controlA]);
	      const expectedCatalog = await client.query("SELECT control_id FROM tenant_controls WHERE tenant_id=$1 AND id=$2", [tenantA, controlA]);
	      assert.equal(controlHealth.rowCount, 1, 'canonical control Health projection must exist for tenant_control_id');
	      assert.equal(controlHealth.rows[0].tenant_control_id, controlA);
	      assert.equal(controlHealth.rows[0].catalog_control_id, expectedCatalog.rows[0].control_id);
	      assert.equal(controlHealth.rows[0].standard_code, 'ISO_27001_2022');
	      assert.equal(Number(controlHealth.rows[0].effective_health_score), 82);
	      assert.equal(controlHealth.rows[0].effective_health_status, 'saludable');
	      assert.equal(controlHealth.rows[0].authority, 'metric_snapshots');

      const componentStates = await client.query(`
        SELECT
          dbn02_normalize_health_component_state(NULL, false) AS missing_source,
          dbn02_normalize_health_component_state('missing', true) AS missing_numeric,
          dbn02_normalize_health_component_state('unknown', true) AS unknown_numeric,
          dbn02_normalize_health_component_state('not_configured', true) AS not_configured_numeric,
          dbn02_normalize_health_component_state('not_configured', false) AS not_configured,
          dbn02_normalize_health_component_state('available', true) AS available,
          dbn02_normalize_health_component_state('stale', true) AS stale_numeric,
          dbn02_normalize_health_component_state('available', true, now() - interval '10 days', interval '1 day') AS stale,
          dbn02_normalize_health_component_state('insufficient_coverage', false) AS insufficient_coverage,
          dbn02_normalize_health_component_state('measured', true) AS measured
      `);
      assert.deepEqual(componentStates.rows[0], {
        missing_source: 'UNKNOWN',
        missing_numeric: 'MISSING',
        unknown_numeric: 'UNKNOWN',
        not_configured_numeric: 'NOT_CONFIGURED',
        not_configured: 'NOT_CONFIGURED',
        available: 'AVAILABLE',
        stale_numeric: 'STALE',
        stale: 'STALE',
        insufficient_coverage: 'MISSING',
        measured: 'AVAILABLE',
      });

      const sourceLineage = await client.query(`
        WITH binding AS (
          SELECT
            msb.id AS binding_id,
            ofsc.id AS source_contract_id,
            ofv.id AS formula_version_id
          FROM metric_source_bindings msb
          JOIN official_formula_source_contracts ofsc
            ON ofsc.id = msb.source_contract_id
          JOIN official_formula_versions ofv
            ON ofv.id = msb.official_formula_version_id
           AND ofv.source_contract_code = ofsc.source_code
          WHERE msb.tenant_id = $1
            AND msb.metric_code = 'F5_5_GRC_HEALTH'
            AND msb.binding_status = 'published'
        ),
        runs AS (
          SELECT cr.id
          FROM calculation_runs cr
          JOIN binding b
            ON cr.tenant_id = $1
           AND cr.formula_version_id = b.formula_version_id
           AND cr.source_contract_id = b.source_contract_id
        ),
        output_counts AS (
          SELECT count(DISTINCT co.id)::int AS outputs
          FROM calculation_outputs co
          JOIN runs r ON r.id = co.run_id
          WHERE co.tenant_id = $1
        ),
        snapshot_counts AS (
          SELECT
            count(DISTINCT snap.id)::int AS snapshots,
            count(DISTINCT snap.id) FILTER (WHERE snap.metric_code = 'F5_5_GRC_HEALTH')::int AS grc_health_snapshots,
            count(DISTINCT snap.id) FILTER (WHERE snap.metric_code = 'F5_5_CONTROL_EFFECTIVENESS')::int AS control_effectiveness_snapshots
          FROM metric_snapshots snap
          JOIN runs r ON r.id = snap.run_id OR r.id = snap.calculation_run_id
          WHERE snap.tenant_id = $1
        )
        SELECT
          (SELECT count(*)::int FROM binding) AS bindings,
          (SELECT count(*)::int FROM runs) AS runs,
          output_counts.outputs,
          snapshot_counts.snapshots,
          snapshot_counts.grc_health_snapshots,
          snapshot_counts.control_effectiveness_snapshots
        FROM output_counts CROSS JOIN snapshot_counts
      `, [tenantA]);
      assert.deepEqual(sourceLineage.rows[0], {
        bindings: 1,
        runs: 1,
        outputs: 1,
        snapshots: 4,
        grc_health_snapshots: 1,
        control_effectiveness_snapshots: 1,
      }, 'P03 source contract -> binding -> formula -> run -> output -> snapshot lineage must be reconstructible');
    });
    console.log('FUNCTIONAL_VALIDATION PASS');

    const crossTenant = await psqlExec(pg, `
INSERT INTO findings (id, tenant_id, tenant_control_id, title)
VALUES (${sqlLiteral(uuid('bad-cross-tenant'))}, ${sqlLiteral(tenantA)}, ${sqlLiteral(controlB)}, 'Cross tenant should fail');
`, { allowFailure: true });
    assert.notEqual(crossTenant.status, 0, 'cross-tenant tenant_control relation should fail');

    const aiReaderGrants = await psqlExec(pg, `
SELECT count(*)::int
FROM information_schema.role_table_grants
WHERE grantee = 'ai_reader'
  AND table_schema = 'ai_core'
  AND privilege_type = 'SELECT';
`).stdout.trim();
    assert.equal(aiReaderGrants, '0', 'P04 ai_reader must not have unsafe direct ai_core read grants while RLS is deferred');

    await withTenantTransaction(pool, { tenantId: tenantA, role: 'tenant_runtime' }, async (client) => {
      const current = await client.query("SELECT current_setting('app.tenant_id', true) AS tenant_id");
      assert.equal(current.rows[0].tenant_id, tenantA);
    });
    await withTenantTransaction(pool, { tenantId: tenantB, role: 'tenant_runtime' }, async (client) => {
      const current = await client.query("SELECT current_setting('app.tenant_id', true) AS tenant_id");
      assert.equal(current.rows[0].tenant_id, tenantB);
      const filtered = await client.query('SELECT count(*)::int AS count FROM tenant_controls WHERE tenant_id = current_setting($1, true)::uuid', ['app.tenant_id']);
      assert.equal(filtered.rows[0].count, 1);
    });
    const leak = await pool.query("SELECT current_setting('app.tenant_id', true) AS tenant_id, current_setting('app.platform_scope', true) AS platform_scope");
    assert.equal(leak.rows[0].tenant_id, '');
    assert.equal(leak.rows[0].platform_scope, '');
    console.log('MULTITENANT_VALIDATION PASS');

	    const legacyAbsence = psqlExec(pg, `
	WITH forbidden_relations AS (
	  SELECT c.relname AS name
	  FROM pg_class c
	  JOIN pg_namespace n ON n.oid = c.relnamespace
	  WHERE n.nspname IN ('public','qa_audit')
	    AND (
	      c.relname IN ('controls', 'control_health_scores', 'v_latest_health_kpi_snapshots', 'control_health_scores_v2_preview', 'evidences_backup_history', 'action_plans_backup_history')
	      OR c.relname ~* '(backup_before_|cleanup_backup|backup_history|v2_preview|qa_|preview)'
	    )
	),
	forbidden_functions AS (
	  SELECT p.proname AS name
	  FROM pg_proc p
	  JOIN pg_namespace n ON n.oid = p.pronamespace
	  WHERE n.nspname = 'public'
	    AND p.proname = 'refresh_control_health_scores_v2_1'
	),
	forbidden_columns AS (
	  SELECT table_name || '.' || column_name AS name
	  FROM information_schema.columns
	  WHERE table_schema = 'public'
	    AND column_name IN ('legacy_control_id', 'controls_id_legacy')
	),
	forbidden_metrics AS (
	  SELECT metric_code AS name
	  FROM metric_definitions
	  WHERE metric_code LIKE 'KPI-HLT-%'
	)
	SELECT count(*)::int
	FROM (
	  SELECT name FROM forbidden_relations
	  UNION ALL SELECT name FROM forbidden_functions
	  UNION ALL SELECT name FROM forbidden_columns
	  UNION ALL SELECT name FROM forbidden_metrics
	) forbidden;
	`).stdout.trim();
	    assert.equal(legacyAbsence, '0');
	    console.log(`LEGACY_OBJECT_COUNT=${legacyAbsence}`);
	    console.log('ZERO_LEGACY_OBJECTS PASS');

    const integrity = psqlExec(pg, `
WITH checks AS (
  SELECT 'findings_cross_tenant' AS check_name, count(*)::int AS invalid_count
  FROM findings f
  LEFT JOIN tenant_controls tc ON tc.id = f.tenant_control_id AND tc.tenant_id = f.tenant_id
  WHERE f.tenant_control_id IS NOT NULL AND tc.id IS NULL
  UNION ALL
  SELECT 'evidences_cross_tenant', count(*)::int
  FROM evidences e
  LEFT JOIN tenant_controls tc ON tc.id = e.tenant_control_id AND tc.tenant_id = e.tenant_id
  WHERE e.tenant_control_id IS NOT NULL AND tc.id IS NULL
	  UNION ALL
	  SELECT 'action_plans_cross_tenant', count(*)::int
	  FROM action_plans ap
	  LEFT JOIN tenant_controls tc ON tc.id = ap.tenant_control_id AND tc.tenant_id = ap.tenant_id
	  WHERE ap.tenant_control_id IS NOT NULL AND tc.id IS NULL
	  UNION ALL
	  SELECT 'tenant_required_nulls', count(*)::int
  FROM (
    SELECT tenant_id FROM tenant_controls
    UNION ALL SELECT tenant_id FROM findings
    UNION ALL SELECT tenant_id FROM evidences
    UNION ALL SELECT tenant_id FROM action_plans
    UNION ALL SELECT tenant_id FROM risks
    UNION ALL SELECT tenant_id FROM audits
  ) tenant_rows
  WHERE tenant_id IS NULL
  UNION ALL
  SELECT 'duplicate_critical_natural_keys', count(*)::int
  FROM (
    SELECT tenant_id::text || ':' || risk_key AS key FROM risks GROUP BY tenant_id, risk_key HAVING count(*) > 1
    UNION ALL
    SELECT tenant_id::text || ':' || metric_code || ':' || source_code FROM metric_source_bindings WHERE metric_code IS NOT NULL AND source_code IS NOT NULL GROUP BY tenant_id, metric_code, source_code HAVING count(*) > 1
    UNION ALL
    SELECT COALESCE(tenant_id::text, 'global') || ':' || metric_key || ':' || version_number FROM metric_source_bindings WHERE metric_key IS NOT NULL GROUP BY tenant_id, metric_key, version_number HAVING count(*) > 1
  ) duplicates
)
SELECT string_agg(check_name || '=' || invalid_count, ',' ORDER BY check_name)
FROM checks
WHERE invalid_count <> 0;
`).stdout.trim();
    assert.equal(integrity, '');
    console.log('INTEGRITY_VALIDATION PASS');

    const objectCounts = psqlExec(pg, `
SELECT
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('public','tcdx_security','ai_core') AND c.relkind IN ('r','v','m')) AS relations,
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('public','tcdx_security')) AS functions,
  (SELECT count(*)::int FROM pg_indexes WHERE schemaname IN ('public','tcdx_security','ai_core')) AS indexes;
`).stdout.trim();
    console.log(`OBJECT_COUNTS ${objectCounts}`);

    await assertBackendStartup(pg);
    console.log('FRESH_DB_FROM_ZERO PASS');
  } finally {
    if (pool) await pool.end();
    stopPostgres(pg);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  console.log('FRESH_DB_FROM_ZERO FAIL');
  process.exit(1);
});
