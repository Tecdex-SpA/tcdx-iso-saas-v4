#!/usr/bin/env node
const { resolveRuntimeToken } = require('./phase1-runtime-auth');

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
  if (required('PHASE1_QA_ENV', environment).toLowerCase() !== 'qa') {
    throw new Error('PHASE1_QA_ENV must equal qa');
  }
  if (required('PHASE1_QA_CONFIRM', environment) !== 'PREPARE_PHASE1_QA') {
    throw new Error('PHASE1_QA_CONFIRM must equal PREPARE_PHASE1_QA');
  }
  const apiBaseUrl = required('API_BASE_URL', environment).replace(/\/$/, '');
  const tenantId = required('PHASE1_TENANT_ID', environment);
  const tenantToken = await resolveToken('PHASE1_API_TOKEN', apiBaseUrl);
  const statusResponse = await fetchImpl(`${apiBaseUrl}/api/grc/meta`, {
    headers: { Authorization: `Bearer ${tenantToken}` },
  });
  const statusBody = await statusResponse.json().catch(() => ({}));
  if (!statusResponse.ok || statusBody.ok === false) {
    throw new Error(statusBody.error || `Module status check failed with HTTP ${statusResponse.status}`);
  }
  if (statusBody.data?.module?.is_enabled === true) {
    return {
      ok: true,
      status: 'ALREADY_ENABLED',
      tenant_id: tenantId,
      module_key: 'grc_phase1_core',
    };
  }

  const platformToken = String(environment.PHASE1_PLATFORM_TOKEN || '').trim();
  if (!platformToken) {
    throw new Error('PHASE1_PLATFORM_TOKEN is required only when grc_phase1_core must be enabled');
  }
  const response = await fetchImpl(
    `${apiBaseUrl}/api/admin-saas/tenants/${encodeURIComponent(tenantId)}/modules/grc_phase1_core`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${platformToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_enabled: true,
        notes: 'Phase 1 Runtime QA controlled activation',
        metadata: { source: 'phase1_runtime_qa' },
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Module activation failed with HTTP ${response.status}`);
  }
  if (
    body.data?.tenant_id !== tenantId
    || body.data?.module_key !== 'grc_phase1_core'
    || body.data?.is_enabled !== true
  ) {
    throw new Error('Module activation response does not match the requested tenant and module');
  }
  return {
    ok: true,
    status: 'ENABLED',
    tenant_id: tenantId,
    module_key: 'grc_phase1_core',
  };
}

if (require.main === module) {
  prepareRuntimeQa()
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error => {
      console.error(`Phase 1 runtime QA preparation failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { prepareRuntimeQa };
