'use strict';

const assert = require('assert');
const {
  createPublicAuthRateLimiter,
  prometheusLines,
  resetForTests,
  DEFAULT_ACCOUNT_MAX,
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

function loginRequest({
  email = 'admin.demo@tcdx.local',
  ip = '10.0.0.1',
  method = 'POST',
  path = '/login',
  forwardedFor,
} = {}) {
  return {
    method,
    path,
    ip,
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    body: { email },
  };
}

resetForTests();
const accountLimiter = createPublicAuthRateLimiter({ max: 2, ipMax: 10, windowMs: 60000 });

const first = invoke(accountLimiter, loginRequest({ email: 'Admin.Demo@TCDX.Local' }));
assert.strictEqual(first.nextCalled, true);
assert.strictEqual(first.res.statusCode, 200);
assert.strictEqual(first.res.headers.get('x-ratelimit-policy'), 'public_auth_login');

const second = invoke(accountLimiter, loginRequest());
assert.strictEqual(second.nextCalled, true);

const blocked = invoke(accountLimiter, loginRequest());
assert.strictEqual(blocked.nextCalled, false);
assert.strictEqual(blocked.res.statusCode, 429);
assert.strictEqual(blocked.res.body.code, 'RATE_LIMITED');
assert.strictEqual(blocked.res.body.policy, 'public_auth_login');
assert.ok(Number(blocked.res.headers.get('retry-after')) >= 1);
assert.strictEqual(blocked.res.headers.get('x-ratelimit-remaining'), '0');

const otherUser = invoke(accountLimiter, loginRequest({ email: 'auditor.demo@tcdx.local' }));
assert.strictEqual(otherUser.nextCalled, true);

const otherIp = invoke(accountLimiter, loginRequest({ ip: '10.0.0.2' }));
assert.strictEqual(otherIp.nextCalled, true);

const nonLogin = invoke(accountLimiter, loginRequest({ path: '/forgot-password' }));
assert.strictEqual(nonLogin.nextCalled, true);

const loginGet = invoke(accountLimiter, loginRequest({ method: 'GET' }));
assert.strictEqual(loginGet.nextCalled, true);

resetForTests();
const ipLimiter = createPublicAuthRateLimiter({ max: 2, ipMax: 3, windowMs: 60000 });

for (let index = 0; index < 3; index += 1) {
  const result = invoke(
    ipLimiter,
    loginRequest({ email: `user-${index}@tcdx.local`, forwardedFor: '203.0.113.10, 10.0.0.10' })
  );
  assert.strictEqual(result.nextCalled, true);
}

const ipBlocked = invoke(
  ipLimiter,
  loginRequest({ email: 'user-4@tcdx.local', forwardedFor: '203.0.113.10, 10.0.0.10' })
);
assert.strictEqual(ipBlocked.nextCalled, false);
assert.strictEqual(ipBlocked.res.statusCode, 429);
assert.ok(Number(ipBlocked.res.headers.get('retry-after')) >= 1);
assert.strictEqual(ipBlocked.res.headers.get('x-ratelimit-limit'), '3');

resetForTests();
const defaultLimiter = createPublicAuthRateLimiter();
for (let index = 0; index < DEFAULT_ACCOUNT_MAX; index += 1) {
  const result = invoke(defaultLimiter, loginRequest());
  assert.strictEqual(result.nextCalled, true);
}
const defaultBlocked = invoke(defaultLimiter, loginRequest());
assert.strictEqual(defaultBlocked.nextCalled, false);
assert.strictEqual(defaultBlocked.res.statusCode, 429);
assert.strictEqual(defaultBlocked.res.headers.get('x-ratelimit-limit'), String(DEFAULT_ACCOUNT_MAX));

const metrics = prometheusLines().join('\n');
assert.match(metrics, /tcdx_public_auth_rate_limit_allowed_total/);
assert.match(metrics, /tcdx_public_auth_rate_limit_blocked_total/);

console.log('publicRateLimit.middleware tests: OK');
