const pool = require('../../config/db');
const { normalizeKey, resolveTenantEntitlements, calculateTenantHealth, recordCommercialEvent } = require('./entitlementResolver.service');
const {
  STANDARD_COMMERCIAL_PLANS,
  normalizeCommercialPlanKey,
  decorateCommercialPlan,
  buildStandardCommercialPlans,
} = require('./commercialPlanModel.service');

class CommercialError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'CommercialError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function asJson(value) {
  return JSON.stringify(value === undefined ? null : value);
}

async function assertTenantExists(client, tenantId) {
  const result = await client.query('SELECT id, name, service_status FROM tenants WHERE id = $1::uuid LIMIT 1', [tenantId]);
  if (result.rowCount !== 1) throw new CommercialError('TENANT_NOT_FOUND', 'Tenant no encontrado.', 404);
  return result.rows[0];
}

async function listCatalog() {
  const standardPlanKeys = STANDARD_COMMERCIAL_PLANS.map((plan) => plan.plan_key);
  const [families, editions, plans, versions, modules, addons, features, capabilities, limits, packs, methodologies, workpapers, planCapabilities] = await Promise.all([
    pool.query('SELECT * FROM product_families ORDER BY family_key'),
    pool.query('SELECT * FROM commercial_editions ORDER BY edition_key'),
    pool.query('SELECT * FROM commercial_plans ORDER BY plan_key'),
    pool.query('SELECT * FROM commercial_plan_versions ORDER BY plan_key, version_number'),
    pool.query('SELECT * FROM commercial_modules ORDER BY sort_order, module_key'),
    pool.query('SELECT * FROM commercial_addons ORDER BY addon_key'),
    pool.query('SELECT * FROM commercial_features ORDER BY feature_key'),
    pool.query('SELECT * FROM commercial_technical_capabilities ORDER BY capability_key'),
    pool.query('SELECT * FROM usage_limit_definitions ORDER BY resource_key'),
    pool.query('SELECT * FROM pack_definitions ORDER BY pack_key'),
    pool.query('SELECT * FROM risk_methodology_versions ORDER BY methodology_key, version_number'),
    pool.query('SELECT * FROM audit_workpaper_template_versions ORDER BY template_key, version_number'),
    pool.query('SELECT * FROM v_commercial_plan_capabilities WHERE plan_key = ANY($1::text[]) ORDER BY plan_key, module_key, capability_key', [standardPlanKeys]),
  ]);
  return {
    families: families.rows,
    editions: editions.rows,
    plans: plans.rows.map(decorateCommercialPlan),
    standard_plans: buildStandardCommercialPlans({
      plans: plans.rows,
      versions: versions.rows,
      modules: modules.rows,
      planCapabilities: planCapabilities.rows,
    }),
    versions: versions.rows,
    modules: modules.rows,
    addons: addons.rows,
    features: features.rows,
    capabilities: capabilities.rows,
    limits: limits.rows,
    packs: packs.rows,
    methodologies: methodologies.rows,
    workpapers: workpapers.rows,
  };
}

