#!/usr/bin/env node
const assert = require('assert/strict');
const { prepareRuntimeQa } = require('./prepare-phase1-runtime-qa');

const baseEnvironment = Object.freeze({
  PHASE1_QA_ENV: 'qa',
  PHASE1_QA_CONFIRM: 'PREPARE_PHASE1_QA',
  API_BASE_URL: 'https://qa.example',
  PHASE1_TENANT_ID: '70000000-0000-0000-0000-000000000701',
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

async function run() {
  const tokenRequests = [];
  const alreadyEnabled = await prepareRuntimeQa({
    environment: baseEnvironment,
    resolveToken: async (name) => {
      tokenRequests.push(name);
      return 'tenant-token';
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://qa.example/api/grc/meta');
      assert.equal(options.headers.Authorization, 'Bearer tenant-token');
      return jsonResponse(200, { ok: true, data: { module: { is_enabled: true } } });
    },
  });
  assert.equal(alreadyEnabled.status, 'ALREADY_ENABLED');
  assert.deepEqual(tokenRequests, ['PHASE1_API_TOKEN']);

  await assert.rejects(
    () => prepareRuntimeQa({
      environment: baseEnvironment,
      resolveToken: async () => 'tenant-token',
      fetchImpl: async () => jsonResponse(200, {
        ok: true,
        data: { module: { is_enabled: false } },
      }),
    }),
    /PHASE1_PLATFORM_TOKEN is required only when grc_phase1_core must be enabled/,
  );

  const calls = [];
  const enabled = await prepareRuntimeQa({
    environment: { ...baseEnvironment, PHASE1_PLATFORM_TOKEN: 'platform-token' },
    resolveToken: async () => 'tenant-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/api/grc/meta')) {
        return jsonResponse(200, { ok: true, data: { module: { is_enabled: false } } });
      }
      return jsonResponse(200, {
        ok: true,
        data: {
          tenant_id: baseEnvironment.PHASE1_TENANT_ID,
          module_key: 'grc_phase1_core',
          is_enabled: true,
        },
      });
    },
  });
  assert.equal(enabled.status, 'ENABLED');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer platform-token');
  assert.equal(calls[1].options.method, 'PUT');
  process.stdout.write('Phase 1 runtime preparation tests: OK scenarios=3\n');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
