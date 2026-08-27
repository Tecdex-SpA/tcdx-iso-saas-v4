'use strict';

const { resolveRoleCompatibility } = require('./roleCompatibility.service');

function normalizePermission(permission) {
  return String(permission || '').trim();
}

function hasPermission(userPermissions = [], requiredPermission) {
  const required = normalizePermission(requiredPermission);
  if (!required) return true;
  const granted = new Set((userPermissions || []).map(normalizePermission).filter(Boolean));
  return granted.has(required);
}

function evaluateEffectiveAuthorization({
  role,
  userPermissions = [],
  requiredPermission = null,
  commercialEntitled = true,
  moduleActive = true,
  resourceScopeAllowed = true,
  mode = 'read',
  readOnly = false,
} = {}) {
  const roleModel = resolveRoleCompatibility(role);

  if (!roleModel.canonical_role) {
    return { allowed: false, reason_code: 'UNKNOWN_ROLE', role_model: roleModel };
  }
  if (!hasPermission(userPermissions, requiredPermission)) {
    return { allowed: false, reason_code: 'RBAC_PERMISSION_REQUIRED', role_model: roleModel };
  }
  if (commercialEntitled !== true) {
    return { allowed: false, reason_code: 'CAPABILITY_NOT_ENTITLED', role_model: roleModel };
  }
  if (moduleActive !== true) {
    return { allowed: false, reason_code: 'MODULE_NOT_ACTIVE', role_model: roleModel };
  }
  if (resourceScopeAllowed !== true) {
    return { allowed: false, reason_code: 'RESOURCE_SCOPE_DENIED', role_model: roleModel };
  }
  if (mode !== 'read' && readOnly === true) {
    return { allowed: false, reason_code: 'DOWNGRADE_READ_ONLY', role_model: roleModel };
  }

  return { allowed: true, reason_code: 'ALLOWED', role_model: roleModel };
}

module.exports = {
  evaluateEffectiveAuthorization,
  hasPermission,
};