async function createCatalogItem({ body, user, requestId }) {
  const entity = normalizeKey(body?.entity || '');
  const key = normalizeKey(body?.key || body?.code || '');
  const displayName = String(body?.display_name || body?.name || '').trim();
  if (!entity || !key || !displayName) throw new CommercialError('COMMERCIAL_CATALOG_PAYLOAD_INVALID', 'Entidad, clave y nombre son obligatorios.', 422);
  const actor = getUserId(user);
  const metadata = asJson(body?.metadata || {});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let row;
    if (entity === 'family') {
      row = (await client.query(`INSERT INTO product_families (family_key, display_name, description, status, created_by, metadata) VALUES ($1,$2,$3,$4,$5::uuid,$6::jsonb) ON CONFLICT (family_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, status = EXCLUDED.status, updated_at = now(), metadata = product_families.metadata || EXCLUDED.metadata RETURNING *`, [key, displayName, body?.description || null, body?.status || 'draft', actor, metadata])).rows[0];
    } else if (entity === 'module') {
      row = (await client.query(`INSERT INTO commercial_modules (module_key, display_name, description, status, sort_order, created_by, metadata) VALUES ($1,$2,$3,$4,$5,$6::uuid,$7::jsonb) ON CONFLICT (module_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order, updated_at = now(), metadata = commercial_modules.metadata || EXCLUDED.metadata RETURNING *`, [key, displayName, body?.description || null, body?.status || 'active', Number(body?.sort_order || 500), actor, metadata])).rows[0];
    } else if (entity === 'capability') {
      row = (await client.query(`INSERT INTO commercial_technical_capabilities (capability_key, display_name, description, required_permission, status, created_by, metadata) VALUES ($1,$2,$3,$4,$5,$6::uuid,$7::jsonb) ON CONFLICT (capability_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, required_permission = EXCLUDED.required_permission, status = EXCLUDED.status, updated_at = now(), metadata = commercial_technical_capabilities.metadata || EXCLUDED.metadata RETURNING *`, [key, displayName, body?.description || null, body?.required_permission || null, body?.status || 'active', actor, metadata])).rows[0];
    } else {
      throw new CommercialError('COMMERCIAL_CATALOG_ENTITY_UNSUPPORTED', 'Entidad comercial no soportada para alta rapida.', 422);
    }
    await recordCommercialEvent(client, { actorUserId: actor, eventType: 'catalog.upsert', entityType: entity, entityId: row.id, afterState: row, reason: body?.reason || 'catalog administration', requestId });
    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function publishPlanVersion({ body, user, requestId }) {
  const planKey = normalizeKey(body?.plan_key || '');
  const versionNumber = Number(body?.version_number || 1);
  if (!planKey) throw new CommercialError('PLAN_KEY_REQUIRED', 'plan_key es obligatorio.', 422);
  const actor = getUserId(user);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = (await client.query(`INSERT INTO commercial_plans (plan_key, display_name, description, status, created_by) VALUES ($1,$2,$3,'active',$4::uuid) ON CONFLICT (plan_key) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, commercial_plans.display_name), updated_at = now() RETURNING *`, [planKey, body?.display_name || planKey, body?.description || null, actor])).rows[0];
    const existing = await client.query('SELECT * FROM commercial_plan_versions WHERE plan_id = $1::uuid AND version_number = $2 LIMIT 1', [plan.id, versionNumber]);
    if (existing.rowCount && existing.rows[0].status === 'published') throw new CommercialError('PLAN_VERSION_IMMUTABLE', 'La version publicada no se puede modificar.', 409);
    const version = (await client.query(`INSERT INTO commercial_plan_versions (plan_id, plan_key, version_number, status, effective_from, created_by, metadata) VALUES ($1::uuid,$2,$3,'published',COALESCE($4::timestamptz, now()),$5::uuid,$6::jsonb) ON CONFLICT (plan_id, version_number) DO UPDATE SET status = 'published', effective_from = EXCLUDED.effective_from, updated_at = now(), metadata = commercial_plan_versions.metadata || EXCLUDED.metadata RETURNING *`, [plan.id, planKey, versionNumber, body?.effective_from || null, actor, asJson(body?.metadata || {})])).rows[0];
    for (const moduleKey of body?.module_keys || []) {
      await client.query(`INSERT INTO plan_version_modules (plan_version_id, module_key, included, created_by) VALUES ($1::uuid,$2,true,$3::uuid) ON CONFLICT (plan_version_id, module_key) DO UPDATE SET included = true, updated_at = now()`, [version.id, normalizeKey(moduleKey), actor]);
    }
    for (const addonKey of body?.addon_keys || []) {
      await client.query(`INSERT INTO plan_version_addons (plan_version_id, addon_key, included, created_by) VALUES ($1::uuid,$2,true,$3::uuid) ON CONFLICT (plan_version_id, addon_key) DO UPDATE SET included = true, updated_at = now()`, [version.id, normalizeKey(addonKey), actor]);
    }
    await recordCommercialEvent(client, { actorUserId: actor, eventType: 'plan.publish', entityType: 'commercial_plan_version', entityId: version.id, afterState: version, reason: body?.reason || 'plan publication', requestId });
    await client.query('COMMIT');
    return version;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function getTenantCommercialState(tenantId) {
  const [tenant, entitlements, events, trials, packs] = await Promise.all([
    pool.query('SELECT id, name, service_status FROM tenants WHERE id = $1::uuid LIMIT 1', [tenantId]),
    resolveTenantEntitlements({ tenantId }),
    pool.query('SELECT * FROM commercial_events WHERE tenant_id = $1::uuid ORDER BY created_at DESC LIMIT 100', [tenantId]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM trials WHERE tenant_id = $1::uuid ORDER BY created_at DESC', [tenantId]).catch(() => ({ rows: [] })),
    pool.query('SELECT * FROM tenant_pack_installations WHERE tenant_id = $1::uuid ORDER BY installed_at DESC', [tenantId]).catch(() => ({ rows: [] })),
  ]);
  if (tenant.rowCount !== 1) throw new CommercialError('TENANT_NOT_FOUND', 'Tenant no encontrado.', 404);
  return { tenant: tenant.rows[0], ...entitlements, events: events.rows, trials: trials.rows, packs: packs.rows };
}

async function previewPlanChange({ tenantId, body }) {
  const targetPlanKey = normalizeCommercialPlanKey(body?.target_plan_key || body?.plan_key || '');
  if (!targetPlanKey) throw new CommercialError('TARGET_PLAN_REQUIRED', 'target_plan_key es obligatorio.', 422);
  const current = await resolveTenantEntitlements({ tenantId });
  const targetResult = await pool.query(`SELECT * FROM v_commercial_plan_capabilities WHERE plan_key = $1 ORDER BY capability_key`, [targetPlanKey]);
  if (targetResult.rowCount === 0) throw new CommercialError('TARGET_PLAN_NOT_FOUND', 'Plan destino no encontrado o sin version publicada.', 404);
  const currentKeys = new Set(Object.entries(current.capabilities).filter(([, value]) => value.enabled).map(([key]) => key));
  const targetKeys = new Set(targetResult.rows.map((row) => row.capability_key));
  const gained = [...targetKeys].filter((key) => !currentKeys.has(key));
  const lost = [...currentKeys].filter((key) => !targetKeys.has(key));
  const limitResult = await pool.query(`SELECT resource_key, default_limit FROM usage_limit_definitions ORDER BY resource_key`);
  return {
    tenant_id: tenantId,
    current_plan_key: current.subscription?.plan_key || null,
    target_plan_key: targetPlanKey,
    gained_capabilities: gained,
    lost_capabilities: lost,
    previous_limits: current.limits,
    target_limits: limitResult.rows.reduce((acc, row) => { acc[row.resource_key] = { limit: Number(row.default_limit || 0), enforcement: 'block' }; return acc; }, {}),
    exceeded_resources: [],
    affected_modules: targetResult.rows.map((row) => row.module_key).filter(Boolean),
    post_change_mode: lost.length ? 'read_only_for_history' : 'active',
    required_actions: lost.length ? ['Comunicar capacidades que quedaran solo lectura cuando aplique'] : [],
    effective_at: body?.effective_at || new Date().toISOString(),
  };
}

async function changePlan({ tenantId, body, user, requestId }) {
  const preview = await previewPlanChange({ tenantId, body });
  const actor = getUserId(user);
  const idempotencyKey = String(body?.idempotency_key || requestId || '').trim();
  if (!idempotencyKey) throw new CommercialError('IDEMPOTENCY_KEY_REQUIRED', 'idempotency_key es obligatorio.', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertTenantExists(client, tenantId);
    const replay = await client.query('SELECT details FROM commercial_events WHERE tenant_id = $1::uuid AND request_id = $2 AND event_type = $3 LIMIT 1', [tenantId, idempotencyKey, 'subscription.change_plan']);
    if (replay.rowCount) {
      await client.query('COMMIT');
      return { replayed: true, preview: replay.rows[0].details?.preview || preview };
    }
    const version = await client.query(`SELECT * FROM commercial_plan_versions WHERE plan_key = $1 AND status = 'published' ORDER BY version_number DESC LIMIT 1`, [preview.target_plan_key]);
    if (version.rowCount !== 1) throw new CommercialError('TARGET_PLAN_NOT_PUBLISHED', 'Plan destino sin version publicada.', 409);
    const before = await client.query("SELECT * FROM tenant_subscriptions WHERE tenant_id = $1::uuid AND status IN ('active', 'trialing', 'past_due') FOR UPDATE", [tenantId]);
    await client.query("UPDATE tenant_subscriptions SET status = 'replaced', ended_at = COALESCE($2::timestamptz, now()), updated_at = now() WHERE tenant_id = $1::uuid AND status IN ('active', 'trialing', 'past_due')", [tenantId, body?.effective_at || null]);
    const inserted = await client.query(`INSERT INTO tenant_subscriptions (tenant_id, plan_version_id, plan_key, status, started_at, created_by, metadata) VALUES ($1::uuid,$2::uuid,$3,'active',COALESCE($4::timestamptz, now()),$5::uuid,$6::jsonb) RETURNING *`, [tenantId, version.rows[0].id, preview.target_plan_key, body?.effective_at || null, actor, asJson({ change_preview: preview })]);
    await recordCommercialEvent(client, { tenantId, actorUserId: actor, eventType: 'subscription.change_plan', entityType: 'tenant_subscription', entityId: inserted.rows[0].id, beforeState: before.rows, afterState: inserted.rows[0], reason: body?.reason || 'commercial plan change', requestId: idempotencyKey });
    await client.query('COMMIT');
    return { replayed: false, subscription: inserted.rows[0], preview };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function listTenantUsage(tenantId) {
  const [limits, usage] = await Promise.all([
    pool.query('SELECT * FROM tenant_usage_limits WHERE tenant_id = $1::uuid ORDER BY resource_key', [tenantId]),
    pool.query('SELECT * FROM usage_measurements WHERE tenant_id = $1::uuid ORDER BY updated_at DESC LIMIT 200', [tenantId]),
  ]);
  return { limits: limits.rows, usage: usage.rows };
}

async function upsertTenantLimit({ tenantId, body, user, requestId }) {
  const resourceKey = normalizeKey(body?.resource_key || '');
  if (!resourceKey) throw new CommercialError('RESOURCE_KEY_REQUIRED', 'resource_key es obligatorio.', 422);
  const actor = getUserId(user);
  const result = await pool.query(`INSERT INTO tenant_usage_limits (tenant_id, resource_key, limit_value, warning_threshold, enforcement, status, created_by) VALUES ($1::uuid,$2,$3,$4,$5,'active',$6::uuid) ON CONFLICT (tenant_id, resource_key) DO UPDATE SET limit_value = EXCLUDED.limit_value, warning_threshold = EXCLUDED.warning_threshold, enforcement = EXCLUDED.enforcement, status = 'active', updated_at = now() RETURNING *`, [tenantId, resourceKey, body?.limit_value ?? null, body?.warning_threshold ?? 0.8, body?.enforcement || 'block', actor]);
  await recordCommercialEvent(pool, { tenantId, actorUserId: actor, eventType: 'limit.upsert', entityType: 'tenant_usage_limit', entityId: result.rows[0].id, afterState: result.rows[0], reason: body?.reason || 'usage limit administration', requestId });
  return result.rows[0];
}

async function startTrial({ tenantId, body, user, requestId }) {
  const capabilityKey = normalizeKey(body?.capability_key || '');
  const trialKey = normalizeKey(body?.trial_key || capabilityKey || 'trial');
  if (!capabilityKey) throw new CommercialError('CAPABILITY_KEY_REQUIRED', 'capability_key es obligatorio.', 422);
  const actor = getUserId(user);
  const result = await pool.query(`INSERT INTO trials (tenant_id, trial_key, capability_key, status, starts_at, ends_at, created_by, metadata) VALUES ($1::uuid,$2,$3,'active',COALESCE($4::timestamptz, now()),$5::timestamptz,$6::uuid,$7::jsonb) ON CONFLICT (tenant_id, trial_key) DO UPDATE SET capability_key = EXCLUDED.capability_key, status = 'active', starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now(), metadata = trials.metadata || EXCLUDED.metadata RETURNING *`, [tenantId, trialKey, capabilityKey, body?.starts_at || null, body?.ends_at || null, actor, asJson(body?.metadata || {})]);
  await recordCommercialEvent(pool, { tenantId, actorUserId: actor, eventType: 'trial.start', entityType: 'trial', entityId: result.rows[0].id, afterState: result.rows[0], reason: body?.reason || 'trial administration', requestId });
  return result.rows[0];
}

async function applyOverride({ tenantId, body, user, requestId }) {
  const capabilityKey = normalizeKey(body?.capability_key || '');
  if (!capabilityKey) throw new CommercialError('CAPABILITY_KEY_REQUIRED', 'capability_key es obligatorio.', 422);
  const actor = getUserId(user);
  const result = await pool.query(`INSERT INTO tenant_feature_overrides (tenant_id, capability_key, enabled, read_only, status, valid_from, valid_until, reason, created_by, metadata) VALUES ($1::uuid,$2,$3,$4,'active',COALESCE($5::timestamptz, now()),$6::timestamptz,$7,$8::uuid,$9::jsonb) ON CONFLICT (tenant_id, capability_key) DO UPDATE SET enabled = EXCLUDED.enabled, read_only = EXCLUDED.read_only, status = 'active', valid_from = EXCLUDED.valid_from, valid_until = EXCLUDED.valid_until, reason = EXCLUDED.reason, updated_at = now(), metadata = tenant_feature_overrides.metadata || EXCLUDED.metadata RETURNING *`, [tenantId, capabilityKey, body?.enabled === true, body?.read_only === true, body?.valid_from || null, body?.valid_until || null, body?.reason || 'commercial override', actor, asJson(body?.metadata || {})]);
  await recordCommercialEvent(pool, { tenantId, actorUserId: actor, eventType: 'entitlement.override', entityType: 'tenant_feature_override', entityId: result.rows[0].id, afterState: result.rows[0], reason: body?.reason || 'commercial override', requestId });
  return result.rows[0];
}

async function previewPackInstall({ tenantId, packKey }) {
  const key = normalizeKey(packKey);
  const pack = await pool.query(`SELECT pd.*, pv.id AS version_id, pv.version_number, pv.status AS version_status FROM pack_definitions pd JOIN pack_versions pv ON pv.pack_id = pd.id WHERE pd.pack_key = $1 AND pd.status IN ('published','draft') ORDER BY pv.version_number DESC LIMIT 1`, [key]);
  if (pack.rowCount !== 1) throw new CommercialError('PACK_NOT_FOUND', 'Pack no encontrado.', 404);
  const items = await pool.query('SELECT * FROM pack_items WHERE pack_version_id = $1::uuid ORDER BY item_order, item_key', [pack.rows[0].version_id]);
  const installed = await pool.query('SELECT * FROM tenant_pack_installations WHERE tenant_id = $1::uuid AND pack_key = $2 ORDER BY installed_at DESC LIMIT 1', [tenantId, key]);
  return { tenant_id: tenantId, pack: pack.rows[0], items: items.rows, already_installed: installed.rowCount > 0, safe_to_install: pack.rows[0].version_status === 'published' && pack.rows[0].licensed_text_included !== true };
}

async function installPack({ tenantId, packKey, user, requestId }) {
  const preview = await previewPackInstall({ tenantId, packKey });
  if (!preview.safe_to_install) throw new CommercialError('PACK_NOT_INSTALLABLE', 'Pack no instalable en su estado actual.', 409);
  const actor = getUserId(user);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const replay = await client.query('SELECT * FROM tenant_pack_installations WHERE tenant_id = $1::uuid AND pack_key = $2 AND pack_version_id = $3::uuid LIMIT 1', [tenantId, normalizeKey(packKey), preview.pack.version_id]);
    if (replay.rowCount) {
      await client.query('COMMIT');
      return { replayed: true, installation: replay.rows[0], preview };
    }
    const installation = await client.query(`INSERT INTO tenant_pack_installations (tenant_id, pack_key, pack_version_id, status, installed_by, preview, metadata) VALUES ($1::uuid,$2,$3::uuid,'installed',$4::uuid,$5::jsonb,$6::jsonb) RETURNING *`, [tenantId, normalizeKey(packKey), preview.pack.version_id, actor, asJson(preview), asJson({ request_id: requestId })]);
    for (const item of preview.items) {
      await client.query(`INSERT INTO tenant_pack_installation_items (installation_id, item_key, item_type, action, status, created_record_id, metadata) VALUES ($1::uuid,$2,$3,'prepared','installed',NULL,$4::jsonb) ON CONFLICT (installation_id, item_key) DO NOTHING`, [installation.rows[0].id, item.item_key, item.item_type, asJson(item.metadata || {})]);
    }
    await recordCommercialEvent(client, { tenantId, actorUserId: actor, eventType: 'pack.install', entityType: 'tenant_pack_installation', entityId: installation.rows[0].id, afterState: installation.rows[0], reason: 'pack installation', requestId });
    await client.query('COMMIT');
    return { replayed: false, installation: installation.rows[0], preview };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

function validateMethodologyDefinition(definition) {
  const allowedOperators = new Set(['sum', 'multiply', 'max', 'min', 'weighted_average', 'threshold']);
  const steps = Array.isArray(definition?.scoring?.steps) ? definition.scoring.steps : [];
  for (const step of steps) {
    if (!allowedOperators.has(step.operator)) throw new CommercialError('METHODOLOGY_OPERATOR_NOT_ALLOWED', 'La metodologia usa un operador no permitido.', 422);
  }
  return true;
}

async function upsertMethodology({ body, user, requestId }) {
  validateMethodologyDefinition(body?.definition || {});
  const key = normalizeKey(body?.methodology_key || '');
  if (!key) throw new CommercialError('METHODOLOGY_KEY_REQUIRED', 'methodology_key es obligatorio.', 422);
  const actor = getUserId(user);
  const result = await pool.query(`INSERT INTO risk_methodology_versions (methodology_key, version_number, status, display_name, definition, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6::uuid) ON CONFLICT (methodology_key, version_number) DO UPDATE SET status = EXCLUDED.status, display_name = EXCLUDED.display_name, definition = EXCLUDED.definition, updated_at = now() RETURNING *`, [key, Number(body?.version_number || 1), body?.status || 'draft', body?.display_name || key, asJson(body?.definition || {}), actor]);
  await recordCommercialEvent(pool, { actorUserId: actor, eventType: 'methodology.upsert', entityType: 'risk_methodology_version', entityId: result.rows[0].id, afterState: result.rows[0], reason: body?.reason || 'methodology administration', requestId });
  return result.rows[0];
}

async function upsertWorkpaperTemplate({ body, user, requestId }) {
  const key = normalizeKey(body?.template_key || '');
  if (!key) throw new CommercialError('WORKPAPER_TEMPLATE_KEY_REQUIRED', 'template_key es obligatorio.', 422);
  const actor = getUserId(user);
  const result = await pool.query(`INSERT INTO audit_workpaper_template_versions (template_key, version_number, status, display_name, sections, fields, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::uuid) ON CONFLICT (template_key, version_number) DO UPDATE SET status = EXCLUDED.status, display_name = EXCLUDED.display_name, sections = EXCLUDED.sections, fields = EXCLUDED.fields, updated_at = now() RETURNING *`, [key, Number(body?.version_number || 1), body?.status || 'draft', body?.display_name || key, asJson(body?.sections || []), asJson(body?.fields || []), actor]);
  await recordCommercialEvent(pool, { actorUserId: actor, eventType: 'workpaper_template.upsert', entityType: 'audit_workpaper_template_version', entityId: result.rows[0].id, afterState: result.rows[0], reason: body?.reason || 'workpaper template administration', requestId });
  return result.rows[0];
}

module.exports = {
  CommercialError,
  assertTenantExists,
  listCatalog,
  createCatalogItem,
  publishPlanVersion,
  getTenantCommercialState,
  previewPlanChange,
  changePlan,
  listTenantUsage,
  upsertTenantLimit,
  startTrial,
  applyOverride,
  calculateTenantHealth,
  previewPackInstall,
  installPack,
  validateMethodologyDefinition,
  upsertMethodology,
  upsertWorkpaperTemplate,
};
