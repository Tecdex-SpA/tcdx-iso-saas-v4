'use strict';

const assert = require('node:assert/strict');

const {
  applyModuleGate,
  requiredPermissionForCapability,
  ensureBaseTenantCapabilities,
} = require('./entitlementResolver.service');

function baseDecision(capabilityKey, overrides = {}) {
  return {
    capability_key: capabilityKey,
    enabled: true,
    decision: 'allowed',
    source: 'test',
    reason_code: 'ENTITLED',
    module_key: null,
    required_permission: null,
    rbac_allowed: true,
    ...overrides,
  };
}

const dashboard = applyModuleGate(
  baseDecision('core.dashboard', { module_key: 'core' }),
  {}
);
assert.equal(dashboard.enabled, true);
assert.equal(dashboard.module_active, true);
assert.equal(dashboard.module_active_source, 'rbac02_core_dashboard_base_capability');

const unknownCoreCapability = applyModuleGate(
  baseDecision('core.unknown', { module_key: 'core' }),
  {}
);
assert.equal(unknownCoreCapability.enabled, false);
assert.equal(unknownCoreCapability.reason_code, 'MODULE_NOT_ACTIVE');

const missingRiskModule = applyModuleGate(
  baseDecision('risk.operational', { module_key: 'risk' }),
  {}
);
assert.equal(missingRiskModule.enabled, false);
assert.equal(missingRiskModule.reason_code, 'MODULE_NOT_ACTIVE');

assert.equal(
  requiredPermissionForCapability('core.dashboard', 'commercial.entitlement.read'),
  'dashboards.read'
);
assert.equal(
  requiredPermissionForCapability('risk.quantitative', 'commercial.entitlement.read'),
  'commercial.entitlement.read'
);

const capabilities = {};
ensureBaseTenantCapabilities(capabilities, {
  tenantId: '70000000-0000-0000-0000-000000000701',
  tenant: { service_status: 'active' },
  subscription: { status: 'active' },
  moduleState: {},
  permissions: { 'dashboards.read': true },
});
assert.equal(capabilities['core.dashboard'].enabled, true);
assert.equal(capabilities['core.dashboard'].source, 'rbac02_base_capability');
assert.equal(capabilities['core.dashboard'].required_permission, 'dashboards.read');
assert.equal(capabilities['core.dashboard'].rbac_allowed, true);

const suspendedCapabilities = {};
ensureBaseTenantCapabilities(suspendedCapabilities, {
  tenantId: '70000000-0000-0000-0000-000000000702',
  tenant: { service_status: 'active' },
  subscription: { status: 'suspended' },
  moduleState: {},
  permissions: { 'dashboards.read': true },
});
assert.equal(suspendedCapabilities['core.dashboard'], undefined);

const suspendedTenantCapabilities = {};
ensureBaseTenantCapabilities(suspendedTenantCapabilities, {
  tenantId: '70000000-0000-0000-0000-000000000704',
  tenant: { service_status: 'suspended' },
  subscription: { status: 'active' },
  moduleState: {},
  permissions: { 'dashboards.read': true },
});
assert.equal(suspendedTenantCapabilities['core.dashboard'], undefined);

const explicitlyDenied = {
  'core.dashboard': baseDecision('core.dashboard', {
    enabled: false,
    decision: 'denied',
    reason_code: 'CAPABILITY_DISABLED',
    module_key: 'core',
  }),
};
ensureBaseTenantCapabilities(explicitlyDenied, {
  tenantId: '70000000-0000-0000-0000-000000000703',
  tenant: { service_status: 'active' },
  subscription: { status: 'active' },
  moduleState: {},
  permissions: { 'dashboards.read': true },
});
assert.equal(explicitlyDenied['core.dashboard'].enabled, false);
assert.equal(explicitlyDenied['core.dashboard'].reason_code, 'CAPABILITY_DISABLED');

process.stdout.write('RBAC02_COMMERCIAL_GATING_CONTRACT_PASS\n');
