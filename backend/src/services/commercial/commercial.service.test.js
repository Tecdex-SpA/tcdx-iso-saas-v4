const assert = require('assert');
const path = require('path');

const tenantId = '70000000-0000-0000-0000-000000000701';
const userId = '70000000-0000-0000-0000-000000000799';
const planVersionId = '70000000-0000-0000-0000-000000000901';
const subscriptionId = '70000000-0000-0000-0000-000000000902';
const nextSubscriptionId = '70000000-0000-0000-0000-000000000903';

const state = {
  badSqlReferences: [],
  tenant: { id: tenantId, name: 'Tenant Comercial QA', service_status: 'active' },
  subscription: { id: subscriptionId, tenant_id: tenantId, plan_key: 'empresa', status: 'active', metadata: {} },
  events: [],
  insertedSubscriptions: 0,
};

function rows(rows) {
  return { rows, rowCount: rows.length };
}

function assertProductionTenantSchemaSql(sql) {
  const compact = String(sql).replace(/\s+/g, ' ').trim();
  if (/SELECT id, name, status, service_status FROM tenants/i.test(compact) || /\btenants\.status\b/i.test(compact) || /\bt\.status\b/i.test(compact)) {
    state.badSqlReferences.push(compact);
    const error = new Error('column t.status does not exist');
    error.code = '42703';
    throw error;
  }
}

