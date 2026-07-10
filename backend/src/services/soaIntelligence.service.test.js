'use strict';

const assert = require('node:assert/strict');
const Module = require('module');

const TENANT_ID = '70000000-0000-0000-0000-000000000701';
const ASSESSMENT_ID = '787305ef-d900-4776-9d2b-44088bf90681';
const TENANT_CONTROL_ID = '764e343b-3d8f-478d-a396-54b0aa7e0820';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const ISO = 'ISO27001';

function createFakePool() {
  const state = {
    queries: [],
    commits: 0,
    rollbacks: 0,
    releases: 0,
    soa: {
      applicable: false,
      implementation_status: 'no aplica',
      justification: 'Exclusion anterior.',
    },
    assessment: {
      id: ASSESSMENT_ID,
      tenant_id: TENANT_ID,
      tenant_control_id: TENANT_CONTROL_ID,
      iso_code: 'ISO27001',
      source: 'system',
      status: 'draft',
      suggested_applicable: true,
      suggested_implementation_status: 'parcial',
      suggested_justification: 'Existe evidencia, pero no toda es valida.',
      confidence_score: 54,
      confidence_level: 'media',
    },
    changeLog: [],
    savedAssessments: [],
  };

  const client = {
    async query(sql, params = []) {
      const compactSql = String(sql).replace(/\s+/g, ' ').trim();
      state.queries.push({ sql: compactSql, params });

      if (/^BEGIN/.test(compactSql)) return { rows: [], rowCount: 0 };
      if (/^COMMIT/.test(compactSql)) {
        state.commits += 1;
        return { rows: [], rowCount: 0 };
      }
      if (/^ROLLBACK/.test(compactSql)) {
        state.rollbacks += 1;
        return { rows: [], rowCount: 0 };
      }

      if (compactSql.includes('LEFT JOIN control_soa') && compactSql.includes('FOR UPDATE')) {
        throw new Error('FOR UPDATE cannot be applied to the nullable side of an outer join');
      }

      if (compactSql.includes('FROM control_soa_assessments a') && compactSql.includes('FOR UPDATE OF a')) {
        assert.deepEqual(params, [ASSESSMENT_ID, TENANT_ID]);
        return { rows: [state.assessment], rowCount: 1 };
      }

      if (compactSql.includes('FROM control_soa') && compactSql.includes('FOR UPDATE')) {
        assert.deepEqual(params, [TENANT_CONTROL_ID]);
        return { rows: [state.soa], rowCount: 1 };
      }

      if (compactSql.includes('INSERT INTO control_soa (')) {
        state.soa = {
          applicable: params[1],
          implementation_status: params[2],
          justification: params[3],
        };
        return { rows: [], rowCount: 1 };
      }

      if (compactSql.includes('INSERT INTO control_soa_change_log')) {
        assert.match(compactSql, /field_changed/);
        assert.match(compactSql, /changed_by/);
        assert.doesNotMatch(compactSql, /created_at/);
        state.changeLog.push({
          tenant_id: params[0],
          tenant_control_id: params[1],
          assessment_id: params[2],
          source: params[3],
          field_changed: params[4],
          old_value: params[5],
          new_value: params[6],
          reason: params[7],
          changed_by: params[8],
        });
        return { rows: [], rowCount: 1 };
      }

      if (compactSql.includes('UPDATE control_soa_assessments')) {
        state.assessment = {
          ...state.assessment,
          status: 'applied',
          applied_by: params[2],
          reviewed_by: params[2],
        };
        return { rows: [state.assessment], rowCount: 1 };
      }

      if (compactSql.includes('SELECT c.id AS tenant_control_id') && compactSql.includes('linked_tenant_control_ids')) {
        return {
          rows: [{
            tenant_control_id: TENANT_CONTROL_ID,
            tenant_id: TENANT_ID,
            iso: ISO,
            clause: 'A.5.1',
            catalog_control_id: '22222222-2222-4222-8222-222222222222',
            category: 'Organizacional',
            description: 'Politicas de seguridad.',
            diagnostic_status: 'pendiente',
            score: 0,
            applicable: true,
            implementation_status: 'pendiente',
            justification: null,
            notes: null,
            owner: null,
            review_date: null,
            linked_tenant_control_ids: [],
          }],
          rowCount: 1,
        };
      }

      if (
        compactSql.includes('evidences e') ||
        compactSql.includes('findings f') ||
        compactSql.includes('tenant_nonconformities nc') ||
        compactSql.includes('action_plans ap') ||
        compactSql.includes('iso_risk_matrix_items ri') ||
        compactSql.includes('control_health_scores chs') ||
        compactSql.includes('FROM audits a') ||
        compactSql.includes('FROM v_latest_health_kpi_snapshots') ||
        compactSql.includes('FROM control_soa_assessments')
      ) {
        return { rows: [], rowCount: 0 };
      }

      if (compactSql.includes('INSERT INTO control_soa_assessments')) {
        const row = {
          id: `assessment-${state.savedAssessments.length + 1}`,
          tenant_id: params[0],
          tenant_control_id: params[1],
          iso_code: params[2],
          source: params[3],
          status: 'draft',
          suggested_applicable: params[4],
          suggested_implementation_status: params[5],
          suggested_justification: params[6],
          confidence_score: params[7],
          confidence_level: params[8],
          evidence_summary: JSON.parse(params[9]),
          risk_summary: JSON.parse(params[10]),
          finding_summary: JSON.parse(params[11]),
          nonconformity_summary: JSON.parse(params[12]),
          action_summary: JSON.parse(params[13]),
          audit_summary: JSON.parse(params[14]),
          health_summary: JSON.parse(params[15]),
          kpi_summary: JSON.parse(params[16]),
          rule_results: JSON.parse(params[17]),
          ai_result: JSON.parse(params[18]),
          recommended_actions: JSON.parse(params[19]),
        };
        state.savedAssessments.push(row);
        return { rows: [row], rowCount: 1 };
      }

      throw new Error(`Unhandled SQL in fake SOA test DB: ${compactSql}`);
    },
    release() {
      state.releases += 1;
    },
  };

  return {
    state,
    async connect() {
      return client;
    },
    async query(sql, params = []) {
      return client.query(sql, params);
    },
  };
}

