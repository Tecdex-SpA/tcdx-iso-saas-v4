'use strict';

const assert = require('assert');
const {
  authenticatedRateLimit,
  classifyPolicy,
  resetForTests,
  DEFAULT_POLICIES,
} = require('./authenticatedRateLimit.middleware');

function createResponse() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: null,
    locals: {},
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function invoke(req) {
  const res = createResponse();
  let nextCalled = false;

  authenticatedRateLimit(req, res, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

function buildRequest(overrides = {}) {
  return {
    method: 'GET',
    originalUrl: '/api/dashboard',
    requestId: 'req-test',
    user: {
      id: 'user-a',
      tenant_id: 'tenant-a',
    },
    ...overrides,
  };
}

function run() {
  resetForTests();

  assert.strictEqual(
    classifyPolicy(buildRequest()).name,
    'authenticated_read'
  );
  assert.strictEqual(
    classifyPolicy(buildRequest({ method: 'POST' })).name,
    'authenticated_write'
  );
  assert.strictEqual(
    classifyPolicy(buildRequest({ originalUrl: '/api/ai/answer' })).name,
    'authenticated_ai'
  );
  assert.strictEqual(
    classifyPolicy(buildRequest({ originalUrl: '/api/reports/export' })).name,
    'authenticated_report'
  );

  const first = invoke(buildRequest());
  assert.strictEqual(first.nextCalled, true);
  assert.strictEqual(first.res.statusCode, 200);
  assert.strictEqual(
    first.res.headers.get('x-ratelimit-policy'),
    'authenticated_read'
  );
  assert.strictEqual(
    first.res.headers.get('x-ratelimit-limit'),
    String(DEFAULT_POLICIES.read.max)
  );

  resetForTests();

  for (let i = 0; i < DEFAULT_POLICIES.ai.max; i += 1) {
    const result = invoke(buildRequest({ originalUrl: '/api/ai/answer' }));
    assert.strictEqual(result.nextCalled, true);
  }

  const blocked = invoke(buildRequest({ originalUrl: '/api/ai/answer' }));
  assert.strictEqual(blocked.nextCalled, false);
  assert.strictEqual(blocked.res.statusCode, 429);
  assert.strictEqual(blocked.res.body.code, 'RATE_LIMITED');
  assert.strictEqual(blocked.res.body.policy, 'authenticated_ai');
  assert.ok(Number(blocked.res.headers.get('retry-after')) >= 1);

  resetForTests();

  for (let i = 0; i < DEFAULT_POLICIES.report.max; i += 1) {
    invoke(buildRequest({ originalUrl: '/api/reports/export' }));
  }

  const otherTenant = invoke(buildRequest({
    originalUrl: '/api/reports/export',
    user: {
      id: 'user-a',
      tenant_id: 'tenant-b',
    },
  }));

  assert.strictEqual(otherTenant.nextCalled, true);
  assert.strictEqual(otherTenant.res.statusCode, 200);

  const otherUser = invoke(buildRequest({
    originalUrl: '/api/reports/export',
    user: {
      id: 'user-b',
      tenant_id: 'tenant-a',
    },
  }));

  assert.strictEqual(otherUser.nextCalled, true);
  assert.strictEqual(otherUser.res.statusCode, 200);

  console.log('authenticatedRateLimit.middleware.test.js OK');
}

run();
