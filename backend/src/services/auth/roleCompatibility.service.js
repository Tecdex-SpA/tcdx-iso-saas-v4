'use strict';

const CANONICAL_ROLES = Object.freeze([
  'platform_admin',
  'tenant_admin',
  'auditor',
  'area_owner',
  'executive',
  'dealer',
  'viewer',
]);

const ROLE_CLASSIFICATION = Object.freeze({
  CANONICAL_ROLE: 'CANONICAL_ROLE',
  EXACT_ALIAS: 'EXACT_ALIAS',
  COMPATIBILITY_MAPPING: 'COMPATIBILITY_MAPPING',
  DEPRECATED_LEGACY_ROLE: 'DEPRECATED_LEGACY_ROLE',
  UNKNOWN_REQUIRES_DECISION: 'UNKNOWN_REQUIRES_DECISION',
});

const ROLE_COMPATIBILITY = Object.freeze({
  platform_admin: { canonicalRole: 'platform_admin', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'platform_admin', family: 'platform' },
  tenant_admin: { canonicalRole: 'tenant_admin', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'tenant_admin', family: 'admin' },
  auditor: { canonicalRole: 'auditor', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'auditor', family: 'auditor' },
  area_owner: { canonicalRole: 'area_owner', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'area_owner', family: 'area_owner' },
  executive: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'executive', family: 'executive' },
  dealer: { canonicalRole: 'dealer', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'dealer', family: 'dealer' },
  viewer: { canonicalRole: 'viewer', classification: ROLE_CLASSIFICATION.CANONICAL_ROLE, effectiveRole: 'viewer', family: 'viewer' },

  super_admin: { canonicalRole: 'platform_admin', classification: ROLE_CLASSIFICATION.EXACT_ALIAS, effectiveRole: 'super_admin', family: 'platform' },
  global_admin: { canonicalRole: 'platform_admin', classification: ROLE_CLASSIFICATION.EXACT_ALIAS, effectiveRole: 'global_admin', family: 'platform' },
  admin_global: { canonicalRole: 'platform_admin', classification: ROLE_CLASSIFICATION.EXACT_ALIAS, effectiveRole: 'admin_global', family: 'platform' },

  superadmin: { canonicalRole: 'platform_admin', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'superadmin', family: 'platform' },
  owner: { canonicalRole: 'platform_admin', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'owner', family: 'platform' },
  admin: { canonicalRole: 'tenant_admin', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'admin', family: 'admin' },
  admin_cumplimiento: { canonicalRole: 'tenant_admin', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'admin_cumplimiento', family: 'admin' },
  compliance_admin: { canonicalRole: 'tenant_admin', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'compliance_admin', family: 'admin' },
  compliance_manager: { canonicalRole: 'tenant_admin', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'compliance_manager', family: 'admin' },
  operativo: { canonicalRole: 'area_owner', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'operativo', family: 'area_owner' },
  responsable_area: { canonicalRole: 'area_owner', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'responsable_area', family: 'area_owner' },
  control_owner: { canonicalRole: 'area_owner', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'control_owner', family: 'area_owner' },
  cliente: { canonicalRole: 'viewer', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'cliente', family: 'viewer' },
  client: { canonicalRole: 'viewer', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'client', family: 'viewer' },
  read_only: { canonicalRole: 'viewer', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'read_only', family: 'viewer' },
  readonly: { canonicalRole: 'viewer', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'readonly', family: 'viewer' },
  solo_lectura: { canonicalRole: 'viewer', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'solo_lectura', family: 'viewer' },
  ejecutivo: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'ejecutivo', family: 'executive' },
});

const PLATFORM_ROLE_KEYS = Object.freeze([
  'platform_admin',
  'super_admin',
  'global_admin',
  'admin_global',
  'superadmin',
  'owner',
]);

const TENANT_ADMIN_ROLE_KEYS = Object.freeze([
  'tenant_admin',
  'admin',
  'admin_cumplimiento',
  'compliance_admin',
  'compliance_manager',
]);

const AREA_OWNER_ROLE_KEYS = Object.freeze([
  'area_owner',
  'operativo',
  'responsable_area',
  'control_owner',
]);

const EXECUTIVE_ROLE_KEYS = Object.freeze([
  'executive',
  'ejecutivo',
]);

const VIEWER_ROLE_KEYS = Object.freeze([
  'viewer',
  'cliente',
  'client',
  'read_only',
  'readonly',
  'solo_lectura',
]);

