const fs = require('fs');

const required = [
  'API_BASE_URL',
  'E2E_TENANT_A_EMAIL',
  'E2E_TENANT_A_PASSWORD',
  'E2E_TENANT_A_ID',
  'E2E_TENANT_B_EMAIL',
  'E2E_TENANT_B_PASSWORD',
  'E2E_TENANT_B_ID',
];

function assertEnvironment(extra = []) {
  const missing = [...required, ...extra].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

async function login(base, email, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
  if (response.status !== 200 || !token) throw new Error(`Login failed with HTTP ${response.status}`);
  return token;
}

async function call(base, token, test) {
  const response = await fetch(`${base}${test.path}`, {
    method: test.method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(test.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: test.body ? JSON.stringify(test.body) : undefined,
  });
  return { status: response.status, requestId: response.headers.get('x-request-id') };
}

function casesFor(mode, ownId, otherId, direction) {
  const syntheticId = '00000000-0000-0000-0000-000000000001';
  if (mode === 'tenant') {
    return [
      { name: `${direction}:read`, path: `/api/tenant-standards/${otherId}` },
      { name: `${direction}:list`, path: `/api/action-plans?tenant_id=${otherId}&page=1&limit=10` },
      { name: `${direction}:write`, method: 'POST', path: '/api/action-plans', body: { tenant_id: otherId, title: 'PHASE0_SYNTHETIC_DENIAL', owner_id: syntheticId } },
      { name: `${direction}:edit`, method: 'PUT', path: `/api/action-plans/${syntheticId}`, body: { tenant_id: otherId, title: 'PHASE0_SYNTHETIC_DENIAL' } },
      { name: `${direction}:delete`, method: 'DELETE', path: `/api/action-plans/${syntheticId}?tenant_id=${otherId}` },
      { name: `${direction}:relation`, path: `/api/tenant-process-links?tenant_id=${otherId}&page=1&limit=10` },
    ];
  }
  if (mode === 'search') return [{ name: `${direction}:search`, path: `/api/search?q=PHASE0_SYNTHETIC&tenant_id=${otherId}` }];
  if (mode === 'export') return [{ name: `${direction}:export`, path: `/api/reports/exports?tenant_id=${otherId}&page=1&limit=10` }];
  if (mode === 'ai') return [{ name: `${direction}:ai`, path: `/api/ai-compliance/health-summary?tenant_id=${otherId}` }];
  if (mode === 'file') {
    const key = direction === 'a-to-b' ? 'E2E_TENANT_B_FILE_PATH' : 'E2E_TENANT_A_FILE_PATH';
    assertEnvironment([key]);
    return [{ name: `${direction}:file`, path: process.env[key] }];
  }
  if (mode === 'job') {
    const key = direction === 'a-to-b' ? 'E2E_TENANT_B_JOB_PATH' : 'E2E_TENANT_A_JOB_PATH';
    assertEnvironment([key]);
    return [{ name: `${direction}:job`, path: process.env[key] }];
  }
  throw new Error(`Unsupported isolation mode: ${mode}`);
}

async function run(mode, options = {}) {
  assertEnvironment();
  const base = process.env.API_BASE_URL.replace(/\/$/, '');
  const tokenA = await login(base, process.env.E2E_TENANT_A_EMAIL, process.env.E2E_TENANT_A_PASSWORD);
  const tokenB = await login(base, process.env.E2E_TENANT_B_EMAIL, process.env.E2E_TENANT_B_PASSWORD);
  const tests = [
    ...casesFor(mode, process.env.E2E_TENANT_A_ID, process.env.E2E_TENANT_B_ID, 'a-to-b').map(test => ({ ...test, token: tokenA })),
    ...casesFor(mode, process.env.E2E_TENANT_B_ID, process.env.E2E_TENANT_A_ID, 'b-to-a').map(test => ({ ...test, token: tokenB })),
  ];
  const results = [];
  for (const test of tests) {
    const response = await call(base, test.token, test);
    const passed = [403, 404].includes(response.status);
    results.push({ name: test.name, method: test.method || 'GET', path: test.path, expected: [403, 404], ...response, passed });
  }
  const artifact = {
    checkedAt: new Date().toISOString(),
    mode,
    passed: results.filter(item => item.passed).length,
    failed: results.filter(item => !item.passed).length,
    results,
  };
  if (options.write !== false) {
    fs.mkdirSync('artifacts/fase-0', { recursive: true });
    fs.writeFileSync(`artifacts/fase-0/cross-tenant-${mode}.json`, JSON.stringify(artifact, null, 2) + '\n');
  }
  if (artifact.failed) throw new Error(`Cross-tenant ${mode} failed ${artifact.failed} case(s)`);
  return artifact;
}

module.exports = { run };
