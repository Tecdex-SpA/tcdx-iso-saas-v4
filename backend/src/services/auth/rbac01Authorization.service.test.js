'use strict';

const assert = require('assert');
const { _private: rbacMiddleware } = require('../../middleware/rbac.middleware');
const {
  ROLE_CLASSIFICATION,
  resolveRoleCompatibility,
  roleMatchesAny,
} = require('./roleCompatibility.service');
const { evaluateEffectiveAuthorization } = require('./rbac01Authorization.service');

function expectAllowed(name, decision) {
  assert.strictEqual(decision.allowed, true, `${name} expected ALLOW, got ${decision.reason_code}`);
}

function expectDenied(name, decision, reasonCode) {
  assert.strictEqual(decision.allowed, false, `${name} expected DENY`);
  if (reasonCode) assert.strictEqual(decision.reason_code, reasonCode, `${name} reason mismatch`);
}

function allow({ role, permissions, permission, entitlement = true, module = true, scope = true, mode = 'read', readOnly = false }) {
  return evaluateEffectiveAuthorization({
    role,
    userPermissions: permissions,
    requiredPermission: permission,
    commercialEntitled: entitlement,
    moduleActive: module,
    resourceScopeAllowed: scope,
    mode,
    readOnly,
  });
}

const tenantAdminPermissions = [
  'framework.read',
  'risk_matrix.view',
  'risk_matrix.manage',
  'controls.manage',
  'continuity.read',
  'evidences.view',
  'dashboards.read',
  'reports.read',
  'users.manage',
];
const executiveReadPermissions = [
  'dashboards.read',
  'reports.read',
  'reports.download',
  'metrics.read',
  'data.catalog.read',
  'risk_matrix.view',
  'controls.view',
  'evidences.view',
];
const areaOwnerPermissions = [
  'risk_matrix.view',
  'risk_matrix.manage',
  'controls.view',
  'evidences.upload',
  'actions.manage',
];
const auditorPermissions = [
  'dashboards.read',
  'audit.execute',
  'audit.review',
  'evidence.review',
  'reports.read',
];
const dealerPermissions = [
  'dealer.clients.view',
  'reports.view',
  'tenants.view',
];

function run() {
  expectAllowed('A ISO management', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'framework.read' }));
  expectAllowed('A ISO risk', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'risk_matrix.view' }));
  expectAllowed('A ISO risk matrix', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'risk_matrix.manage' }));
  expectDenied('A advanced operational risk without entitlement', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'risk_matrix.view', entitlement: false }), 'CAPABILITY_NOT_ENTITLED');
  expectDenied('A BIA without entitlement', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'continuity.read', entitlement: false }), 'CAPABILITY_NOT_ENTITLED');

  expectAllowed('B GRC executive read', allow({ role: 'executive', permissions: executiveReadPermissions, permission: 'dashboards.read' }));
  expectDenied('B GRC executive mutation', allow({ role: 'executive', permissions: executiveReadPermissions, permission: 'reports.generate', mode: 'write' }), 'RBAC_PERMISSION_REQUIRED');

  expectAllowed('C area_owner in-scope operation', allow({ role: 'area_owner', permissions: areaOwnerPermissions, permission: 'evidences.upload', scope: true, mode: 'write' }));
  expectDenied('C area_owner tenant administration', allow({ role: 'area_owner', permissions: areaOwnerPermissions, permission: 'users.manage', mode: 'write' }), 'RBAC_PERMISSION_REQUIRED');

  expectAllowed('D auditor dashboard', allow({ role: 'auditor', permissions: auditorPermissions, permission: 'dashboards.read' }));
  expectAllowed('D auditor audit operations', allow({ role: 'auditor', permissions: auditorPermissions, permission: 'audit.review', mode: 'write' }));
  expectDenied('D auditor tenant administration', allow({ role: 'auditor', permissions: auditorPermissions, permission: 'users.manage', mode: 'write' }), 'RBAC_PERMISSION_REQUIRED');

  expectAllowed('E GRC tenant_admin active capability', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'controls.manage', entitlement: true, module: true, mode: 'write' }));

  expectAllowed('F dealer assigned tenant', allow({ role: 'dealer', permissions: dealerPermissions, permission: 'dealer.clients.view', scope: true }));
  expectDenied('F dealer unassigned tenant', allow({ role: 'dealer', permissions: dealerPermissions, permission: 'dealer.clients.view', scope: false }), 'RESOURCE_SCOPE_DENIED');

  expectDenied('G permission yes entitlement no', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'reports.read', entitlement: false }), 'CAPABILITY_NOT_ENTITLED');
  expectDenied('H permission no entitlement yes', allow({ role: 'tenant_admin', permissions: [], permission: 'reports.read', entitlement: true }), 'RBAC_PERMISSION_REQUIRED');
  expectDenied('I permission yes entitlement yes module inactive', allow({ role: 'tenant_admin', permissions: tenantAdminPermissions, permission: 'reports.read', entitlement: true, module: false }), 'MODULE_NOT_ACTIVE');

  const admin = resolveRoleCompatibility('admin');
  assert.strictEqual(admin.canonical_role, 'tenant_admin');
  assert.strictEqual(admin.effective_role, 'admin');
  assert.strictEqual(admin.classification, ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE);
  expectDenied('J admin legacy does not inherit tenant_admin-only permission', allow({ role: 'admin', permissions: ['tenant.manage'], permission: 'users.assign_roles', mode: 'write' }), 'RBAC_PERMISSION_REQUIRED');

  const superadmin = resolveRoleCompatibility('superadmin');
  assert.strictEqual(superadmin.canonical_role, 'platform_admin');
  assert.strictEqual(superadmin.effective_role, 'superadmin');
  assert.strictEqual(superadmin.classification, ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE);
  expectDenied('J platform_admin does not inherit superadmin-only permission', allow({ role: 'platform_admin', permissions: ['users.manage'], permission: 'settings.manage', mode: 'write' }), 'RBAC_PERMISSION_REQUIRED');

  const operativo = resolveRoleCompatibility('operativo');
  assert.strictEqual(operativo.canonical_role, 'area_owner');
  assert.strictEqual(operativo.effective_role, 'operativo');
  assert.strictEqual(operativo.classification, ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE);

  assert.strictEqual(
    roleMatchesAny('admin', ['tenant_admin']),
    false,
    'admin must not satisfy tenant_admin-only role gates by canonical family'
  );
  assert.strictEqual(
    roleMatchesAny('superadmin', ['platform_admin']),
    false,
    'superadmin must not satisfy platform_admin-only role gates by canonical family'
  );
  assert.strictEqual(
    roleMatchesAny('compliance_manager', ['tenant_admin']),
    false,
    'compliance_manager must not inherit tenant_admin role gates by canonical family'
  );
  assert.strictEqual(
    roleMatchesAny('super_admin', ['platform_admin']),
    true,
    'exact aliases may satisfy their canonical role gate'
  );

  const dashboardRule = rbacMiddleware.findRule('GET', '/api/dashboard');
  assert.ok(dashboardRule, 'dashboard rule must exist');
  assert.ok(dashboardRule.read.includes('auditor'), 'auditor must be included in dashboard role gate');

  process.stdout.write('RBAC01_AUTHORIZATION_CONTRACT_PASS\n');
}

run();
