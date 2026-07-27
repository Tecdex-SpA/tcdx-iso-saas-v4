#!/usr/bin/env node
const { Pool } = require('../../backend/node_modules/pg');
const { poolConfig } = require('./cleanup-phase1-qa');
const { readManifest } = require('./phase1-qa-manifest');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function login(baseUrl, label, emailName, passwordName, expectedTenantId) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: required(emailName), password: required(passwordName) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token || !body.user?.id) {
    throw new Error(`${label} authentication failed with HTTP ${response.status}`);
  }
  if (String(body.user.tenant_id || '') !== expectedTenantId) {
    throw new Error(`${label} belongs to an unexpected tenant`);
  }
  return { token: body.token, userId: body.user.id };
}

async function main() {
  const baseUrl = required('API_BASE_URL').replace(/\/$/, '');
  const tenantA = required('E2E_TENANT_A_ID');
  const tenantB = required('E2E_TENANT_B_ID');
  const manifest = readManifest(required('PHASE1_QA_MANIFEST'), tenantA);
  if (manifest.run_id !== required('PHASE1_QA_RUN_ID')) throw new Error('Manifest run does not match PHASE1_QA_RUN_ID');

  const admin = await login(baseUrl, 'admin', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', tenantA);
  const restricted = await login(baseUrl, 'restricted', 'E2E_RESTRICTED_EMAIL', 'E2E_RESTRICTED_PASSWORD', tenantA);
  const reviewer = await login(baseUrl, 'reviewer', 'E2E_REVIEWER_EMAIL', 'E2E_REVIEWER_PASSWORD', tenantA);
  await login(baseUrl, 'tenant B admin', 'E2E_TENANT_B_EMAIL', 'E2E_TENANT_B_PASSWORD', tenantB);

  const metaResponse = await fetch(`${baseUrl}/api/grc/meta`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const meta = await metaResponse.json().catch(() => ({}));
  if (!metaResponse.ok || meta.data?.module?.is_enabled !== true) {
    throw new Error(`GRC module preflight failed with HTTP ${metaResponse.status}`);
  }

  const pool = new Pool(poolConfig());
  try {
    const auditId = required('E2E_AUDIT_ID');
    const evidenceId = required('E2E_EVIDENCE_ID');
    const controlId = required('E2E_CONTROL_ID');
    const fixtureResult = await pool.query(
      `SELECT
        EXISTS (SELECT 1 FROM audits WHERE tenant_id = $1::uuid AND id = $2::uuid) AS audit_exists,
        EXISTS (SELECT 1 FROM evidences WHERE tenant_id = $1::uuid AND id = $3::uuid) AS evidence_exists,
        EXISTS (SELECT 1 FROM tenant_controls WHERE tenant_id = $1::uuid AND id = $4::uuid) AS control_exists`,
      [tenantA, auditId, evidenceId, controlId]
    );
    const fixture = fixtureResult.rows[0];
    const missing = Object.entries(fixture).filter(([, exists]) => !exists).map(([name]) => name.replace('_exists', ''));
    if (missing.length) throw new Error(`Controlled tenant fixtures are missing: ${missing.join(', ')}`);

    const candidateIds = [admin.userId, restricted.userId, reviewer.userId];
    const assigned = await pool.query(
      `SELECT user_id FROM grc_audit_team_members
       WHERE tenant_id = $1::uuid AND audit_id = $2::uuid AND user_id = ANY($3::uuid[])`,
      [tenantA, auditId, candidateIds]
    );
    const assignedIds = new Set(assigned.rows.map(row => String(row.user_id)));
    const availableMembers = candidateIds.filter(id => !assignedIds.has(String(id))).length;
    if (availableMembers < 2) {
      throw new Error(`Audit fixture requires two unassigned controlled users; available=${availableMembers}`);
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      run_id: manifest.run_id,
      accounts: 4,
      fixtures: { audit: true, evidence: true, control: true },
      grc_module: 'enabled',
      available_audit_team_members: availableMembers,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Phase 1 fixture preflight failed: ${error.message}`);
  process.exit(1);
});
