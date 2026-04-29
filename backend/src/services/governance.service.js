const pool = require('../config/db');

function getUserIdFromAuth(user) {
  return user?.user_id || user?.userId || user?.userID || user?.id || null;
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function getUserRole(user) {
  return String(
    user?.role ||
      user?.user_role ||
      user?.userRole ||
      user?.profile ||
      ''
  ).toLowerCase();
}

function isSuperAdminRole(role) {
  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner',
  ].includes(String(role || '').toLowerCase());
}

async function getDbUser(authUser) {
  const userId = getUserIdFromAuth(authUser);
  const email = authUser?.email || null;

  if (userId) {
    const result = await pool.query(
      `
      SELECT
        id,
        email,
        full_name,
        role,
        tenant_id,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rowCount > 0) {
      return result.rows[0];
    }
  }

  if (email) {
    const result = await pool.query(
      `
      SELECT
        id,
        email,
        full_name,
        role,
        tenant_id,
        created_at
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rowCount > 0) {
      return result.rows[0];
    }
  }

  return {
    id: userId,
    email: authUser?.email || null,
    full_name: authUser?.full_name || authUser?.name || null,
    role: getUserRole(authUser),
    tenant_id: getUserTenantId(authUser),
    created_at: null,
  };
}

async function getRole(roleKey) {
  if (!roleKey) return null;

  const result = await pool.query(
    `
    SELECT
      role_key,
      display_name,
      description,
      role_level,
      is_system,
      is_active
    FROM app_roles
    WHERE role_key = $1
    LIMIT 1
    `,
    [roleKey]
  );

  return result.rows[0] || null;
}

async function getPermissions(userId) {
  if (!userId) return [];

  const result = await pool.query(
    `
    SELECT
      permission_key,
      permission_group,
      display_name
    FROM get_user_effective_permissions($1::uuid)
    ORDER BY permission_group, permission_key
    `,
    [userId]
  );

  return result.rows;
}

async function getTenant(tenantId) {
  if (!tenantId) return null;

  const result = await pool.query(
    `
    SELECT *
    FROM tenants
    WHERE id = $1
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0] || null;
}

async function getTenantContract(tenantId) {
  if (!tenantId) return null;

  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      plan_key,
      contract_status,
      started_at,
      ends_at,
      billing_notes,
      commercial_owner_user_id,
      metadata,
      created_at,
      updated_at
    FROM tenant_contracts
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0] || null;
}

async function getTenantModules(tenantId) {
  if (!tenantId) return [];

  const result = await pool.query(
    `
    SELECT
      tenant_id,
      tenant_name,
      module_key,
      module_name,
      module_description,
      sort_order,
      is_enabled,
      enabled_at,
      disabled_at,
      notes,
      metadata
    FROM v_tenant_modules
    WHERE tenant_id = $1
    ORDER BY sort_order, module_key
    `,
    [tenantId]
  );

  return result.rows;
}

async function getTenantStandards(tenantId) {
  if (!tenantId) return [];

  const result = await pool.query(
    `
    SELECT
      ts.tenant_id,
      ts.standard_code AS code,
      COALESCE(s.name, ts.standard_code) AS name,
      ts.is_active
    FROM tenant_standards ts
    LEFT JOIN standards s
      ON s.code = ts.standard_code
    WHERE ts.tenant_id = $1
    ORDER BY ts.is_active DESC, ts.standard_code
    `,
    [tenantId]
  );

  return result.rows;
}

async function getDealerTenants(userId) {
  if (!userId) return [];

  const result = await pool.query(
    `
    SELECT
      id,
      dealer_user_id,
      dealer_name,
      dealer_email,
      tenant_id,
      tenant_name,
      relationship_type,
      can_view_health,
      can_view_contract,
      can_request_changes,
      can_view_sensitive_evidence,
      status,
      assigned_at,
      revoked_at
    FROM v_dealer_tenants
    WHERE dealer_user_id = $1
      AND status = 'active'
    ORDER BY tenant_name
    `,
    [userId]
  );

  return result.rows;
}

async function getTenantGovernanceSummary(tenantId) {
  if (!tenantId) return null;

  const result = await pool.query(
    `
    SELECT *
    FROM v_tenant_governance_summary
    WHERE tenant_id = $1
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0] || null;
}

function buildPermissionMap(permissions) {
  return permissions.reduce((acc, permission) => {
    acc[permission.permission_key] = true;
    return acc;
  }, {});
}

function buildModuleMap(modules) {
  return modules.reduce((acc, module) => {
    acc[module.module_key] = module.is_enabled === true;
    return acc;
  }, {});
}

function buildStandardMap(standards) {
  return standards.reduce((acc, standard) => {
    acc[standard.code] = standard.is_active === true;
    return acc;
  }, {});
}

async function buildGovernanceContext(authUser) {
  const user = await getDbUser(authUser);
  const roleKey = getUserRole(user);
  const tenantId = getUserTenantId(user);
  const userId = getUserIdFromAuth(user);

  const [
    role,
    permissions,
    tenant,
    contract,
    modules,
    standards,
    dealerTenants,
    tenantSummary,
  ] = await Promise.all([
    getRole(roleKey),
    getPermissions(userId),
    getTenant(tenantId),
    getTenantContract(tenantId),
    getTenantModules(tenantId),
    getTenantStandards(tenantId),
    getDealerTenants(userId),
    getTenantGovernanceSummary(tenantId),
  ]);

  const permissionMap = buildPermissionMap(permissions);
  const moduleMap = buildModuleMap(modules);
  const standardMap = buildStandardMap(standards);

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      tenant_id: user.tenant_id,
      created_at: user.created_at,
    },
    role: role || {
      role_key: roleKey,
      display_name: roleKey || 'Sin rol',
      description: 'Rol no registrado en app_roles',
      role_level: 999,
      is_system: false,
      is_active: false,
    },
    scope: {
      is_superadmin: isSuperAdminRole(roleKey),
      is_platform: ['superadmin', 'platform_admin'].includes(roleKey),
      is_dealer: roleKey === 'dealer',
      has_tenant: !!tenantId,
      tenant_id: tenantId,
    },
    tenant,
    tenant_summary: tenantSummary,
    contract,
    permissions,
    permission_map: permissionMap,
    modules,
    module_map: moduleMap,
    standards,
    standard_map: standardMap,
    dealer_tenants: dealerTenants,
  };
}

module.exports = {
  buildGovernanceContext,
  getUserIdFromAuth,
  getUserTenantId,
  getUserRole,
};