async function withPatchedService(fakePool, aiEngineClient, callback) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../config/db') return fakePool;
    if (request === './aiEngineClient.service') return aiEngineClient;
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve('./soaIntelligence.service')];
  const service = require('./soaIntelligence.service');
  try {
    await callback(service);
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('./soaIntelligence.service')];
  }
}

async function testApplyAssessment() {
  const fakePool = createFakePool();
  await withPatchedService(fakePool, {}, async (service) => {
    const result = await service.applyAssessment({
      tenantId: TENANT_ID,
      assessmentId: ASSESSMENT_ID,
      userId: USER_ID,
    });

    assert.equal(result.assessment.status, 'applied');
    assert.equal(fakePool.state.soa.applicable, true);
    assert.equal(fakePool.state.soa.implementation_status, 'parcial');
    assert.equal(fakePool.state.commits, 1);
    assert.equal(fakePool.state.rollbacks, 0);
    assert.equal(fakePool.state.releases, 1);
    assert.ok(fakePool.state.changeLog.some((row) => row.field_changed === 'applicable'));
    assert.ok(fakePool.state.changeLog.some((row) => row.field_changed === 'implementation_status'));
    assert.ok(fakePool.state.changeLog.every((row) => row.changed_by === USER_ID));
    assert.ok(fakePool.state.queries.some((query) => query.sql.includes('FOR UPDATE OF a')));
    assert.equal(fakePool.state.queries.some((query) => query.sql.includes('LEFT JOIN control_soa') && query.sql.includes('FOR UPDATE')), false);
  });
}

async function testRunSystemAssessmentAiTimeoutFallback() {
  const fakePool = createFakePool();
  let capturedOptions = null;
  const aiEngineClient = {
    async assessSoAControl(_payload, options) {
      capturedOptions = options;
      const error = new Error('ai-engine timeout after 12000ms');
      error.code = 'AI_ENGINE_TIMEOUT';
      error.timeout_ms = options.timeoutMs;
      throw error;
    },
  };

  await withPatchedService(fakePool, aiEngineClient, async (service) => {
    const assessment = await service.runSystemAssessment({
      tenantId: TENANT_ID,
      iso: ISO,
      tenantControlId: TENANT_CONTROL_ID,
      userId: USER_ID,
      useAi: true,
    });

    assert.equal(capturedOptions.timeoutMs <= 15000, true);
    assert.equal(assessment.status, 'draft');
    assert.equal(assessment.source, 'system');
    assert.equal(assessment.rule_results.ai_used, false);
    assert.equal(assessment.rule_results.fallback_used, true);
    assert.equal(assessment.rule_results.fallback_reason, 'AI_ENGINE_TIMEOUT');
    assert.equal(assessment.rule_results.human_review_required, true);
    assert.equal(assessment.ai_result.fallback_used, true);
    assert.equal(assessment.ai_result.fallback_reason, 'AI_ENGINE_TIMEOUT');
    assert.equal(fakePool.state.savedAssessments.length, 1);
  });
}

async function testRunSystemAssessmentDeterministic() {
  const fakePool = createFakePool();
  const aiEngineClient = {
    async assessSoAControl() {
      throw new Error('AI should not be called for deterministic assessment');
    },
  };

  await withPatchedService(fakePool, aiEngineClient, async (service) => {
    const assessment = await service.runSystemAssessment({
      tenantId: TENANT_ID,
      iso: ISO,
      tenantControlId: TENANT_CONTROL_ID,
      userId: USER_ID,
      useAi: false,
    });

    assert.equal(assessment.status, 'draft');
    assert.equal(assessment.source, 'system');
    assert.equal(assessment.ai_result && Object.keys(assessment.ai_result).length, 0);
  });
}

async function testRunSystemAssessmentBatchAiFallback() {
  const fakePool = createFakePool();
  const aiEngineClient = {
    async assessSoAControl() {
      throw new Error('Batch should force deterministic fallback');
    },
  };

  await withPatchedService(fakePool, aiEngineClient, async (service) => {
    const result = await service.runSystemAssessmentBatch({
      tenantId: TENANT_ID,
      iso: ISO,
      limit: 10,
      userId: USER_ID,
      useAi: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ai_fallback_forced, true);
    assert.equal(result.fallback_reason, 'SOA_AI_TIMEOUT');
    assert.equal(result.assessments.length, 1);
    assert.equal(result.assessments[0].rule_results.fallback_used, true);
  });
}

async function runTests() {
  await testApplyAssessment();
  await testRunSystemAssessmentAiTimeoutFallback();
  await testRunSystemAssessmentDeterministic();
  await testRunSystemAssessmentBatchAiFallback();
}

runTests()
  .then(() => console.log('soaIntelligence.service tests OK'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
