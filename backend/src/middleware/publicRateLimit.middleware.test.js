'use strict';

const assert = require('assert');
const {
  createPublicAuthRateLimiter,
  prometheusLines,
  resetForTests,
} = require('./publicRateLimit.middleware');

function createResponse() {
  const headers = new Map();
  return {
    headers,
    locals: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
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

function invoke(limiter, req) {
  const res = createResponse();
  let nextCalled = false;
  limiter(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

resetForTests();
const limiter = createPublicAuthRateLimiter({ max: 2, windowMs: 60000 });

const first = invoke(limiter, {
  path: '/login',
  ip: '10.0.0.1',
  headers: {},
  body: { email: 'Admin.Demo@TCDX.Local' },
});
assert.strictEqual(first.nextCalled, true);
assert.strictEqual(first.res.statusCode, 200);
assert.strictEqual(first.res.headers.get('x-ratelimit-policy'), 'public_auth_login');

const second = invoke(limiter, {
  path: '/login',
  ip: '10.0.0.1',
  headers: {},
  body: { email: 'admin.demo@tcdx.local' },
});
assert.strictEqual(second.nextCalled, true);

const blocked = invoke(limiter, {
  path: '/login',
  ip: '10.0.0.1',
  headers: {},
  body: { email: 'admin.demo@tcdx.local' },
});
assert.strictEqual(blocked.nextCalled, false);
assert.strictEqual(blocked.res.statusCode, 429);
assert.strictEqual(blocked.res.body.code, 'RATE_LIMITED');
assert.ok(Number(blocked.res.headers.get('retry-after')) >= 1);

const otherUser = invoke(limiter, {
  path: '/login',
  ip: '10.0.0.1',
  headers: {},
  body: { email: 'auditor.demo@tcdx.local' },
});
assert.strictEqual(otherUser.nextCalled, true);

const nonLogin = invoke(limiter, {
  path: '/forgot-password',
  ip: '10.0.0.1',
  headers: {},
  body: { email: 'admin.demo@tcdx.local' },
});
assert.strictEqual(nonLogin.nextCalled, true);

const metrics = prometheusLines().join('\n');
assert.match(metrics, /tcdx_public_auth_rate_limit_allowed_total/);
assert.match(metrics, /tcdx_public_auth_rate_limit_blocked_total/);

console.log('publicRateLimit.middleware tests: OK');
