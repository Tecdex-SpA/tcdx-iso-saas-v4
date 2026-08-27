'use strict';

const CANONICAL_ROLES = Object.freeze([
  'platform_admin',
  'tenant_admin',
  'auditor',
  'area_owner',
  'executive',
  'dealer',
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
  viewer: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.DEPRECATED_LEGACY_ROLE, effectiveRole: 'viewer', family: 'executive' },
  cliente: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'cliente', family: 'executive' },
  client: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'client', family: 'executive' },
  read_only: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'read_only', family: 'executive' },
  readonly: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'readonly', family: 'executive' },
  solo_lectura: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'solo_lectura', family: 'executive' },
  ejecutivo: { canonicalRole: 'executive', classification: ROLE_CLASSIFICATION.COMPATIBILITY_MAPPING, effectiveRole: 'ejecutivo', family: 'executive' },
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

  if (resolved.classification === ROLE_CLASSIFICATION.EXACT_ALIAS) {
    return allowed.has(resolved.canonical_role);
  }

  return (
    resolved.classification === ROLE_CLASSIFICATION.CANONICAL_ROLE &&
    allowed.has(resolved.canonical_role)
  );
}

function isPlatformRole(role) {
  return resolveRoleCompatibility(role).family === 'platform';
}

function isDealerRole(role) {
  return resolveRoleCompatibility(role).family === 'dealer';
}

module.exports = {
  CANONICAL_ROLES,
  ROLE_CLASSIFICATION,
  ROLE_COMPATIBILITY,
  isDealerRole,
  isPlatformRole,
  normalizeRoleKey,
  resolveRoleCompatibility,
  roleMatchesAny,
};
