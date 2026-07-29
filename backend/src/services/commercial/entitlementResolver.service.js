const pool = require('../../config/db');

const PLATFORM_ROLES = new Set(['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner']);

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_');
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function getTenantId(user, explicitTenantId) {
  return explicitTenantId || user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null;
}

function isPlatformUser(user) {
  return PLATFORM_ROLES.has(normalizeRole(user?.role || user?.user_role || user?.userRole));
}

async function getPermissionMap(userId) {
  if (!userId) return {};
  const result = await pool.query(
    `SELECT p.permission_key, user_has_permission($1::uuid, p.permission_key) AS allowed
       FROM permissions p
      WHERE p.is_active IS DISTINCT FROM FALSE`,
    [userId]
  ).catch(() => ({ rows: [] }));
  return result.rows.reduce((acc, row) => {
    acc[row.permission_key] = row.allowed === true;
    return acc;
  }, {});
}

function baseDecision(capabilityKey, tenantId) {
  return {
    capability_key: capabilityKey,
    enabled: false,
    decision: 'denied',
    source: 'none',
    reason_code: 'CAPABILITY_NOT_ENTITLED',
    effective_from: null,
    effective_until: null,
    limit: null,
    usage: 0,
    remaining: null,
    dependencies: [],
    read_only: false,
    tenant_id: tenantId || null,
  };
}

