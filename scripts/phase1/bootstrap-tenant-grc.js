#!/usr/bin/env node
const crypto = require('crypto');
const { resolveRuntimeToken } = require('./phase1-runtime-auth');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertQaGuard() {
  const environment = required('PHASE1_QA_ENV').toLowerCase();
  if (!['qa', 'test', 'local'].includes(environment)) {
    throw new Error('PHASE1_QA_ENV must be qa, test or local');
  }
  if (required('PHASE1_QA_CONFIRM') !== 'PREPARE_PHASE1_QA') {
    throw new Error('PHASE1_QA_CONFIRM must equal PREPARE_PHASE1_QA');
  }
}

async function main() {
  assertQaGuard();
  const tenantId = required('PHASE1_TENANT_ID');
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('PHASE1_TENANT_ID must be a UUID');
  const apiBaseUrl = required('PHASE1_API_BASE_URL').replace(/\/$/, '');
  const token = await resolveRuntimeToken('PHASE1_API_TOKEN', apiBaseUrl);
  const response = await fetch(`${apiBaseUrl}/api/grc/bootstrap`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': process.env.PHASE1_IDEMPOTENCY_KEY || `phase1-qa-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ confirmation: 'INITIALIZE_GRC' }),
  });
  const body = await response.json();
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Bootstrap failed with HTTP ${response.status}`);
  }
  if (body.data?.tenant_id !== tenantId) throw new Error('Bootstrap tenant mismatch');
  process.stdout.write(`${JSON.stringify(body.data, null, 2)}\n`);
}

main().catch(error => {
  console.error(`Phase 1 bootstrap failed: ${error.message}`);
  process.exit(1);
});
