'use strict';

const assert = require('node:assert/strict');
const Module = require('module');

const TENANT_ID = '70000000-0000-0000-0000-000000000701';
const ASSESSMENT_ID = '787305ef-d900-4776-9d2b-44088bf90681';
const TENANT_CONTROL_ID = '764e343b-3d8f-478d-a396-54b0aa7e0820';
const USER_ID = '11111111-1111-4111-8111-111111111111';

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
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };
}

async function runTests() {
  const fakePool = createFakePool();
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../config/db') return fakePool;
    if (request === './aiEngineClient.service') return {};
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve('./soaIntelligence.service')];
  const service = require('./soaIntelligence.service');
  const result = await service.applyAssessment({
    tenantId: TENANT_ID,
    assessmentId: ASSESSMENT_ID,
    userId: USER_ID,
  });

  Module._load = originalLoad;

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
}

runTests()
  .then(() => console.log('soaIntelligence.service tests OK'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