async function query(sql, params = []) {
  assertProductionTenantSchemaSql(sql);
  const text = String(sql).replace(/\s+/g, ' ').trim();

  if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return rows([]);
  if (/SELECT \* FROM product_families ORDER BY family_key/i.test(text)) return rows([{ family_key: 'iso_saas', display_name: 'ISO SaaS' }]);
  if (/SELECT \* FROM commercial_editions ORDER BY edition_key/i.test(text)) return rows([{ edition_key: 'empresa', display_name: 'Empresa' }]);
  if (/SELECT \* FROM commercial_plans ORDER BY plan_key/i.test(text)) return rows([{ plan_key: 'enterprise', display_name: 'Enterprise', status: 'active' }]);
  if (/SELECT \* FROM commercial_plan_versions ORDER BY plan_key, version_number/i.test(text)) return rows([{ id: planVersionId, plan_key: 'enterprise', version_number: 2, status: 'published' }]);
  if (/SELECT \* FROM commercial_modules ORDER BY sort_order, module_key/i.test(text)) return rows([{ module_key: 'tprm', display_name: 'TPRM', status: 'active' }]);
  if (/SELECT \* FROM commercial_addons ORDER BY addon_key/i.test(text)) return rows([]);
  if (/SELECT \* FROM commercial_features ORDER BY feature_key/i.test(text)) return rows([{ feature_key: 'suppliers', display_name: 'Proveedores' }]);
  if (/SELECT \* FROM commercial_technical_capabilities ORDER BY capability_key/i.test(text)) return rows([{ capability_key: 'tprm.suppliers', display_name: 'Proveedores', status: 'active' }]);
  if (/SELECT \* FROM usage_limit_definitions ORDER BY resource_key/i.test(text)) return rows([{ resource_key: 'active_users', default_limit: 50 }]);
  if (/SELECT \* FROM pack_definitions ORDER BY pack_key/i.test(text)) return rows([{ pack_key: 'implementation_quickstart', display_name: 'Implementación inicial', status: 'published' }]);
  if (/SELECT \* FROM risk_methodology_versions ORDER BY methodology_key, version_number/i.test(text)) return rows([]);
  if (/SELECT \* FROM audit_workpaper_template_versions ORDER BY template_key, version_number/i.test(text)) return rows([]);
  if (/SELECT id, name, service_status FROM tenants WHERE id = \$1::uuid LIMIT 1/i.test(text)) return rows([state.tenant]);
  if (/SELECT \* FROM v_commercial_tenant_subscription WHERE tenant_id = \$1::uuid LIMIT 1/i.test(text)) return rows([state.subscription]);
  if (/SELECT \* FROM v_commercial_tenant_modules WHERE tenant_id = \$1::uuid/i.test(text)) return rows([{ tenant_id: tenantId, module_key: 'tprm', display_name: 'TPRM', sort_order: 10 }]);
  if (/SELECT \* FROM v_commercial_tenant_capabilities WHERE tenant_id = \$1::uuid/i.test(text)) return rows([
    { tenant_id: tenantId, capability_key: 'tprm.suppliers', enabled: true, source: 'plan', module_key: 'tprm', required_permission: null, read_only: false, dependencies: [] },
  ]);
  if (/SELECT \* FROM tenant_usage_limits WHERE tenant_id = \$1::uuid AND status = 'active'/i.test(text)) return rows([
    { tenant_id: tenantId, resource_key: 'active_users', limit_value: 25, warning_threshold: 0.8, enforcement: 'block' },
  ]);
  if (/SELECT DISTINCT ON \(resource_key\) resource_key, quantity/i.test(text)) return rows([{ resource_key: 'active_users', quantity: 3 }]);
  if (/SELECT capability_key, enabled, read_only, reason, valid_until FROM tenant_feature_overrides/i.test(text)) return rows([]);
  if (/SELECT capability_key, trial_key, ends_at FROM trials/i.test(text)) return rows([]);
  if (/SELECT \* FROM v_commercial_tenant_health WHERE tenant_id = \$1::uuid LIMIT 1/i.test(text)) return rows([{ health: { status: 'healthy', score: 96, factors: [], recommended_actions: [] } }]);
  if (/SELECT p\.permission_key, user_has_permission/i.test(text)) return rows([{ permission_key: 'commercial.subscription.manage', allowed: true }]);
  if (/SELECT \* FROM commercial_events WHERE tenant_id = \$1::uuid ORDER BY created_at DESC LIMIT 100/i.test(text)) return rows(state.events);
  if (/SELECT \* FROM trials WHERE tenant_id = \$1::uuid ORDER BY created_at DESC/i.test(text)) return rows([]);
  if (/SELECT \* FROM tenant_pack_installations WHERE tenant_id = \$1::uuid ORDER BY installed_at DESC/i.test(text)) return rows([]);
  if (/SELECT \* FROM v_commercial_plan_capabilities WHERE plan_key = \$1 ORDER BY capability_key/i.test(text)) return rows([
    { plan_key: params[0], module_key: 'tprm', capability_key: 'tprm.suppliers' },
    { plan_key: params[0], module_key: 'commercial', capability_key: 'commercial.subscription.manage' },
  ]);
  if (/SELECT resource_key, default_limit FROM usage_limit_definitions ORDER BY resource_key/i.test(text)) return rows([
    { resource_key: 'active_users', default_limit: 50 },
    { resource_key: 'imports_monthly', default_limit: 25 },
  ]);
  if (/SELECT details FROM commercial_events WHERE tenant_id = \$1::uuid AND request_id = \$2 AND event_type = \$3 LIMIT 1/i.test(text)) {
    const found = state.events.find((event) => event.tenant_id === params[0] && event.request_id === params[1] && event.event_type === params[2]);
    return found ? rows([{ details: found.details }]) : rows([]);
  }
  if (/SELECT \* FROM commercial_plan_versions WHERE plan_key = \$1 AND status = 'published'/i.test(text)) return rows([{ id: planVersionId, plan_key: params[0], status: 'published', version_number: 2 }]);
  if (/SELECT \* FROM tenant_subscriptions WHERE tenant_id = \$1::uuid AND status IN/i.test(text)) return rows([state.subscription]);
  if (/UPDATE tenant_subscriptions SET status = 'replaced'/i.test(text)) {
    state.subscription = { ...state.subscription, status: 'replaced' };
    return rows([]);
  }
  if (/INSERT INTO tenant_subscriptions/i.test(text)) {
    state.insertedSubscriptions += 1;
    state.subscription = { id: nextSubscriptionId, tenant_id: params[0], plan_version_id: params[1], plan_key: params[2], status: 'active', metadata: JSON.parse(params[5] || '{}') };
    return rows([state.subscription]);
  }
  if (/INSERT INTO commercial_events/i.test(text)) {
    const afterState = JSON.parse(params[6] || 'null');
    state.events.push({
      tenant_id: params[0],
      actor_user_id: params[1],
      event_type: params[2],
      entity_type: params[3],
      entity_id: params[4],
      before_state: JSON.parse(params[5] || 'null'),
      after_state: afterState,
      details: { preview: afterState?.metadata?.change_preview || null },
      reason: params[7],
      request_id: params[8],
    });
    return rows([]);
  }

  throw new Error(`Unhandled commercial test query: ${text}`);
}

const fakePool = {
  query,
  async connect() {
    return { query, release() {} };
  },
};

const dbPath = require.resolve('../../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const {
  validateMethodologyDefinition,
  CommercialError,
  assertTenantExists,
  getTenantCommercialState,
  previewPlanChange,
  changePlan,
} = require('./commercialAdmin.service');
const { normalizeKey, resolveTenantEntitlements } = require('./entitlementResolver.service');
const express = require('express');
const commercialRouter = require('../../routes/admin-saas-commercial.routes');

async function withTestServer(callback) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'phase4-commercial-schema-regression';
    req.user = { id: userId, role: 'platform_admin', tenant_id: tenantId };
    next();
  });
  app.use('/api/admin-saas', commercialRouter);
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => {
      const address = instance.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Commercial test server did not bind to a TCP port'));
        return;
      }
      resolve(instance);
    });
    instance.on('error', reject);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Commercial test server address unavailable');
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      if (!server.listening) return resolve();
      return server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  assert.strictEqual(response.status, 200, `${options.method || 'GET'} ${path} expected 200: ${JSON.stringify(payload)}`);
  assert.strictEqual(payload.ok, true, `${options.method || 'GET'} ${path} returned ok=false`);
  return payload.data;
}

