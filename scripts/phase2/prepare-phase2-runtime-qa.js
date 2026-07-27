#!/usr/bin/env node
const { resolveRuntimeToken } = require('../phase1/phase1-runtime-auth');

function required(name, environment = process.env) {
  const value = String(environment[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function prepareRuntimeQa({
  environment = process.env,
  fetchImpl = fetch,
  resolveToken = resolveRuntimeToken,
} = {}) {
  if (required('PHASE2_QA_ENV', environment).toLowerCase() !== 'qa') throw new Error('PHASE2_QA_ENV must equal qa');
  if (required('PHASE2_QA_CONFIRM', environment) !== 'PREPARE_PHASE2_QA') {
    throw new Error('PHASE2_QA_CONFIRM must equal PREPARE_PHASE2_QA');
  }
  const apiBaseUrl = required('API_BASE_URL', environment).replace(/\/$/, '');
  const tenantId = required('PHASE2_TENANT_ID', environment);
  const tenantToken = await resolveToken('PHASE2_API_TOKEN', apiBaseUrl);
  const status = await fetchImpl(`${apiBaseUrl}/api/grc/phase2/meta`, {
    headers: { Authorization: `Bearer ${tenantToken}` },
  });
  const statusBody = await status.json().catch(() => ({}));
  if (status.ok && statusBody.data?.module?.is_enabled === true) {
    return { ok: true, status: 'ALREADY_ENABLED', tenant_id: tenantId, module_key: 'grc_phase2_integrated' };
  }
  const platformToken = String(environment.PHASE2_PLATFORM_TOKEN || '').trim();
  if (!platformToken) throw new Error('PHASE2_PLATFORM_TOKEN is required only when grc_phase2_integrated must be enabled');
  const response = await fetchImpl(
    `${apiBaseUrl}/api/admin-saas/tenants/${encodeURIComponent(tenantId)}/modules/grc_phase2_integrated`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${platformToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_enabled: true,
        notes: 'Phase 2 runtime QA controlled activation',
        metadata: { source: 'phase2_runtime_qa' },
      }),
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || `Module activation failed with HTTP ${response.status}`);
  if (body.data?.tenant_id !== tenantId || body.data?.module_key !== 'grc_phase2_integrated' || body.data?.is_enabled !== true) {
    throw new Error('Module activation response does not match requested tenant and module');
  }
  return { ok: true, status: 'ENABLED', tenant_id: tenantId, module_key: 'grc_phase2_integrated' };
}

if (require.main === module) {
  prepareRuntimeQa()
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error => {
      console.error(`Phase 2 runtime QA preparation failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { prepareRuntimeQa };
