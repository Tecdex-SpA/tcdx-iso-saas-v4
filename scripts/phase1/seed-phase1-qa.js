#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function guard() {
  if (!['qa', 'test', 'local'].includes(required('PHASE1_QA_ENV').toLowerCase())) {
    throw new Error('PHASE1_QA_ENV must be qa, test or local');
  }
  if (required('PHASE1_QA_CONFIRM') !== 'PREPARE_PHASE1_QA') {
    throw new Error('PHASE1_QA_CONFIRM must equal PREPARE_PHASE1_QA');
  }
}

async function main() {
  guard();
  const tenantId = required('PHASE1_TENANT_ID');
  const apiBaseUrl = required('PHASE1_API_BASE_URL').replace(/\/$/, '');
  const token = required('PHASE1_API_TOKEN');
  const runId = String(process.env.PHASE1_QA_RUN_ID || crypto.randomUUID()).replace(/[^a-zA-Z0-9-]/g, '');
  const prefix = `PHASE1R_QA_${runId}`;
  const output = path.resolve(process.env.PHASE1_QA_MANIFEST || 'artifacts/fase-1/phase1-qa-manifest.json');
  if (fs.existsSync(output)) {
    const existing = JSON.parse(fs.readFileSync(output, 'utf8'));
    if (existing.tenant_id !== tenantId || existing.prefix !== prefix) {
      throw new Error('Existing QA manifest belongs to a different tenant or run');
    }
    process.stdout.write(`${JSON.stringify({ ok: true, manifest: output, prefix, reused: true }, null, 2)}\n`);
    return;
  }
  async function post(route, data) {
    const response = await fetch(`${apiBaseUrl}${route}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok || body.ok === false) throw new Error(body.error || `${route} failed with HTTP ${response.status}`);
    return body.data;
  }
  const workflow = await post('/api/grc/workflows', {
    code: prefix.toLowerCase(),
    name: `${prefix} workflow`,
    entity_type: 'evidence',
    states: [
      { code: 'draft', name: 'Borrador', state_type: 'initial' },
      { code: 'approved', name: 'Aprobado', state_type: 'terminal' },
    ],
    transitions: [
      {
        code: 'approve',
        name: 'Aprobar',
        from_state: 'draft',
        to_state: 'approved',
        required_permission: 'workflow.transition',
        roles: ['tenant_admin', 'admin'],
      },
    ],
  });
  const evidence = await post('/api/grc/evidence/requests', {
    title: `${prefix} evidence request`,
    instructions: 'Synthetic QA record; safe to remove by manifest.',
    status: 'requested',
  });
  const manifest = {
    tenant_id: tenantId,
    run_id: runId,
    prefix,
    created_at: new Date().toISOString(),
    workflow_definition_ids: [workflow.definition.id],
    evidence_request_ids: [evidence.id],
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ ok: true, manifest: output, prefix }, null, 2)}\n`);
}

main().catch(error => {
  console.error(`Phase 1 QA seed failed: ${error.message}`);
  process.exit(1);
});
