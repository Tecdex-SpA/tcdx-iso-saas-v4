#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  isAreaOwnerRole,
  isAuditorRole,
  isDealerRole,
  isExecutiveRole,
  isPlatformRole,
  isTenantAdminRole,
  isViewerRole,
  resolveRoleCompatibility,
  roleMatchesAny,
} = require('../../backend/src/services/auth/roleCompatibility.service');

const families = {
  platform: {
    marker: 'ROLE_ALIAS_PLATFORM_EQUIVALENCE',
    canonical: 'platform_admin',
    aliases: ['platform_admin', 'super_admin', 'global_admin', 'admin_global', 'superadmin', 'owner'],
    predicate: isPlatformRole,
  },
  tenant_admin: {
    marker: 'ROLE_ALIAS_TENANT_ADMIN_EQUIVALENCE',
    canonical: 'tenant_admin',
    aliases: ['tenant_admin', 'admin', 'admin_cumplimiento', 'compliance_admin', 'compliance_manager'],
    predicate: isTenantAdminRole,
  },
  area_owner: {
    marker: 'ROLE_ALIAS_AREA_OWNER_EQUIVALENCE',
    canonical: 'area_owner',
    aliases: ['area_owner', 'operativo', 'responsable_area', 'control_owner'],
    predicate: isAreaOwnerRole,
  },
  executive: {
    marker: 'ROLE_ALIAS_EXECUTIVE_EQUIVALENCE',
    canonical: 'executive',
    aliases: ['executive', 'ejecutivo'],
    predicate: isExecutiveRole,
  },
  viewer: {
    marker: 'ROLE_ALIAS_VIEWER_EQUIVALENCE',
    canonical: 'viewer',
    aliases: ['viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura'],
    predicate: isViewerRole,
  },
  auditor: {
    marker: 'ROLE_AUDITOR_CANONICAL',
    canonical: 'auditor',
    aliases: ['auditor'],
    predicate: isAuditorRole,
  },
  dealer: {
    marker: 'ROLE_DEALER_CANONICAL',
    canonical: 'dealer',
    aliases: ['dealer'],
    predicate: isDealerRole,
  },
};

const predicates = [
  isPlatformRole,
  isTenantAdminRole,
  isAreaOwnerRole,
  isExecutiveRole,
  isViewerRole,
  isAuditorRole,
  isDealerRole,
];

for (const family of Object.values(families)) {
  for (const alias of family.aliases) {
    const resolved = resolveRoleCompatibility(alias);
    assert.equal(resolved.canonical_role, family.canonical, `${alias} must resolve to ${family.canonical}`);
    assert.equal(family.predicate(alias), true, `${alias} must satisfy its family predicate`);
    assert.equal(roleMatchesAny(alias, [family.canonical]), true, `${alias} must satisfy canonical role match`);
  }
  console.log(`${family.marker}=PASS`);
}

for (const family of Object.values(families)) {
  for (const alias of family.aliases) {
    const matches = predicates.filter((predicate) => predicate(alias));
    assert.equal(matches.length, 1, `${alias} must belong to exactly one role family`);
  }
}

console.log('ROLE_FAMILY_EXCLUSIVITY=PASS');
