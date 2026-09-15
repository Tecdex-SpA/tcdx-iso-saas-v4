'use strict';

const assert = require('node:assert/strict');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function rows(data) {
  return { rows: data, rowCount: data.length };
}

async function query(sql, params = []) {
  const text = String(sql).replace(/\s+/g, ' ').trim();
  if (/SELECT email FROM users WHERE id = \$1::uuid/i.test(text)) {
    const [userId, tenantId] = params;
    if (userId === USER_A && tenantId === TENANT_A) return rows([{ email: 'usuario.a@empresa-a.cl' }]);
    if (userId === USER_B && tenantId === TENANT_B) return rows([{ email: 'usuario.b@empresa-b.cl' }]);
    return rows([]);
  }
  if (/FROM tenants t LEFT JOIN tenant_company_profiles p ON p\.tenant_id = t\.id/i.test(text)) {
    const [tenantId] = params;
    if (tenantId === TENANT_A) return rows([{ tenant_name: 'Empresa A SpA', profile_company_name: 'Spoof A', profile_legal_name: 'Legal A' }]);
    if (tenantId === TENANT_B) return rows([{ tenant_name: 'Empresa B SpA', profile_company_name: 'Spoof B', profile_legal_name: 'Legal B' }]);
    return rows([]);
  }
  throw new Error(`Unhandled LLM trace test query: ${text}`);
}

const dbPath = require.resolve('../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query } };

const {
  buildLlmTraceContext,
  mergeTraceIntoPayload,
  TRACE_SYSTEM,
  UNKNOWN_PROCESS_ACTOR,
} = require('./llmTraceContext.service');
const { AiEngineClient } = require('./aiEngineClient.service');

async function testHumanActorsAndCanonicalCompanies() {
  const traceA = await buildLlmTraceContext({
    path: '/api/ai/company-profile/analyze',
    payload: {
      tenant_id: TENANT_A,
      user_id: USER_A,
      email: 'attacker@evil.example',
      request_metadata: {
        llm_trace: {
          actor: 'spoofed@evil.example',
          system: 'other-system',
          company: 'Empresa B SpA',
        },
      },
    },
  });
  const traceB = await buildLlmTraceContext({
    path: '/api/ai/company-profile/analyze',
    payload: { tenant_id: TENANT_B, user_id: USER_B },
  });

  assert.equal(traceA.actor, 'usuario.a@empresa-a.cl', 'LLM_ACTOR_HUMAN_PROPAGATION');
  assert.equal(traceA.actor_type, 'authenticated_user');
  assert.equal(traceA.system, TRACE_SYSTEM, 'LLM_TRACE_SYSTEM_TCDX_ISO');
  assert.equal(traceA.company, 'Empresa A SpA', 'LLM_TRACE_COMPANY_FROM_CANONICAL_TENANT');
  assert.notEqual(traceA.actor, traceB.actor, 'LLM_ACTOR_DISTINCT_USERS');
  assert.equal(traceB.company, 'Empresa B SpA', 'LLM_TRACE_MULTITENANT_COMPANY_ISOLATION');
}

async function testProcessAndFallbackActors() {
  const processTrace = await buildLlmTraceContext({
    path: '/semantic-evidence/analyze',
    payload: { tenant_id: TENANT_A },
  });
  const fallbackTrace = await buildLlmTraceContext({ path: '/unclassified', payload: {} });

  assert.equal(processTrace.actor, 'evidence-analysis-worker@tecdex.net', 'LLM_TRACE_PROCESS_COMPANY_CONTEXT');
  assert.equal(processTrace.actor_type, 'process');
  assert.equal(processTrace.system, TRACE_SYSTEM);
  assert.equal(processTrace.company, 'Empresa A SpA');
  assert.equal(fallbackTrace.actor, UNKNOWN_PROCESS_ACTOR);
  assert.equal(fallbackTrace.company, 'platform');
}

async function testAiEngineClientOverwritesSpoofedTrace() {
  const previousFetch = global.fetch;
  const previousAiEngineUrl = process.env.AI_ENGINE_URL;
  const previousAiInternalToken = process.env.AI_INTERNAL_TOKEN;
  const captured = {};
  try {
    process.env.AI_ENGINE_URL = 'http://ai-engine.test';
    process.env.AI_INTERNAL_TOKEN = 'test-token';
    global.fetch = async (url, options) => {
      captured.url = url;
      captured.options = options;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      };
    };

    const client = new AiEngineClient();
    await client.postJson('/api/ai/company-profile/analyze', {
      tenant_id: TENANT_A,
      user_id: USER_A,
      request_metadata: {
        request_id: 'trace-test',
        llm_trace: {
          actor: 'spoofed@evil.example',
          system: 'other',
          company: 'Empresa B SpA',
        },
      },
    });

    const body = JSON.parse(captured.options.body);
    assert.equal(body.llm_trace.actor, 'usuario.a@empresa-a.cl', 'LLM_TRACE_ROOT_NO_FRONTEND_SPOOFING');
    assert.equal(body.request_metadata.llm_trace.actor, 'usuario.a@empresa-a.cl', 'LLM_TRACE_COMPANY_NO_FRONTEND_SPOOFING');
    assert.equal(body.request_metadata.llm_trace.system, TRACE_SYSTEM, 'LLM_TRACE_ACTOR_SYSTEM_COMPANY_TOGETHER');
    assert.equal(body.request_metadata.llm_trace.company, 'Empresa A SpA');
    assert.equal(body.request_metadata.request_id, 'trace-test');
  } finally {
    global.fetch = previousFetch;
    if (previousAiEngineUrl === undefined) delete process.env.AI_ENGINE_URL;
    else process.env.AI_ENGINE_URL = previousAiEngineUrl;
    if (previousAiInternalToken === undefined) delete process.env.AI_INTERNAL_TOKEN;
    else process.env.AI_INTERNAL_TOKEN = previousAiInternalToken;
  }
}

(async () => {
  await testHumanActorsAndCanonicalCompanies();
  await testProcessAndFallbackActors();
  await testAiEngineClientOverwritesSpoofedTrace();
  assert.deepEqual(
    mergeTraceIntoPayload({ request_metadata: { actor: 'spoof', company: 'spoof' } }, { actor: 'ok', system: TRACE_SYSTEM, company: 'Empresa A' }).request_metadata.llm_trace,
    { actor: 'ok', system: TRACE_SYSTEM, company: 'Empresa A' }
  );
  console.log('LLM_TRACE_CONTEXT_TESTS=PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
