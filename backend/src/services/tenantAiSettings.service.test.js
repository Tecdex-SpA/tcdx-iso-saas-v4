'use strict';

const assert = require('node:assert/strict');

const tenantId = 'tenant-ai-quota-contract';
const subscriptionId = 'subscription-ai-quota-contract';

const enabledFeatures = Object.freeze({
  suggestions: true,
  auditor: true,
  web_research: true,
  report_enrichment: true,
  document_generation: true,
  company_profile_analysis: true,
});

const state = {
  addonActive: true,
  aiEnabled: true,
  aiPlan: 'standard',
  aiWebEnabled: true,
  aiReportEnabled: true,
  aiAuditorEnabled: true,
  aiMonthlyQuota: null,
  aiQuotaUsed: 0,
  aiFeatures: { ...enabledFeatures },
};

function rows(rows) {
  return { rows, rowCount: rows.length };
}

function resetState() {
  state.addonActive = true;
  state.aiEnabled = true;
  state.aiPlan = 'standard';
  state.aiWebEnabled = true;
  state.aiReportEnabled = true;
  state.aiAuditorEnabled = true;
  state.aiMonthlyQuota = null;
  state.aiQuotaUsed = 0;
  state.aiFeatures = { ...enabledFeatures };
}

async function query(sql) {
  const text = String(sql).replace(/\s+/g, ' ').trim();

  if (/SELECT ai_enabled, ai_plan, ai_web_enabled, ai_report_enabled, ai_auditor_enabled, ai_monthly_quota, ai_quota_used, ai_features_json FROM tenants/i.test(text)) {
    return rows([{
      ai_enabled: state.aiEnabled,
      ai_plan: state.aiPlan,
      ai_web_enabled: state.aiWebEnabled,
      ai_report_enabled: state.aiReportEnabled,
      ai_auditor_enabled: state.aiAuditorEnabled,
      ai_monthly_quota: state.aiMonthlyQuota,
      ai_quota_used: state.aiQuotaUsed,
      ai_features_json: state.aiFeatures,
    }]);
  }

  if (/SELECT id, service_status, suspended_at, deleted_at FROM tenants WHERE id = \$1::uuid LIMIT 1/i.test(text)) {
    return rows([{ id: tenantId, service_status: 'active', suspended_at: null, deleted_at: null }]);
  }

  if (/SELECT \* FROM v_commercial_tenant_subscription WHERE tenant_id = \$1::uuid LIMIT 1/i.test(text)) {
    return rows([{ id: subscriptionId, tenant_id: tenantId, plan_key: 'base', status: 'active' }]);
  }

  if (/SELECT \* FROM v_commercial_tenant_modules WHERE tenant_id = \$1::uuid/i.test(text)) return rows([]);
  if (/SELECT \* FROM v_commercial_tenant_capabilities WHERE tenant_id = \$1::uuid/i.test(text)) return rows([]);

  if (/FROM v_commercial_tenant_subscription vts JOIN tenant_subscription_addons tsa ON tsa\.tenant_subscription_id = vts\.id/i.test(text)) {
    return state.addonActive
      ? rows([{
          id: 'addon-ai-contract',
          tenant_subscription_id: subscriptionId,
          addon_key: 'ai',
          status: 'active',
          addon_status: 'active',
          started_at: '2026-09-01T00:00:00.000Z',
          ended_at: null,
          metadata: {},
        }])
      : rows([]);
  }

  if (/SELECT \* FROM tenant_usage_limits WHERE tenant_id = \$1::uuid AND status = 'active'/i.test(text)) return rows([]);
  if (/SELECT DISTINCT ON \(resource_key\) resource_key, quantity/i.test(text)) return rows([]);
  if (/SELECT capability_key, enabled, read_only, reason, valid_until FROM tenant_feature_overrides/i.test(text)) return rows([]);
  if (/SELECT capability_key, trial_key, ends_at FROM trials/i.test(text)) return rows([]);
  if (/SELECT \* FROM v_commercial_tenant_health WHERE tenant_id = \$1::uuid LIMIT 1/i.test(text)) return rows([]);

  throw new Error(`Unhandled tenant AI settings test query: ${text}`);
}

