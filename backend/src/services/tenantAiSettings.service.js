'use strict';

const pool = require('../config/db');

const DEFAULT_FEATURES = Object.freeze({
  company_profile_analysis: true,
  report_enrichment: true,
  auditor: true,
  web_research: true,
  document_generation: true,
  suggestions: true,
});

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizePlan(value) {
  const plan = String(value || 'standard').trim().toLowerCase();
  return ['none', 'basic', 'standard', 'pro', 'premium', 'enterprise'].includes(plan) ? plan : 'standard';
}

function normalizeFeatures(value = {}) {
  if (typeof value === 'string') {
    try {
      return normalizeFeatures(JSON.parse(value));
    } catch {
      return { ...DEFAULT_FEATURES };
    }
  }
  return {
    ...DEFAULT_FEATURES,
    ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
  };
}

function normalizeSettings(row = {}) {
  const features = normalizeFeatures(row.ai_features_json);
  const aiEnabled = row.ai_enabled !== false;
  return {
    ai_enabled: aiEnabled,
    ai_plan: normalizePlan(row.ai_plan || row.ai_tier || (aiEnabled ? 'standard' : 'none')),
    ai_tier: normalizePlan(row.ai_plan || row.ai_tier || (aiEnabled ? 'standard' : 'none')),
    ai_web_enabled: row.ai_web_enabled === undefined ? features.web_research !== false : bool(row.ai_web_enabled, true),
    ai_report_enabled: row.ai_report_enabled === undefined ? features.report_enrichment !== false : bool(row.ai_report_enabled, true),
    ai_auditor_enabled: row.ai_auditor_enabled === undefined ? features.auditor !== false : bool(row.ai_auditor_enabled, true),
    ai_monthly_quota: row.ai_monthly_quota === null || row.ai_monthly_quota === undefined ? null : Number(row.ai_monthly_quota),
    ai_quota_used: Number(row.ai_quota_used || 0),
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
      return normalizeSettings({});
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

async function isTenantAiFeatureEnabled(tenantId, feature) {
  const settings = await getTenantAiSettings(tenantId);
  const key = featureKey(feature);
  const quotaExceeded =
    settings.ai_monthly_quota !== null &&
    Number(settings.ai_monthly_quota) >= 0 &&
    Number(settings.ai_quota_used || 0) >= Number(settings.ai_monthly_quota);
  const featureEnabled = settings.ai_features_json?.[key] !== false;
  const planEnabled = settings.ai_enabled === true && settings.ai_plan !== 'none';
  const specificEnabled =
    key === 'web_research' ? settings.ai_web_enabled !== false :
    key === 'report_enrichment' ? settings.ai_report_enabled !== false :
    key === 'auditor' ? settings.ai_auditor_enabled !== false :
    featureEnabled;
  const enabled = planEnabled && specificEnabled && !quotaExceeded;
  return {
    enabled,
    feature: key,
    settings,
    reason: enabled
      ? 'ai_enabled'
      : (quotaExceeded ? 'ai_quota_exceeded' : (planEnabled ? 'ai_feature_disabled' : 'ai_disabled_by_plan')),
  };
}

function buildAiDisabledTrace({ tenantId, feature, requestId = null, modelMode = 'deterministic', reason = 'ai_disabled_by_plan' } = {}) {
  return {
    ai_engine_used: false,
    llm_used: false,
    used_llm: false,
    deterministic_mode: true,
    deterministic_fallback_used: true,
    fallback_used: false,
    ai_enrichment_failed: false,
    ai_disabled_by_plan: true,
    ai_disabled_reason: reason,
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
  const features = normalizeFeatures(body.ai_features_json || body.ai_features || {});
  const aiEnabled = bool(body.ai_enabled, true);
  const webEnabled = bool(body.ai_web_enabled, features.web_research !== false && aiEnabled);
  return {
    ai_enabled: aiEnabled,
    ai_plan: normalizePlan(body.ai_plan || (aiEnabled ? 'standard' : 'none')),
    ai_web_enabled: webEnabled,
    ai_report_enabled: bool(body.ai_report_enabled, features.report_enrichment !== false && aiEnabled),
    ai_auditor_enabled: bool(body.ai_auditor_enabled, features.auditor !== false && aiEnabled),
    ai_monthly_quota: body.ai_monthly_quota === '' || body.ai_monthly_quota === undefined ? null : Number(body.ai_monthly_quota),
    ai_features_json: {
      ...features,
      web_research: webEnabled,
      report_enrichment: bool(body.ai_report_enabled, features.report_enrichment !== false && aiEnabled),
      auditor: bool(body.ai_auditor_enabled, features.auditor !== false && aiEnabled),
      company_profile_analysis: bool(features.company_profile_analysis, aiEnabled),
      document_generation: bool(features.document_generation, aiEnabled),
    },
  };
}

module.exports = {
  DEFAULT_FEATURES,
  getTenantAiSettings,
  isTenantAiFeatureEnabled,
  buildAiDisabledTrace,
  normalizeAiSettingsPayload,
};
