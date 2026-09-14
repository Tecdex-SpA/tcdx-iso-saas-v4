'use strict';

const pool = require('../config/db');
const { resolveTenantEntitlements } = require('./commercial/entitlementResolver.service');

const DEFAULT_FEATURES = Object.freeze({
  company_profile_analysis: true,
  report_enrichment: true,
  auditor: true,
  web_research: true,
  document_generation: true,
  suggestions: true,
});

const DISABLED_FEATURES = Object.freeze({
  company_profile_analysis: false,
  report_enrichment: false,
  auditor: false,
  web_research: false,
  document_generation: false,
  suggestions: false,
});

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizePlan(value, fallback = 'none') {
  const plan = String(value || fallback).trim().toLowerCase();
  return ['none', 'basic', 'standard', 'pro', 'premium', 'enterprise'].includes(plan) ? plan : fallback;
}

function normalizeFeatures(value = {}, defaults = DISABLED_FEATURES) {
  if (typeof value === 'string') {
    try {
      return normalizeFeatures(JSON.parse(value), defaults);
    } catch {
      return { ...defaults };
    }
  }
  return {
    ...defaults,
    ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
  };
}

function normalizeFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function aiMonthlyQuotaInvalidError() {
  const error = new Error('AI_MONTHLY_QUOTA_INVALID');
  error.code = 'AI_MONTHLY_QUOTA_INVALID';
  return error;
}

function parseAiMonthlyQuotaInput(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (!/^\d+$/.test(trimmed)) throw aiMonthlyQuotaInvalidError();
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed)) throw aiMonthlyQuotaInvalidError();
    return parsed;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  throw aiMonthlyQuotaInvalidError();
}

function isAiMonthlyQuotaExceeded(monthlyQuota, quotaUsed) {
  const quota = normalizeFiniteNumber(monthlyQuota);
  if (quota === null || quota <= 0) return false;

  const used = normalizeFiniteNumber(quotaUsed);
  if (used === null || used < 0) return false;

  return used >= quota;
}

function normalizeSettings(row = {}) {
  const aiEnabled = row.ai_enabled === true;
  const plan = normalizePlan(row.ai_plan || row.ai_tier || (aiEnabled ? 'standard' : 'none'), aiEnabled ? 'standard' : 'none');
  const runtimeEnabled = aiEnabled;
  const features = runtimeEnabled
    ? normalizeFeatures(row.ai_features_json, DEFAULT_FEATURES)
    : { ...DISABLED_FEATURES };
  return {
    ai_enabled: runtimeEnabled,
    ai_plan: runtimeEnabled ? plan : 'none',
    ai_tier: runtimeEnabled ? plan : 'none',
    ai_web_enabled: runtimeEnabled && (row.ai_web_enabled === undefined ? features.web_research !== false : bool(row.ai_web_enabled, true)),
    ai_report_enabled: runtimeEnabled && (row.ai_report_enabled === undefined ? features.report_enrichment !== false : bool(row.ai_report_enabled, true)),
    ai_auditor_enabled: runtimeEnabled && (row.ai_auditor_enabled === undefined ? features.auditor !== false : bool(row.ai_auditor_enabled, true)),
    ai_monthly_quota: normalizeFiniteNumber(row.ai_monthly_quota),
    ai_quota_used: normalizeFiniteNumber(row.ai_quota_used) ?? 0,
    ai_features_json: features,
  };
}

