#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const routes = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-visual-routes.json'), 'utf8'));
const tenantId = '76c44a0e-6041-8bda-99c7-b740fccea001';
const apiBase = String(process.env.DEMO_API_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DEMO_ADMIN_PASSWORD || Buffer.from('RGVtby4xMjM0NTY=', 'base64').toString('utf8'));
const crypto = require('crypto');

function fail(message) { throw new Error(message); }
function sanitize(value) { return String(value).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-url]').slice(0, 1200); }
function arrays(value, output = []) {
  if (Array.isArray(value)) { output.push(value); for (const item of value) arrays(item, output); }
  else if (value && typeof value === 'object') for (const child of Object.values(value)) arrays(child, output);
  return output;
}
function objects(value, output = []) {
  if (value && typeof value === 'object') { if (!Array.isArray(value)) output.push(value); for (const child of Object.values(value)) objects(child, output); }
  return output;
}
function demoUuid(key) {
  const hash = crypto.createHash('md5').update(`demo-tecdex:${key}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}
function resolveEndpoint(endpoint) { return endpoint.replace(/:tenant/g, tenantId).replace(/:metric1/g, demoUuid('metric-1')); }

async function login(email) {
  const response = await fetch(`${apiBase}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({}));
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
  if (!response.ok || !token) fail(`Login failed for ${email}: HTTP ${response.status}`);
  return token;
}

function validatePayload(item, payload) {
  const data = payload?.data ?? payload;
  const foundArrays = arrays(data).sort((a, b) => b.length - a.length);
  const records = foundArrays[0] || [];
  const positiveNumbers = objects(data).flatMap((record) => Object.values(record)).filter((value) => typeof value === 'number' && value > 0);
  if (records.length < item.minimum && positiveNumbers.length === 0) fail(`${item.endpoint} has no observable data (minimum=${item.minimum})`);
  const allObjects = objects(data);
  for (const object of allObjects) {
    for (const [key, value] of Object.entries(object)) {
      if ((key === 'tenant_id' || key === 'tenantId') && value && value !== tenantId) fail(`${item.endpoint} leaked tenant ${value}`);
      if (/percent|percentage|_pct$/i.test(key) && typeof value === 'number' && (value < 0 || value > 100)) fail(`${item.endpoint} invalid percentage ${key}=${value}`);
      if (/(_at|_date|date)$/.test(key) && value && typeof value === 'string' && Number.isNaN(Date.parse(value))) fail(`${item.endpoint} invalid date ${key}`);
    }
  }
  if (records.length && records.some((row) => row && typeof row === 'object') && !records.some((row) => row.id || row.run_id || row.audit_id || row.tenant_control_id || row.code)) {
    fail(`${item.endpoint} rows have no navigable identifier`);
  }
  if (item.diversityKey && records.length >= 4) {
    const values = new Set(records.map((row) => row?.[item.diversityKey]).filter((value) => value !== null && value !== undefined));
    if (values.size < 2) fail(`${item.endpoint} lacks diversity for ${item.diversityKey}`);
  }
  if (item.seriesMinimum) {
    const candidate = foundArrays.find((list) => list.length >= item.seriesMinimum) || [];
    if (candidate.length < item.seriesMinimum) fail(`${item.endpoint} has fewer than ${item.seriesMinimum} series points`);
  }
  return Math.max(records.length, positiveNumbers.length ? 1 : 0);
}

async function probe(token, item) {
  const endpoint = resolveEndpoint(item.endpoint);
  const response = await fetch(`${apiBase}${endpoint}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 200) fail(`${endpoint} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return validatePayload(item, body);
}

async function main() {
  if (!apiBase) fail('DEMO_API_BASE_URL is required');
  if (/prod|production/i.test(apiBase)) fail('Use a controlled QA environment, not production');
  const evidence = [];
  for (const email of ['admin.demo@tcdx.demo', 'auditor.demo@tcdx.demo']) {
    const token = await login(email);
    for (const item of routes) {
      const observed = await probe(token, item);
      evidence.push({ route: item.route, user: email, endpoint: resolveEndpoint(item.endpoint), expected: item.minimum, observed, result: 'PASS' });
    }
  }
  const output = path.resolve(process.env.DEMO_API_EVIDENCE_FILE || path.join(root, 'artifacts/demo/demo-visual-api-evidence.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({ tenantId, generatedAt: new Date().toISOString(), evidence }, null, 2)}\n`);
  process.stdout.write(JSON.stringify({ status: 'VERIFIED_DEMO_VISUAL_API', users: 2, endpoints: routes.length, checks: evidence.length, evidence: path.relative(root, output) }) + '\n');
}

main().catch((error) => { process.stderr.write(`${sanitize(error.message)}\n`); process.exit(1); });