async function run() {
  assert.strictEqual(normalizeKey(' TPRM Suppliers '), 'tprm_suppliers');
  assert.doesNotThrow(() => validateMethodologyDefinition({ scoring: { steps: [{ operator: 'multiply' }, { operator: 'threshold' }] } }));
  assert.throws(
    () => validateMethodologyDefinition({ scoring: { steps: [{ operator: 'eval' }] } }),
    (error) => error instanceof CommercialError && error.code === 'METHODOLOGY_OPERATOR_NOT_ALLOWED'
  );

  await assert.doesNotReject(() => assertTenantExists(fakePool, tenantId));
  const stateResult = await getTenantCommercialState(tenantId);
  assert.strictEqual(stateResult.tenant.service_status, 'active');
  assert.strictEqual(stateResult.subscription.plan_key, 'empresa');
  assert.ok(stateResult.capabilities['tprm.suppliers']);
  assert.ok(stateResult.limits.active_users);
  assert.strictEqual(stateResult.health.status, 'healthy');

  const entitlements = await resolveTenantEntitlements({ tenantId, user: { id: userId, tenant_id: tenantId } });
  assert.strictEqual(entitlements.subscription.plan_key, 'empresa');
  assert.ok(entitlements.capabilities['tprm.suppliers'].enabled);
  assert.ok(entitlements.limits.active_users);
  assert.strictEqual(entitlements.health.status, 'healthy');

  const preview = await previewPlanChange({ tenantId, body: { target_plan_key: 'enterprise' } });
  assert.strictEqual(preview.target_plan_key, 'enterprise');

  const firstChange = await changePlan({
    tenantId,
    body: { target_plan_key: 'enterprise', idempotency_key: 'phase4-idempotency-regression' },
    user: { id: userId },
    requestId: 'phase4-idempotency-regression',
  });
  assert.strictEqual(firstChange.replayed, false);
  assert.strictEqual(firstChange.subscription.plan_key, 'enterprise');
  assert.strictEqual(state.insertedSubscriptions, 1);
  assert.strictEqual(state.events.length, 1);

  const secondChange = await changePlan({
    tenantId,
    body: { target_plan_key: 'enterprise', idempotency_key: 'phase4-idempotency-regression' },
    user: { id: userId },
    requestId: 'phase4-idempotency-regression',
  });
  assert.strictEqual(secondChange.replayed, true);
  assert.strictEqual(state.insertedSubscriptions, 1);
  assert.strictEqual(state.events.length, 1);

  await withTestServer(async (baseUrl) => {
    const catalog = await requestJson(baseUrl, '/api/admin-saas/catalog');
    assert.ok(Array.isArray(catalog.plans));

    const endpointEntitlements = await requestJson(baseUrl, `/api/admin-saas/tenants/${tenantId}/entitlements`);
    assert.strictEqual(endpointEntitlements.subscription.plan_key, 'enterprise');
    assert.ok(endpointEntitlements.capabilities['tprm.suppliers']);
    assert.ok(endpointEntitlements.limits.active_users);
    assert.strictEqual(endpointEntitlements.health.status, 'healthy');

    const endpointPreview = await requestJson(baseUrl, `/api/admin-saas/tenants/${tenantId}/change-preview`, {
      method: 'POST',
      body: JSON.stringify({ target_plan_key: 'enterprise' }),
    });
    assert.strictEqual(endpointPreview.target_plan_key, 'enterprise');

    const beforeEndpointEvents = state.events.length;
    const endpointChange = await requestJson(baseUrl, `/api/admin-saas/tenants/${tenantId}/change-plan`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'phase4-endpoint-idempotency' },
      body: JSON.stringify({ target_plan_key: 'enterprise', idempotency_key: 'phase4-endpoint-idempotency' }),
    });
    assert.strictEqual(endpointChange.replayed, false);
    assert.strictEqual(state.subscription.plan_key, 'enterprise');
    assert.strictEqual(state.events.length, beforeEndpointEvents + 1);

    const endpointReplay = await requestJson(baseUrl, `/api/admin-saas/tenants/${tenantId}/change-plan`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'phase4-endpoint-idempotency' },
      body: JSON.stringify({ target_plan_key: 'enterprise', idempotency_key: 'phase4-endpoint-idempotency' }),
    });
    assert.strictEqual(endpointReplay.replayed, true);
    assert.strictEqual(state.events.length, beforeEndpointEvents + 1);
  });

  assert.deepStrictEqual(state.badSqlReferences, []);

  process.stdout.write('commercial.service.test: OK\n');
}

run().catch((error) => {
  if (error?.code === '42703') process.stderr.write('Unexpected PostgreSQL 42703 regression in commercial service test\n');
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
