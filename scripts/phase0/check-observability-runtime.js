#!/usr/bin/env node
const fs = require('fs');

const required = ['API_BASE_URL', 'E2E_TENANT_A_EMAIL', 'E2E_TENANT_A_PASSWORD', 'E2E_TENANT_A_ID', 'E2E_TENANT_B_ID'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Missing required observability environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
const base = process.env.API_BASE_URL.replace(/\/$/, '');

async function probe(name, pathname, options = {}) {
  const started = Date.now();
  const response = await fetch(`${base}${pathname}`, options);
  const text = await response.text();
  return {
    name,
    path: pathname,
    status: response.status,
    duration_ms: Date.now() - started,
    request_id: response.headers.get('x-request-id'),
    content_type: response.headers.get('content-type'),
    body_sample: text.slice(0, 4000),
  };
}

(async () => {
  const login = await probe('login', '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': `phase0-${Date.now()}` },
    body: JSON.stringify({ email: process.env.E2E_TENANT_A_EMAIL, password: process.env.E2E_TENANT_A_PASSWORD }),
  });
  const loginBody = JSON.parse(login.body_sample);
  const token = loginBody.token || loginBody.accessToken || loginBody.data?.token || loginBody.data?.accessToken;
  if (login.status !== 200 || !token) throw new Error(`Observability login failed with HTTP ${login.status}`);
  const probes = [
    await probe('live', '/live'),
    await probe('health', '/health'),
    await probe('ready', '/ready'),
    await probe('metrics', '/metrics'),
    await probe('instrumented-error', '/api/phase0-not-found', { headers: { Authorization: `Bearer ${token}` } }),
    await probe('tenant-denial', `/api/tenant-standards/${process.env.E2E_TENANT_B_ID}`, { headers: { Authorization: `Bearer ${token}` } }),
  ];
  const validations = [
    { name: 'correlation-header', passed: probes.every(item => Boolean(item.request_id)) },
    { name: 'live-200', passed: probes.find(item => item.name === 'live')?.status === 200 },
    { name: 'health-200', passed: probes.find(item => item.name === 'health')?.status === 200 },
    { name: 'ready-bounded', passed: [200, 503].includes(probes.find(item => item.name === 'ready')?.status) && probes.find(item => item.name === 'ready').duration_ms < 3000 },
    { name: 'metrics-prometheus', passed: probes.find(item => item.name === 'metrics')?.status === 200 && probes.find(item => item.name === 'metrics').body_sample.includes('tcdx_http_requests_total') },
    { name: 'error-instrumented', passed: [401, 403, 404].includes(probes.find(item => item.name === 'instrumented-error')?.status) },
    { name: 'tenant-denial', passed: [403, 404].includes(probes.find(item => item.name === 'tenant-denial')?.status) },
  ];
  const artifact = {
    checkedAt: new Date().toISOString(),
    passed: validations.filter(item => item.passed).length,
    failed: validations.filter(item => !item.passed).length,
    validations,
    probes: probes.map(({ body_sample, ...item }) => item),
    logValidationCommand: 'sudo journalctl -u tecdex-backend.service -n 500 --no-pager | grep HTTP_REQUEST | tail -50',
  };
  fs.mkdirSync('artifacts/fase-0', { recursive: true });
  fs.writeFileSync('artifacts/fase-0/observability-runtime.json', JSON.stringify(artifact, null, 2) + '\n');
  if (artifact.failed) throw new Error(`Observability runtime failed ${artifact.failed} validation(s)`);
  console.log(`phase0 observability VERIFIED checks=${artifact.passed}`);
})().catch(error => {
  console.error(String(error?.message || error));
  process.exit(1);
});