const AUDITOR_ROLE_KEYS = Object.freeze(['auditor']);
const DEALER_ROLE_KEYS = Object.freeze(['dealer']);

const ROLE_GROUPS = Object.freeze({
  platform: PLATFORM_ROLE_KEYS,
  tenantAdmin: TENANT_ADMIN_ROLE_KEYS,
  auditor: AUDITOR_ROLE_KEYS,
  areaOwner: AREA_OWNER_ROLE_KEYS,
  executive: EXECUTIVE_ROLE_KEYS,
  viewer: VIEWER_ROLE_KEYS,
  dealer: DEALER_ROLE_KEYS,
});

function normalizeRoleKey(role) {
  return String(role || '').toLowerCase().trim();
}

function resolveRoleCompatibility(role) {
  const normalizedRole = normalizeRoleKey(role);
  const match = ROLE_COMPATIBILITY[normalizedRole];

  if (!match) {
    return {
      raw_role: role || null,
      normalized_role: normalizedRole,
      canonical_role: null,
      effective_role: normalizedRole || null,
      classification: ROLE_CLASSIFICATION.UNKNOWN_REQUIRES_DECISION,
      family: 'unknown',
      privilege_preservation: 'NO_ALIAS_APPLIED',
    };
  }

  return {
    raw_role: role || null,
    normalized_role: normalizedRole,
    canonical_role: match.canonicalRole,
    effective_role: match.effectiveRole,
    classification: match.classification,
    family: match.family,
    privilege_preservation: match.effectiveRole === match.canonicalRole ? 'DIRECT' : 'PRESERVE_LEGACY_EFFECTIVE_ROLE',
  };
}

function roleMatchesAny(role, allowedRoles = []) {
  const resolved = resolveRoleCompatibility(role);
  const allowed = new Set((allowedRoles || []).map(normalizeRoleKey).filter(Boolean));
  if (allowed.size === 0) return false;

  if (allowed.has(resolved.normalized_role) || allowed.has(resolved.effective_role)) {
    return true;
  }

  return Boolean(resolved.canonical_role && allowed.has(resolved.canonical_role));
}

function isPlatformRole(role) {
  return resolveRoleCompatibility(role).family === 'platform';
}

function isDealerRole(role) {
  return resolveRoleCompatibility(role).family === 'dealer';
}

function isTenantAdminRole(role) {
  return resolveRoleCompatibility(role).family === 'admin';
}

function isAuditorRole(role) {
  return resolveRoleCompatibility(role).family === 'auditor';
}

function isAreaOwnerRole(role) {
  return resolveRoleCompatibility(role).family === 'area_owner';
}

function isExecutiveRole(role) {
  return resolveRoleCompatibility(role).family === 'executive';
}

function isViewerRole(role) {
  return resolveRoleCompatibility(role).family === 'viewer';
}

function roleOfUser(user = {}) {
  return (
    user?.role ||
    user?.user_role ||
    user?.userRole ||
    ''
  );
}

function isPlatformUser(user = {}) {
  return isPlatformRole(roleOfUser(user));
}

function isDealerUser(user = {}) {
  return isDealerRole(roleOfUser(user));
}

function isTenantAdminUser(user = {}) {
  return isTenantAdminRole(roleOfUser(user));
}

function isAuditorUser(user = {}) {
  return isAuditorRole(roleOfUser(user));
}

function isAreaOwnerUser(user = {}) {
  return isAreaOwnerRole(roleOfUser(user));
}

function isExecutiveUser(user = {}) {
  return isExecutiveRole(roleOfUser(user));
}

function isViewerUser(user = {}) {
  return isViewerRole(roleOfUser(user));
}

module.exports = {
  CANONICAL_ROLES,
  ROLE_GROUPS,
  ROLE_CLASSIFICATION,
  ROLE_COMPATIBILITY,
  isAreaOwnerRole,
  isAreaOwnerUser,
  isAuditorRole,
  isAuditorUser,
  isDealerUser,
  isDealerRole,
  isExecutiveRole,
  isExecutiveUser,
  isPlatformUser,
  isPlatformRole,
  isTenantAdminRole,
  isTenantAdminUser,
  isViewerRole,
  isViewerUser,
  normalizeRoleKey,
  roleOfUser,
  resolveRoleCompatibility,
  roleMatchesAny,
};
