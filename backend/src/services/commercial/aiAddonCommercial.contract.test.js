'use strict';

const assert = require('node:assert/strict');

const tenantId = '71000000-0000-0000-0000-000000000701';
const subscriptionId = '71000000-0000-0000-0000-000000000902';
const userId = '71000000-0000-0000-0000-000000000799';

const state = {
  planKey: 'pyme',
  addonActive: false,
  aiEnabled: true,
  aiPlan: 'standard',
  aiAuditorEnabled: true,
  auditReviewAllowed: true,
};

function rows(rows) {
  return { rows, rowCount: rows.length };
}

async function query(sql) {
  const text = String(sql).replace(/\s+/g, ' ').trim();

  if (/SELECT ai_enabled, ai_plan, ai_web_enabled, ai_report_enabled, ai_auditor_enabled, ai_monthly_quota, ai_quota_used, ai_features_json FROM tenants/i.test(text)) {
    return rows([{
      ai_enabled: state.aiEnabled,
      ai_plan: state.aiPlan,
      ai_web_enabled: true,
      ai_report_enabled: true,
      ai_auditor_enabled: state.aiAuditorEnabled,
      ai_monthly_quota: null,
      ai_quota_used: 0,
      ai_features_json: {
        suggestions: true,
        auditor: state.aiAuditorEnabled,
        web_research: true,
        report_enrichment: true,
        document_generation: true,
        company_profile_analysis: true,
      },
    }]);
  }

  if (/SELECT id, service_status, suspended_at, deleted_at FROM tenants WHERE id = \$1::uuid LIMIT 1/i.test(text)) {
    return rows([{ id: tenantId, service_status: 'active', suspended_at: null, deleted_at: null }]);
  }

  if (/SELECT \* FROM v_commercial_tenant_subscription WHERE tenant_id = \$1::uuid LIMIT 1/i.test(text)) {
    return rows([{ id: subscriptionId, tenant_id: tenantId, plan_key: state.planKey, status: 'active', started_at: '2026-08-31T00:00:00.000Z' }]);
  }

  if (/SELECT \* FROM v_commercial_tenant_modules WHERE tenant_id = \$1::uuid/i.test(text)) {
    const baseModulesByPlan = {
      pyme: ['core', 'evidences', 'health', 'iso', 'risks'],
      empresa: ['core', 'evidences', 'health', 'iso', 'risks', 'operations_grc', 'risk_manager', 'operational_losses'],
      enterprise: ['core', 'evidences', 'health', 'iso', 'risks', 'operations_grc', 'risk_manager', 'operational_losses', 'grc_core', 'integrated_grc', 'data_governance', 'metrics_bi', 'report_studio', 'premium_reports', 'audit_workpapers', 'ai_compliance'],
    };
    return rows((baseModulesByPlan[state.planKey] || []).map((moduleKey) => ({
      tenant_id: tenantId,
      module_key: moduleKey,
      enabled: true,
      is_enabled: true,
    })));
  }

  if (/SELECT \* FROM v_commercial_tenant_capabilities WHERE tenant_id = \$1::uuid/i.test(text)) {
    const baseCapabilitiesByPlan = {
      pyme: ['core.dashboard', 'core.reports', 'evidence.library', 'iso.actions', 'iso.compliance', 'iso.health', 'iso.risk'],
      empresa: ['core.dashboard', 'core.reports', 'evidence.library', 'iso.actions', 'iso.compliance', 'iso.health', 'iso.risk', 'grc.phase3', 'imports.excel', 'loss.events', 'methodology.risk', 'risk.quantitative'],
      enterprise: ['core.dashboard', 'core.reports', 'evidence.library', 'iso.actions', 'iso.compliance', 'iso.health', 'iso.risk', 'grc.phase3', 'imports.excel', 'loss.events', 'methodology.risk', 'risk.quantitative', 'grc.phase1', 'grc.phase2', 'metrics.catalog', 'reporting.studio', 'workpapers.audit', 'ai.compliance', 'ai.auditor'],
    };
    return rows((baseCapabilitiesByPlan[state.planKey] || []).map((capabilityKey) => ({
      tenant_id: tenantId,
      capability_key: capabilityKey,
      enabled: true,
      source: 'plan',
      module_key: capabilityKey.startsWith('iso.') ? 'iso' : capabilityKey.startsWith('ai.') ? 'ai_compliance' : 'core',
      required_permission: null,
      read_only: false,
      dependencies: [],
    })));
  }

  if (/FROM v_commercial_tenant_subscription vts JOIN tenant_subscription_addons tsa ON tsa\.tenant_subscription_id = vts\.id/i.test(text)) {
    return state.addonActive
      ? rows([{
          id: '71000000-0000-0000-0000-000000000904',
          tenant_subscription_id: subscriptionId,
          addon_key: 'ai',
          status: 'active',
          addon_status: 'active',
          started_at: '2026-08-31T00:00:00.000Z',
          ended_at: null,
          metadata: { capability_keys: ['ai.compliance', 'ai.auditor'] },
        }])
      : rows([]);
  }

  if (/SELECT \* FROM tenant_usage_limits WHERE tenant_id = \$1::uuid AND status = 'active'/i.test(text)) return rows([]);
  if (/SELECT DISTINCT ON \(resource_key\) resource_key, quantity/i.test(text)) return rows([]);
  if (/SELECT capability_key, enabled, read_only, reason, valid_until FROM tenant_feature_overrides/i.test(text)) return rows([]);
  if (/SELECT capability_key, trial_key, ends_at FROM trials/i.test(text)) return rows([]);
  if (/SELECT \* FROM v_commercial_tenant_health WHERE tenant_id = \$1::uuid LIMIT 1/i.test(text)) return rows([]);
  if (/SELECT p\.permission_key, user_has_permission/i.test(text)) {
    return rows([
      { permission_key: 'audit.review', allowed: state.auditReviewAllowed },
      { permission_key: 'ai.view', allowed: true },
    ]);
  }

  throw new Error(`Unhandled AI add-on test query: ${text}`);
}

