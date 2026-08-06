import assert from 'node:assert/strict';
import {
  clearAccessBootstrapCache,
  fetchAccessBootstrap,
} from '../../src/utils/accessBootstrap.ts';

const originalFetch = globalThis.fetch;
let requests = 0;

globalThis.fetch = async (url, options) => {
  requests += 1;
  await new Promise((resolve) => setTimeout(resolve, 20));
  return new Response(JSON.stringify({
    ok: true,
    request_url: String(url),
    authorization: options?.headers?.Authorization,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const request = (token) => fetchAccessBootstrap({
  token,
  url: '/api/me/modules',
  fallbackError: 'modules failed',
  invalidResponseError: (status) => `invalid ${status}`,
});

try {
  clearAccessBootstrapCache();
  const [layout, sidebar] = await Promise.all([request('tenant-a-session'), request('tenant-a-session')]);
  assert.deepEqual(layout, sidebar);
  assert.equal(requests, 1, 'concurrent consumers must share one request');

  await request('tenant-a-session');
  assert.equal(requests, 1, 'same authenticated session must reuse the resolved bootstrap');

  await request('tenant-b-session');
  assert.equal(requests, 2, 'a different tenant/session token must not reuse tenant A data');

  clearAccessBootstrapCache();
  await request('tenant-b-session');
  assert.equal(requests, 3, 'explicit session invalidation must force a new bootstrap');

  clearAccessBootstrapCache();
  const staleRequest = request('reused-session-token');
  clearAccessBootstrapCache();
  await staleRequest;
  await request('reused-session-token');
  assert.equal(requests, 5, 'a request resolved after logout must not repopulate the next session cache');

  console.log('accessBootstrap tests passed');
} finally {
  clearAccessBootstrapCache();
  globalThis.fetch = originalFetch;
}