async function resolveTenantEntitlements({ tenantId, user = null } = {}) {
  const actorTenantId = getTenantId(user, tenantId);
  const userId = getUserId(user);
  const platform = isPlatformUser(user) && !actorTenantId;

  if (platform) {
    const capabilities = await pool.query(
      `SELECT capability_key FROM commercial_technical_capabilities WHERE status = 'active' ORDER BY capability_key`
    ).catch(() => ({ rows: [] }));
    const enabledCapabilities = {};
    for (const row of capabilities.rows) {
      enabledCapabilities[row.capability_key] = {
        ...baseDecision(row.capability_key, null),
        enabled: true,
        decision: 'allowed',
        source: 'platform',
        reason_code: 'PLATFORM_ROLE',
      };
    }
    return {
      tenant_id: null,
      subscription: { status: 'platform', plan_key: 'platform' },
      modules: [],
      capabilities: enabledCapabilities,
      limits: {},
      usage: {},
      health: { status: 'healthy', score: 100, factors: [], recommended_actions: [], calculated_at: new Date().toISOString() },
    };
  }

  if (!actorTenantId) {
    return {
      tenant_id: null,
      subscription: null,
      modules: [],
      capabilities: {},
      limits: {},
      usage: {},
      health: { status: 'attention', score: 0, factors: [{ key: 'tenant', status: 'missing', weight: 1, score: 0 }], recommended_actions: ['Seleccionar tenant activo'], calculated_at: new Date().toISOString() },
    };
  }

  const [subscriptionResult, moduleResult, capabilityResult, limitResult, usageResult, overrideResult, trialResult, healthResult, permissions] = await Promise.all([
    pool.query(`SELECT * FROM v_commercial_tenant_subscription WHERE tenant_id = $1::uuid LIMIT 1`, [actorTenantId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT * FROM v_commercial_tenant_modules WHERE tenant_id = $1::uuid ORDER BY sort_order, module_key`, [actorTenantId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT * FROM v_commercial_tenant_capabilities WHERE tenant_id = $1::uuid ORDER BY capability_key`, [actorTenantId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT * FROM tenant_usage_limits WHERE tenant_id = $1::uuid AND status = 'active'`, [actorTenantId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT DISTINCT ON (resource_key) resource_key, quantity, period_key, source, updated_at FROM usage_measurements WHERE tenant_id = $1::uuid ORDER BY resource_key, updated_at DESC`, [actorTenantId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT capability_key, enabled, read_only, reason, valid_until FROM tenant_feature_overrides WHERE tenant_id = $1::uuid AND status = 'active' AND (valid_until IS NULL OR valid_until > now())`, [actorTenantId]).catch(() => ({ rows: [] })),
    pool.query(`SELECT capability_key, trial_key, ends_at FROM trials WHERE tenant_id = $1::uuid AND status = 'active' AND ends_at > now()`, [actorTenantId]).catch(() => ({ rows: [] })),
    calculateTenantHealth(actorTenantId).catch((error) => ({ status: 'attention', score: 40, factors: [{ key: 'health_query', status: 'error', weight: 1, score: 0, reason: String(error?.code || error?.message || 'error').slice(0, 80) }], recommended_actions: ['Revisar configuracion comercial del tenant'], calculated_at: new Date().toISOString() })),
    getPermissionMap(userId),
  ]);

  const capabilities = {};
  for (const row of capabilityResult.rows) {
    capabilities[row.capability_key] = {
      ...baseDecision(row.capability_key, actorTenantId),
      enabled: row.enabled === true,
      decision: row.enabled === true ? 'allowed' : 'denied',
      source: row.source || 'plan',
      reason_code: row.enabled === true ? 'ENTITLED' : 'CAPABILITY_DISABLED',
      effective_from: row.effective_from || null,
      effective_until: row.effective_until || null,
      read_only: row.read_only === true,
      dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
      required_permission: row.required_permission || null,
      rbac_allowed: row.required_permission ? permissions[row.required_permission] === true : true,
    };
  }

  for (const row of overrideResult.rows) {
    const key = row.capability_key;
    capabilities[key] = {
      ...(capabilities[key] || baseDecision(key, actorTenantId)),
      enabled: row.enabled === true,
      decision: row.enabled === true ? 'allowed' : 'denied',
      source: 'override',
      reason_code: row.enabled === true ? 'OVERRIDE_ENABLED' : 'OVERRIDE_DISABLED',
      effective_until: row.valid_until || null,
      read_only: row.read_only === true,
    };
  }

  for (const row of trialResult.rows) {
    const key = row.capability_key;
    capabilities[key] = {
      ...(capabilities[key] || baseDecision(key, actorTenantId)),
      enabled: true,
      decision: 'allowed',
      source: 'trial',
      reason_code: 'TRIAL_ACTIVE',
      effective_until: row.ends_at || null,
    };
  }

  const usageByKey = usageResult.rows.reduce((acc, row) => {
    acc[row.resource_key] = Number(row.quantity || 0);
    return acc;
  }, {});
  const limits = {};
  for (const row of limitResult.rows) {
    const used = Number(usageByKey[row.resource_key] || 0);
    const limit = row.limit_value === null || row.limit_value === undefined ? null : Number(row.limit_value);
    limits[row.resource_key] = {
      resource_key: row.resource_key,
      limit,
      usage: used,
      remaining: limit === null ? null : Math.max(0, limit - used),
      warning_threshold: Number(row.warning_threshold || 0.8),
      enforcement: row.enforcement || 'block',
      exhausted: limit !== null && used >= limit,
    };
  }

  return {
    tenant_id: actorTenantId,
    subscription: subscriptionResult.rows[0] || null,
    modules: moduleResult.rows,
    capabilities,
    limits,
    usage: usageByKey,
    health: healthResult,
  };
}

async function resolveCapability({ tenantId, user, capabilityKey, requiredPermission = null, mode = 'write' }) {
  const key = normalizeKey(capabilityKey);
  const entitlements = await resolveTenantEntitlements({ tenantId, user });
  const decision = entitlements.capabilities[key] || baseDecision(key, entitlements.tenant_id);
  const permissions = await getPermissionMap(getUserId(user));
  const required = requiredPermission || decision.required_permission || null;

  if (decision.enabled !== true) {
    return { ...decision, reason_code: decision.reason_code || 'CAPABILITY_NOT_ENTITLED', rbac_allowed: required ? permissions[required] === true : true };
  }
  if (required && permissions[required] !== true && !isPlatformUser(user)) {
    return { ...decision, enabled: false, decision: 'denied', reason_code: 'RBAC_PERMISSION_REQUIRED', rbac_allowed: false };
  }
  if (mode !== 'read' && decision.read_only === true) {
    return { ...decision, enabled: false, decision: 'read_only', reason_code: 'DOWNGRADE_READ_ONLY', rbac_allowed: true };
  }
  return { ...decision, enabled: true, decision: 'allowed', reason_code: decision.reason_code || 'ENTITLED', rbac_allowed: true };
}

async function calculateTenantHealth(tenantId) {
  const result = await pool.query(
    `SELECT * FROM v_commercial_tenant_health WHERE tenant_id = $1::uuid LIMIT 1`,
    [tenantId]
  ).catch(() => ({ rows: [] }));
  if (result.rows[0]) return result.rows[0].health;
  return {
    status: 'attention',
    score: 50,
    factors: [{ key: 'commercial_health', status: 'not_initialized', weight: 1, score: 50 }],
    recommended_actions: ['Completar configuracion comercial del tenant'],
    calculated_at: new Date().toISOString(),
  };
}

async function recordCommercialEvent(clientOrPool, event) {
  const db = clientOrPool || pool;
  await db.query(
    `INSERT INTO commercial_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, before_state, after_state, reason, request_id)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      event.tenantId || null,
      event.actorUserId || null,
      event.eventType,
      event.entityType || null,
      event.entityId || null,
      JSON.stringify(event.beforeState || null),
      JSON.stringify(event.afterState || null),
      event.reason || null,
      event.requestId || null,
    ]
  ).catch(() => null);
}

module.exports = {
  normalizeKey,
  resolveTenantEntitlements,
  resolveCapability,
  calculateTenantHealth,
  recordCommercialEvent,
};