const dbPath = require.resolve('../config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query } };

const {
  buildAiDisabledTrace,
  isAiMonthlyQuotaExceeded,
  isTenantAiFeatureEnabled,
  normalizeAiSettingsPayload,
} = require('./tenantAiSettings.service');

async function assertDecision({ quota, used, expectedEnabled, expectedReason, label }) {
  resetState();
  state.aiMonthlyQuota = quota;
  state.aiQuotaUsed = used;

  const decision = await isTenantAiFeatureEnabled(tenantId, 'suggestions');
  assert.equal(decision.enabled, expectedEnabled, `${label} enabled`);
  assert.equal(decision.reason, expectedReason, `${label} reason`);
}

function assertPayloadQuota(value, expected, label) {
  assert.equal(
    normalizeAiSettingsPayload({ ai_enabled: true, ai_monthly_quota: value }).ai_monthly_quota,
    expected,
    label
  );
}

function assertInvalidPayloadQuota(value, label) {
  assert.throws(
    () => normalizeAiSettingsPayload({ ai_enabled: true, ai_monthly_quota: value }),
    (error) => error?.code === 'AI_MONTHLY_QUOTA_INVALID',
    label
  );
}

async function run() {
  assert.equal(isAiMonthlyQuotaExceeded(null, 0), false, 'quota=NULL must not be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(0, 0), false, 'quota=0 used=0 must not be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(0, 500), false, 'quota=0 used=500 must not be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(1, 0), false, 'quota=1 used=0 must not be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(1, 1), true, 'quota=1 used=1 must be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(100, 99), false, 'quota=100 used=99 must not be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(100, 100), true, 'quota=100 used=100 must be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded(100, 101), true, 'quota=100 used=101 must be exhausted');
  assert.equal(isAiMonthlyQuotaExceeded('', 500), false, 'blank quota must not become a zero limit');
  assert.equal(isAiMonthlyQuotaExceeded('not-a-number', 500), false, 'invalid quota must not become a limit');

  assertPayloadQuota(null, null, 'A write quota null must remain null');
  assertPayloadQuota(undefined, null, 'write quota omitted must normalize to null');
  assertPayloadQuota('', null, 'B write quota blank must normalize to null');
  assertPayloadQuota('   ', null, 'C write quota spaces must normalize to null');
  assertPayloadQuota(0, 0, 'D write quota 0 must remain 0');
  assertPayloadQuota('0', 0, 'E write quota "0" must normalize to 0');
  assertPayloadQuota(1, 1, 'F write quota 1 must remain 1');
  assertPayloadQuota('100', 100, 'G write quota "100" must normalize to 100');
  assertInvalidPayloadQuota(-1, 'H write quota -1 must be rejected');
  assertInvalidPayloadQuota('-1', 'I write quota "-1" must be rejected');
  assertInvalidPayloadQuota(1.5, 'J write quota 1.5 must be rejected');
  assertInvalidPayloadQuota('1.5', 'K write quota "1.5" must be rejected');
  assertInvalidPayloadQuota('not-a-number', 'L write quota text must be rejected');
  assertInvalidPayloadQuota(NaN, 'M write quota NaN must be rejected');
  assertInvalidPayloadQuota(Infinity, 'N write quota Infinity must be rejected');
  assertInvalidPayloadQuota(-Infinity, 'write quota -Infinity must be rejected');

  await assertDecision({
    quota: null,
    used: 0,
    expectedEnabled: true,
    expectedReason: 'ai_enabled',
    label: 'A add-on + runtime + feature + quota=NULL + used=0',
  });
  await assertDecision({
    quota: 0,
    used: 0,
    expectedEnabled: true,
    expectedReason: 'ai_enabled',
    label: 'B quota=0 used=0',
  });
  await assertDecision({
    quota: 0,
    used: 500,
    expectedEnabled: true,
    expectedReason: 'ai_enabled',
    label: 'C quota=0 used=500',
  });
  await assertDecision({
    quota: 100,
    used: 99,
    expectedEnabled: true,
    expectedReason: 'ai_enabled',
    label: 'D quota=100 used=99',
  });
  await assertDecision({
    quota: 100,
    used: 100,
    expectedEnabled: false,
    expectedReason: 'ai_quota_exceeded',
    label: 'E quota=100 used=100',
  });
  await assertDecision({
    quota: 100,
    used: 101,
    expectedEnabled: false,
    expectedReason: 'ai_quota_exceeded',
    label: 'F quota=100 used=101',
  });

  resetState();
  state.addonActive = false;
  state.aiEnabled = true;
  state.aiPlan = 'enterprise';
  state.aiFeatures = { ...enabledFeatures };
  const noAddon = await isTenantAiFeatureEnabled(tenantId, 'suggestions');
  assert.equal(noAddon.enabled, false, 'G missing add-on must deny AI');
  assert.equal(noAddon.reason, 'ADDON_REQUIRED', 'G missing add-on must keep commercial reason');

  resetState();
  state.aiEnabled = false;
  const runtimeDisabled = await isTenantAiFeatureEnabled(tenantId, 'suggestions');
  assert.equal(runtimeDisabled.enabled, false, 'H runtime disabled must deny AI');
  assert.equal(runtimeDisabled.reason, 'ai_runtime_disabled', 'H runtime disabled reason');

  resetState();
  state.aiFeatures = { ...enabledFeatures, suggestions: false };
  const featureDisabled = await isTenantAiFeatureEnabled(tenantId, 'suggestions');
  assert.equal(featureDisabled.enabled, false, 'I feature disabled must deny AI');
  assert.equal(featureDisabled.reason, 'ai_feature_disabled', 'I feature disabled reason');

  assert.equal(buildAiDisabledTrace({ reason: 'ai_quota_exceeded' }).ai_disabled_by_plan, false, 'J quota denial is not plan denial');
  assert.equal(buildAiDisabledTrace({ reason: 'ai_runtime_disabled' }).ai_disabled_by_plan, false, 'K runtime denial is not plan denial');
  assert.equal(buildAiDisabledTrace({ reason: 'ai_feature_disabled' }).ai_disabled_by_plan, false, 'L feature denial is not plan denial');
  assert.equal(buildAiDisabledTrace({ reason: 'ADDON_REQUIRED' }).ai_disabled_by_plan, true, 'M commercial denial is plan/add-on denial');

  process.stdout.write('TENANT_AI_SETTINGS_QUOTA_CONTRACT_PASS\n');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
