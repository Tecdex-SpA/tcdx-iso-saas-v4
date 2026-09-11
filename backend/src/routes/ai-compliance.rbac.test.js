'use strict';

const assert = require('assert');
const router = require('./ai-compliance.routes');

const {
  buildFeatureDisabledEngineHealthPayload,
  createAiComplianceReadGate,
  shouldSkipAiComplianceReadGate,
} = router._private;

const TENANT_A = '10000000-0000-4000-8000-000000000001';
const TENANT_B = '10000000-0000-4000-8000-000000000002';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    locals: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runGate({
  req,
  decision,
  tenantError = null,
}) {
  const calls = { next: 0, resolveCapability: 0, resolveEffectiveTenant: 0 };
  const gate = createAiComplianceReadGate({
    resolveEffectiveTenantFn: async (inputReq) => {
      calls.resolveEffectiveTenant += 1;
      if (tenantError) throw tenantError;
      const requestedTenant = inputReq.query?.tenant_id || inputReq.body?.tenant_id || inputReq.user?.tenant_id;
      if (requestedTenant && requestedTenant !== inputReq.user?.tenant_id) {
        const error = new Error('No autorizado para operar datos de otra empresa.');
        error.name = 'TenantResolutionError';
        error.code = 'TENANT_FORBIDDEN';
        error.status = 403;
        throw error;
      }
      return inputReq.user?.tenant_id;
    },
    resolveCapabilityFn: async () => {
      calls.resolveCapability += 1;
      return decision;
    },
  });
  const res = createResponse();
  await gate(req, res, () => {
    calls.next += 1;
  });
  return { res, calls };
}

(async function main() {
  assert.equal(shouldSkipAiComplianceReadGate({ path: '/engine-health' }), true);
  assert.equal(shouldSkipAiComplianceReadGate({ path: '/health-summary' }), false);

  const allowed = await runGate({
    req: {
      path: '/health-summary',
      method: 'GET',
      user: { id: 'user-1', tenant_id: TENANT_A, role: 'tenant_admin' },
    },
    decision: {
      enabled: true,
      decision: 'allowed',
      reason_code: 'ADDON_ENTITLED',
      capability_key: 'ai.compliance',
      source: 'addon',
    },
  });
  assert.equal(allowed.res.statusCode, 200);
  assert.equal(allowed.calls.next, 1);
  assert.equal(allowed.calls.resolveCapability, 1);

  const noAiView = await runGate({
    req: {
      path: '/suggestions',
      method: 'GET',
      user: { id: 'user-2', tenant_id: TENANT_A, role: 'viewer' },
    },
    decision: {
      enabled: false,
      decision: 'denied',
      reason_code: 'RBAC_PERMISSION_REQUIRED',
      capability_key: 'ai.compliance',
      source: 'addon',
    },
  });
  assert.equal(noAiView.res.statusCode, 403);
  assert.equal(noAiView.res.body.code, 'PERMISSION_DENIED');
  assert.equal(noAiView.res.body.reason_code, 'RBAC_PERMISSION_REQUIRED');
  assert.equal(noAiView.calls.next, 0);

  const noCapability = await runGate({
    req: {
      path: '/health-summary',
      method: 'GET',
      user: { id: 'user-3', tenant_id: TENANT_A, role: 'tenant_admin' },
    },
    decision: {
      enabled: false,
      decision: 'denied',
      reason_code: 'ADDON_REQUIRED',
      capability_key: 'ai.compliance',
      source: 'none',
    },
  });
  assert.equal(noCapability.res.statusCode, 403);
  assert.equal(noCapability.res.body.code, 'CAPABILITY_NOT_INCLUDED');
  assert.equal(noCapability.res.body.reason_code, 'ADDON_REQUIRED');

  const engineDisabled = buildFeatureDisabledEngineHealthPayload({
    entitlement: {
      enabled: false,
      reason: 'ADDON_REQUIRED',
      capability_key: 'ai.compliance',
    },
    req: { headers: {}, query: {} },
  });
  assert.equal(engineDisabled.ok, true);
  assert.equal(engineDisabled.status, 'feature_disabled');
  assert.equal(engineDisabled.data.ai_disabled_by_plan, true);

  const skippedEngineGate = await runGate({
    req: {
      path: '/engine-health',
      method: 'GET',
      user: { id: 'user-4', tenant_id: TENANT_A, role: 'viewer' },
    },
    decision: {
      enabled: false,
      decision: 'denied',
      reason_code: 'RBAC_PERMISSION_REQUIRED',
      capability_key: 'ai.compliance',
    },
  });
  assert.equal(skippedEngineGate.res.statusCode, 200);
  assert.equal(skippedEngineGate.calls.next, 1);
  assert.equal(skippedEngineGate.calls.resolveCapability, 0);

  const crossTenant = await runGate({
    req: {
      path: '/suggestions',
      method: 'GET',
      query: { tenant_id: TENANT_B },
      user: { id: 'user-5', tenant_id: TENANT_A, role: 'tenant_admin' },
    },
    decision: {
      enabled: true,
      decision: 'allowed',
      capability_key: 'ai.compliance',
    },
  });
  assert.equal(crossTenant.res.statusCode, 403);
  assert.equal(crossTenant.res.body.code, 'TENANT_FORBIDDEN');
  assert.equal(crossTenant.calls.next, 0);

  console.log('ai-compliance.rbac tests OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