async function getTenantAiSettings(tenantId) {
  if (!tenantId) {
    return normalizeSettings({ ai_enabled: false, ai_plan: 'none' });
  }
  try {
    const result = await pool.query(
      `
      SELECT
        ai_enabled,
        ai_plan,
        ai_web_enabled,
        ai_report_enabled,
        ai_auditor_enabled,
        ai_monthly_quota,
        ai_quota_used,
        ai_features_json
      FROM tenants
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );
    return normalizeSettings(result.rows[0] || {});
  } catch (error) {
    if (['42703', '42P01'].includes(String(error.code || ''))) {
      return normalizeSettings({ ai_enabled: false, ai_plan: 'none' });
    }
    throw error;
  }
}

function featureKey(feature) {
  const key = String(feature || '').trim();
  const aliases = {
    reports: 'report_enrichment',
    report: 'report_enrichment',
    company_profile: 'company_profile_analysis',
    ai_auditor: 'auditor',
    web: 'web_research',
    documents: 'document_generation',
  };
  return aliases[key] || key || 'suggestions';
}

function capabilityForFeature(feature) {
  const key = featureKey(feature);
  if (key === 'auditor') return 'ai.auditor';
  return 'ai.compliance';
}

async function getTenantAiCommercialEntitlement(tenantId, feature) {
  if (!tenantId) {
    return {
      enabled: false,
      capability_key: capabilityForFeature(feature),
      reason_code: 'TENANT_REQUIRED',
    };
  }

  const capabilityKey = capabilityForFeature(feature);
  const entitlements = await resolveTenantEntitlements({ tenantId });
  const decision = entitlements.capabilities?.[capabilityKey] || null;
  const enabled = decision?.enabled === true && decision.module_active !== false;

  return {
    ...(decision || {}),
    enabled,
    capability_key: capabilityKey,
    reason_code: enabled ? (decision?.reason_code || 'ADDON_ENTITLED') : (decision?.reason_code || 'AI_ADDON_NOT_CONTRACTED'),
    addons: entitlements.addons || [],
  };
}

async function isTenantAiFeatureEnabled(tenantId, feature) {
  const [settings, commercial] = await Promise.all([
    getTenantAiSettings(tenantId),
    getTenantAiCommercialEntitlement(tenantId, feature),
  ]);
  const key = featureKey(feature);
  const quotaExceeded = isAiMonthlyQuotaExceeded(settings.ai_monthly_quota, settings.ai_quota_used);
  const featureEnabled = settings.ai_features_json?.[key] !== false;
  const runtimeEnabled = settings.ai_enabled === true;
  const specificEnabled =
    key === 'web_research' ? settings.ai_web_enabled !== false :
    key === 'report_enrichment' ? settings.ai_report_enabled !== false :
    key === 'auditor' ? settings.ai_auditor_enabled !== false :
    featureEnabled;
  const commercialEnabled = commercial.enabled === true;
  let reason = 'ai_enabled';
  if (!commercialEnabled) {
    reason = commercial.reason_code || 'AI_ADDON_NOT_CONTRACTED';
  } else if (!runtimeEnabled) {
    reason = 'ai_runtime_disabled';
  } else if (!specificEnabled) {
    reason = 'ai_feature_disabled';
  } else if (quotaExceeded) {
    reason = 'ai_quota_exceeded';
  }
  const enabled = reason === 'ai_enabled';
  return {
    enabled,
    feature: key,
    capability_key: commercial.capability_key,
    commercial,
    settings,
    reason,
  };
}

const AI_COMMERCIAL_DISABLED_REASONS = new Set([
  'ADDON_REQUIRED',
  'AI_ADDON_NOT_CONTRACTED',
  'AI_DISABLED_BY_PLAN',
  'ADDON_NOT_ACTIVE',
  'CAPABILITY_DISABLED',
  'CAPABILITY_NOT_ENTITLED',
  'MODULE_NOT_ACTIVE',
  'NO_ACTIVE_SUBSCRIPTION',
  'SUBSCRIPTION_REQUIRED',
  'TENANT_REQUIRED',
]);

function normalizeReasonCode(reason) {
  return String(reason || '').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function isAiDisabledByCommercialPlan(reason) {
  return AI_COMMERCIAL_DISABLED_REASONS.has(normalizeReasonCode(reason));
}

function aiDisabledCategory(reason) {
  const normalized = normalizeReasonCode(reason);
  if (AI_COMMERCIAL_DISABLED_REASONS.has(normalized)) return 'commercial';
  if (normalized === 'AI_RUNTIME_DISABLED') return 'runtime';
  if (normalized === 'AI_FEATURE_DISABLED') return 'feature';
  if (normalized === 'AI_QUOTA_EXCEEDED') return 'quota';
  return 'unknown';
}

function buildAiDisabledTrace({ tenantId, feature, requestId = null, modelMode = 'deterministic', reason = 'ai_disabled_by_plan' } = {}) {
  const disabledByPlan = isAiDisabledByCommercialPlan(reason);
  return {
    ai_engine_used: false,
    llm_used: false,
    used_llm: false,
    deterministic_mode: true,
    deterministic_fallback_used: true,
    fallback_used: false,
    ai_enrichment_failed: false,
    ai_disabled_by_plan: disabledByPlan,
    ai_disabled_reason: reason,
    ai_disabled_category: aiDisabledCategory(reason),
    feature,
    selected_model: null,
    model_mode: modelMode,
    llm_provider: null,
    used_web: false,
    used_rag: false,
    used_drive: false,
    used_company_profile: false,
    company_profile_impact_used: false,
    tenant_filter_enforced: Boolean(tenantId),
    filtered_by_tenant_id: Boolean(tenantId),
    applicability_universe_applied: false,
    duration_ms: 0,
    request_id: requestId,
    error_message: null,
  };
}

function normalizeAiSettingsPayload(body = {}) {
  const aiEnabled = bool(body.ai_enabled, false);
  if (!aiEnabled) {
    return {
      ai_enabled: false,
      ai_plan: 'none',
      ai_web_enabled: false,
      ai_report_enabled: false,
      ai_auditor_enabled: false,
      ai_monthly_quota: parseAiMonthlyQuotaInput(body.ai_monthly_quota),
      ai_features_json: { ...DISABLED_FEATURES },
    };
  }

  const features = normalizeFeatures(body.ai_features_json || body.ai_features || {}, DEFAULT_FEATURES);
  const webEnabled = bool(body.ai_web_enabled, features.web_research !== false);
  return {
    ai_enabled: true,
    ai_plan: normalizePlan(body.ai_plan || 'standard', 'standard'),
    ai_web_enabled: webEnabled,
    ai_report_enabled: bool(body.ai_report_enabled, features.report_enrichment !== false),
    ai_auditor_enabled: bool(body.ai_auditor_enabled, features.auditor !== false),
    ai_monthly_quota: parseAiMonthlyQuotaInput(body.ai_monthly_quota),
    ai_features_json: {
      ...features,
      web_research: webEnabled,
      report_enrichment: bool(body.ai_report_enabled, features.report_enrichment !== false),
      auditor: bool(body.ai_auditor_enabled, features.auditor !== false),
      company_profile_analysis: bool(features.company_profile_analysis, true),
      document_generation: bool(features.document_generation, true),
    },
  };
}

module.exports = {
  DEFAULT_FEATURES,
  DISABLED_FEATURES,
  getTenantAiSettings,
  getTenantAiCommercialEntitlement,
  isAiMonthlyQuotaExceeded,
  isTenantAiFeatureEnabled,
  buildAiDisabledTrace,
  normalizeAiSettingsPayload,
  _private: {
    aiDisabledCategory,
    isAiDisabledByCommercialPlan,
    normalizeFiniteNumber,
    parseAiMonthlyQuotaInput,
  },
};
