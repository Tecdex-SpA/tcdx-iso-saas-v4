#!/usr/bin/env node

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  if (required('PHASE1_QA_ENV').toLowerCase() !== 'qa') {
    throw new Error('PHASE1_QA_ENV must equal qa');
  }
  if (required('PHASE1_QA_CONFIRM') !== 'PREPARE_PHASE1_QA') {
    throw new Error('PHASE1_QA_CONFIRM must equal PREPARE_PHASE1_QA');
  }
  const apiBaseUrl = required('API_BASE_URL').replace(/\/$/, '');
  const tenantId = required('PHASE1_TENANT_ID');
  const token = required('PHASE1_PLATFORM_TOKEN');
  const response = await fetch(
    `${apiBaseUrl}/api/admin-saas/tenants/${encodeURIComponent(tenantId)}/modules/grc_phase1_core`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_enabled: true,
        notes: 'Phase 1 Runtime QA controlled activation',
        metadata: { source: 'phase1_runtime_qa' },
      }),
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Module activation failed with HTTP ${response.status}`);
  }
  if (body.data?.tenant_id !== tenantId || body.data?.module_key !== 'grc_phase1_core' || body.data?.is_enabled !== true) {
    throw new Error('Module activation response does not match the requested tenant and module');
  }
  process.stdout.write(`${JSON.stringify({ ok: true, tenant_id: tenantId, module_key: 'grc_phase1_core' })}\n`);
}

main().catch(error => {
  console.error(`Phase 1 runtime QA preparation failed: ${error.message}`);
  process.exit(1);
});