const dbPath = require.resolve('../../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query } };

const { resolveCapability, resolveTenantEntitlements } = require('./entitlementResolver.service');
const { isTenantAiFeatureEnabled } = require('../tenantAiSettings.service');

async function assertCommercialCombination({ planKey, addonActive, expected }) {
  state.planKey = planKey;
  state.addonActive = addonActive;
  state.aiEnabled = true;
  state.aiPlan = 'standard';
  state.aiAuditorEnabled = true;
  state.auditReviewAllowed = true;

  const entitlements = await resolveTenantEntitlements({ tenantId, user: { id: userId, tenant_id: tenantId } });
  assert.equal(entitlements.capabilities['iso.compliance']?.enabled, true, `${planKey} must see ISO`);
  assert.equal(Boolean(entitlements.capabilities['risk.quantitative']?.enabled), expected.operationalRisk, `${planKey} operational risk visibility`);
  assert.equal(Boolean(entitlements.capabilities['metrics.catalog']?.enabled), expected.grcAdvanced, `${planKey} GRC advanced visibility`);
  assert.equal(Boolean(entitlements.capabilities['ai.compliance']?.enabled), expected.ai, `${planKey} AI compliance visibility`);
  assert.equal(Boolean(entitlements.capabilities['ai.auditor']?.enabled), expected.ai, `${planKey} AI auditor entitlement visibility`);
}

async function run() {
  await assertCommercialCombination({ planKey: 'pyme', addonActive: false, expected: { operationalRisk: false, grcAdvanced: false, ai: false } });
  await assertCommercialCombination({ planKey: 'pyme', addonActive: true, expected: { operationalRisk: false, grcAdvanced: false, ai: true } });
  await assertCommercialCombination({ planKey: 'empresa', addonActive: false, expected: { operationalRisk: true, grcAdvanced: false, ai: false } });
  await assertCommercialCombination({ planKey: 'empresa', addonActive: true, expected: { operationalRisk: true, grcAdvanced: false, ai: true } });
  await assertCommercialCombination({ planKey: 'enterprise', addonActive: false, expected: { operationalRisk: true, grcAdvanced: true, ai: false } });
  await assertCommercialCombination({ planKey: 'enterprise', addonActive: true, expected: { operationalRisk: true, grcAdvanced: true, ai: true } });

  state.planKey = 'pyme';
  state.addonActive = false;
  state.aiEnabled = true;
  state.aiAuditorEnabled = true;
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'suggestions')).enabled, false, 'legacy ai_enabled must not bypass missing add-on');
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'auditor')).enabled, false, 'Auditor IA must deny without add-on');

  state.addonActive = true;
  state.aiPlan = 'none';
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'suggestions')).enabled, true, 'AI add-on active must allow IA Compliance even when legacy ai_plan=none');
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'auditor')).enabled, true, 'AI add-on active must allow Auditor IA even when legacy ai_plan=none');

  state.addonActive = false;
  state.aiPlan = 'enterprise';
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'suggestions')).enabled, false, 'legacy ai_plan must not grant IA Compliance without active add-on');
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'auditor')).enabled, false, 'legacy ai_plan must not grant Auditor IA without active add-on');

  state.addonActive = true;
  state.aiPlan = 'none';
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'suggestions')).enabled, true, 'ISO + AI add-on must allow general AI');
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'auditor')).enabled, true, 'ISO + AI add-on + auditor flag must allow Auditor IA feature');

  state.addonActive = false;
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'suggestions')).enabled, false, 'AI cancelled after active must deny IA Compliance');
  assert.equal((await resolveCapability({ tenantId, user: { id: userId, tenant_id: tenantId }, capabilityKey: 'ai.compliance', requiredPermission: 'ai.view', mode: 'read' })).enabled, false, 'AI cancelled after active must deny direct IA Compliance capability');

  state.addonActive = true;
  assert.equal((await isTenantAiFeatureEnabled(tenantId, 'suggestions')).enabled, true, 'AI reactivated without plan change must restore IA Compliance');
  assert.equal((await resolveCapability({ tenantId, user: { id: userId, tenant_id: tenantId }, capabilityKey: 'ai.compliance', requiredPermission: 'ai.view', mode: 'read' })).enabled, true, 'AI reactivated without plan change must restore direct IA Compliance capability');

  for (const planKey of ['pyme', 'empresa', 'enterprise']) {
    state.planKey = planKey;
    state.addonActive = true;
    state.aiAuditorEnabled = true;
    state.auditReviewAllowed = true;
    assert.equal((await resolveCapability({ tenantId, user: { id: userId, tenant_id: tenantId }, capabilityKey: 'ai.auditor', requiredPermission: 'audit.review', mode: 'read' })).enabled, true, `${planKey} + AI + audit.review should allow Auditor IA`);

    state.addonActive = false;
    assert.equal((await resolveCapability({ tenantId, user: { id: userId, tenant_id: tenantId }, capabilityKey: 'ai.auditor', requiredPermission: 'audit.review', mode: 'read' })).enabled, false, `${planKey} without AI add-on should deny Auditor IA`);

    state.addonActive = true;
    state.aiAuditorEnabled = false;
    assert.equal((await isTenantAiFeatureEnabled(tenantId, 'auditor')).enabled, false, `${planKey} + AI but ai_auditor_enabled=false should deny Auditor IA feature`);

    state.aiAuditorEnabled = true;
    state.auditReviewAllowed = false;
    const noPermission = await resolveCapability({ tenantId, user: { id: userId, tenant_id: tenantId }, capabilityKey: 'ai.auditor', requiredPermission: 'audit.review', mode: 'read' });
    assert.equal(noPermission.enabled, false, `${planKey} + AI without audit.review should deny Auditor IA`);
    assert.equal(noPermission.reason_code, 'RBAC_PERMISSION_REQUIRED');
  }

  process.stdout.write('AI_ADDON_COMMERCIAL_CONTRACT_PASS\n');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
