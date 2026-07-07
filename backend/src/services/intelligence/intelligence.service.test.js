const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') {
    return {
      Pool: class {
        async query() {
          return { rows: [], rowCount: 0 };
        }
      },
    };
  }
  if (request === 'jsonwebtoken') {
    return {
      verify() {
        return {};
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const auth = require('../../middleware/auth');
const { enforceTenantRequestScope } = require('../../middleware/tenantScope.middleware');

const intelligenceRepository = require('./intelligence.repository');
const knowledgeService = require('../knowledge-base/knowledge.service');

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function runAuthNoTokenTest() {
  const req = { headers: {}, originalUrl: '/api/intelligence/brief/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const res = createMockResponse();
  let nextCalled = false;
  await auth(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.code, 'NO_TOKEN');
}

function runTenantMismatchTest() {
  const req = {
    method: 'GET',
    originalUrl: '/api/intelligence/brief/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    user: {
      role: 'admin',
      tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
    params: {},
    query: {},
    body: {},
  };
  const res = createMockResponse();
  let nextCalled = false;
  enforceTenantRequestScope(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, 'TENANT_SCOPE_MISMATCH');
}

async function runBriefFallbackTest() {
  intelligenceRepository.getTenantIntelligenceDataset = async ({ tenantId }) => ({
    tenant: { tenant_id: tenantId, name: 'Tenant Demo', active_standards: [] },
    scope: { context_version: 'test' },
    priority_controls: [],
    recent_evidences: [],
    risks: [],
    recent_findings: [],
    recent_action_plans: [],
    kpis: [],
    effective_health_summary: [],
    source_trace: [],
    limitations: ['No se encontraron controles disponibles para este tenant.'],
  });
  knowledgeService.buildKnowledgeContextForTenantDataset = async () => ({
    source_file: 'base_conocimiento_iso_grc_ia_tcdx_1000_registros.md',
    seed_version: 'v2',
    total_available_items: 0,
    sources_used: [],
    standards_covered: [],
    knowledge_items_used: [],
    rules_used: [],
    coverage_score: 0,
    license_warnings: [],
    missing_coverage: ['dataset_without_entities'],
  });

  delete require.cache[require.resolve('./intelligence.service')];
  const intelligence = require('./intelligence.service');
  const brief = await intelligence.buildTenantIntelligenceBrief({
    tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user: { role: 'admin', tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  });

  assert.equal(brief.ok, true);
  assert.equal(brief.knowledge_context.seed_version, 'v2');
  assert.equal(brief.confidence, 'baja');
  assert.ok(brief.brief.limitations.length > 0);
}

async function runTests() {
  await runAuthNoTokenTest();
  runTenantMismatchTest();
  await runBriefFallbackTest();
  console.log('intelligence.service tests OK');
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
