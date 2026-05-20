'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const aiContextBuilder = require('./aiContextBuilder.service');
const aiEngineClient = require('./aiEngineClient.service');
const { renderHtmlToPdf } = require('../reports/services/htmlPdfRenderer.service');
const { renderCompanyProfileContextTemplate } = require('../reports/templates/companyProfileContext.template');

function getUserTenantId(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function getUserId(user = {}) {
  return user.id || user.user_id || user.userId || user.sub || null;
}

function normalizeRole(user = {}) {
  return String(user.role || user.user_role || user.userRole || '').toLowerCase();
}

function isPlatform(user = {}) {
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(normalizeRole(user));
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boolOption(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 's', 'si', 'sí'].includes(String(value).trim().toLowerCase());
}

async function resolveTenantIdForUser(user = {}, requestedTenantId = null) {
  const ownTenantId = getUserTenantId(user);
  if (isPlatform(user) && requestedTenantId) return requestedTenantId;
  return ownTenantId;
}

async function getTenant(tenantId) {
  const result = await pool.query(
    `
    SELECT *
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  return result.rows[0] || null;
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    created_by_user_id: row.created_by_user_id,
    updated_by_user_id: row.updated_by_user_id,
    profile_json: row.profile_json || {},
    industry: row.industry || null,
    subindustry: row.subindustry || null,
    company_size: row.company_size || null,
    maturity_level: row.maturity_level || null,
    risk_appetite: row.risk_appetite || null,
    allow_web_research: row.allow_web_research === true,
    allow_document_context: row.allow_document_context !== false,
    allow_ai_recommendations: row.allow_ai_recommendations !== false,
    context_document_file_id: row.context_document_file_id || null,
    context_document_url: row.context_document_url || null,
    ai_profile_summary_json: row.ai_profile_summary_json || null,
    ai_research_trace_json: row.ai_research_trace_json || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getCompanyProfileForTenant(tenantId) {
  if (!tenantId) return null;
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM tenant_company_profiles
      WHERE tenant_id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );
    return serialize(result.rows[0]);
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
}

async function upsertCompanyProfile({ tenantId, userId = null, profile = {} }) {
  const profileJson = safeObject(profile.profile_json || profile);
  const industry = profile.industry || profileJson.industry || null;
  const subindustry = profile.subindustry || profileJson.subindustry || null;
  const companySize = profile.company_size || profileJson.company_size || null;
  const maturityLevel = profile.maturity_level || profileJson.current_maturity_level || profileJson.maturity_level || null;
  const riskAppetite = profile.risk_appetite || profileJson.risk_appetite || null;
  const allowWebResearch = boolOption(profile.allow_web_research ?? profileJson.allow_web_research, false);
  const allowDocumentContext = boolOption(profile.allow_document_context ?? profileJson.allow_document_context, true);
  const allowAiRecommendations = boolOption(profile.allow_ai_recommendations ?? profileJson.allow_ai_recommendations, true);

  const result = await pool.query(
    `
    INSERT INTO tenant_company_profiles (
      tenant_id,
      created_by_user_id,
      updated_by_user_id,
      profile_json,
      industry,
      subindustry,
      company_size,
      maturity_level,
      risk_appetite,
      allow_web_research,
      allow_document_context,
      allow_ai_recommendations,
      updated_at
    )
    VALUES ($1::uuid, $2::uuid, $2::uuid, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      profile_json = EXCLUDED.profile_json,
      industry = EXCLUDED.industry,
      subindustry = EXCLUDED.subindustry,
      company_size = EXCLUDED.company_size,
      maturity_level = EXCLUDED.maturity_level,
      risk_appetite = EXCLUDED.risk_appetite,
      allow_web_research = EXCLUDED.allow_web_research,
      allow_document_context = EXCLUDED.allow_document_context,
      allow_ai_recommendations = EXCLUDED.allow_ai_recommendations,
      updated_at = now()
    RETURNING *
    `,
    [
      tenantId,
      userId,
      JSON.stringify(profileJson),
      industry,
      subindustry,
      companySize,
      maturityLevel,
      riskAppetite,
      allowWebResearch,
      allowDocumentContext,
      allowAiRecommendations,
    ]
  );

  console.info('COMPANY PROFILE SAVE:', {
    tenant_id: tenantId,
    user_id: userId,
    industry,
    allow_web_research: allowWebResearch,
    allow_document_context: allowDocumentContext,
  });

  return serialize(result.rows[0]);
}

function buildCompanyProfileStructuredFallback(profile = {}, context = {}) {
  const profileJson = profile.profile_json || {};
  return {
    normalized_company_profile: profileJson,
    executive_narrative: `Perfil empresa registrado para ${profileJson.company_name || context.tenant?.name || 'el tenant'}. Se usará como contexto para reportes, auditorías y recomendaciones.`,
    industry_assumptions: [],
    iso_scope_recommendations: profileJson.audit_scope || 'Definir alcance, exclusiones, procesos críticos, sedes y límites de responsabilidad.',
    proposed_objectives: profileJson.quality_objectives || profileJson.strategic_objectives || [],
    proposed_kpis: [],
    suggested_controls: [],
    typical_industry_risks: profileJson.known_weaknesses || profileJson.pain_points || [],
    suggested_evidence_baseline: [],
    maturity_baseline: profileJson.current_maturity_level || '',
    audit_focus_areas: [],
    corrective_action_themes: [],
    improvement_roadmap: profileJson.improvement_priorities || [],
    limitations: ['Análisis determinístico de respaldo; validar con revisión humana y evidencia interna.'],
    confidence: 0.55,
  };
}

async function analyzeCompanyProfile({ tenantId, userId = null, requestId = null, modelMode = 'balanced' }) {
  const profile = await getCompanyProfileForTenant(tenantId);
  if (!profile) {
    const error = new Error('Perfil empresa no existe para este tenant');
    error.code = 'COMPANY_PROFILE_NOT_FOUND';
    throw error;
  }

  console.info('COMPANY PROFILE AI ANALYSIS START:', {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    model_mode: modelMode,
    allow_web_research: profile.allow_web_research,
    allow_document_context: profile.allow_document_context,
  });

  const context = await aiContextBuilder.buildAiTenantContext({ tenantId });
  context.company_profile = profile;
  const payload = {
    tenant_id: tenantId,
    task_type: 'company_profile_context',
    module_origin: 'company_profile',
    question: [
      'Analiza el perfil empresa como contexto de organización ISO.',
      'Devuelve JSON estructurado con normalized_company_profile, industry_assumptions, ISO scope recommendations, proposed objectives, proposed KPIs, suggested controls, typical industry risks, suggested evidence baseline, maturity baseline, audit focus areas, corrective action themes, improvement roadmap, limitations y trace.',
      'No inventes cumplimiento ni evidencia; usa los datos internos y el perfil como calibración.',
    ].join(' '),
    locale: 'es',
    context,
    options: {
      local_compact: true,
      fast_mode: false,
      use_llm: true,
      model_mode: modelMode === 'deep' ? 'deep' : 'balanced',
      depth: modelMode === 'deep' ? 'deep' : 'standard',
      use_rag: true,
      use_web: profile.allow_web_research === true,
      use_drive: profile.allow_document_context === true,
      used_company_profile: true,
      return_structured_result: true,
    },
    request_metadata: {
      request_id: requestId,
      module: 'company_profile',
      used_company_profile: true,
    },
  };

  const aiResult = profile.allow_ai_recommendations
    ? await aiEngineClient.analyzeReport(payload)
    : null;
  const engine = aiResult?.engine || {};
  const structured = aiResult?.structured_result || buildCompanyProfileStructuredFallback(profile, context);
  const fallbackUsed = !aiResult || aiResult?.ok === false || String(engine.model || '').toLowerCase() === 'backend_fallback';
  const trace = {
    ai_engine_used: Boolean(aiResult),
    used_llm: engine.used_llm === true && !fallbackUsed,
    llm_provider: engine.llm_provider || null,
    selected_model: engine.selected_model || engine.model || null,
    model_mode: modelMode,
    used_rag: engine.used_rag === true,
    used_web: engine.used_web === true,
    used_drive: engine.used_drive === true,
    used_company_profile: true,
    fallback_used: fallbackUsed,
    ai_enrichment_failed: fallbackUsed,
    duration_ms: engine.duration_ms || aiResult?.metrics?.duration_ms || null,
    request_id: requestId,
    limitations: aiResult?.limitations || structured.limitations || [],
  };

  const result = await pool.query(
    `
    UPDATE tenant_company_profiles
    SET ai_profile_summary_json = $2::jsonb,
        ai_research_trace_json = $3::jsonb,
        updated_by_user_id = $4::uuid,
        updated_at = now()
    WHERE tenant_id = $1::uuid
    RETURNING *
    `,
    [tenantId, JSON.stringify(structured), JSON.stringify(trace), userId]
  );

  console.info('COMPANY PROFILE AI ANALYSIS OK:', {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    model_mode: modelMode,
    selected_model: trace.selected_model,
    used_llm: trace.used_llm,
    used_web: trace.used_web,
    used_company_profile: true,
    fallback_used: trace.fallback_used,
    duration_ms: trace.duration_ms,
  });

  return serialize(result.rows[0]);
}

async function exportCompanyProfileContextPdf({ tenantId, userId = null, requestId = null }) {
  const [profile, tenant] = await Promise.all([
    getCompanyProfileForTenant(tenantId),
    getTenant(tenantId),
  ]);
  if (!profile) {
    const error = new Error('Perfil empresa no existe para este tenant');
    error.code = 'COMPANY_PROFILE_NOT_FOUND';
    throw error;
  }

  const tenantFolder = path.join(__dirname, '..', '..', 'uploads', 'company-profile', String(tenantId));
  fs.mkdirSync(tenantFolder, { recursive: true });
  const fileId = crypto.randomUUID();
  const outputPath = path.join(tenantFolder, `contexto-organizacion-${fileId}.pdf`);
  const html = renderCompanyProfileContextTemplate({
    ...(profile || {}),
    tenant: tenant || { id: tenantId, name: profile.profile_json?.company_name || 'Cliente' },
  });

  const renderResult = await renderHtmlToPdf({
    html,
    outputPath,
    requestId,
    metadata: {
      templateName: 'companyProfileContext',
      ai_engine_used: profile.ai_research_trace_json?.ai_engine_used ?? null,
      used_llm: profile.ai_research_trace_json?.used_llm ?? null,
      model_mode: profile.ai_research_trace_json?.model_mode ?? null,
      selected_model: profile.ai_research_trace_json?.selected_model ?? null,
      fallback_used: profile.ai_research_trace_json?.fallback_used ?? null,
    },
    timeoutMs: Number.parseInt(process.env.PDF_RENDER_TIMEOUT_MS || '300000', 10) || 300000,
    minBytes: 20 * 1024,
  });

  const downloadUrl = '/api/company-profile/context-document/download';
  const updated = await pool.query(
    `
    UPDATE tenant_company_profiles
    SET context_document_file_id = $2::uuid,
        context_document_url = $3,
        updated_by_user_id = $4::uuid,
        updated_at = now()
    WHERE tenant_id = $1::uuid
    RETURNING *
    `,
    [tenantId, fileId, outputPath, userId]
  );

  console.info('COMPANY PROFILE CONTEXT PDF GENERATED:', {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    render_engine: 'puppeteer',
    output_path: outputPath,
    file_size: renderResult.file_size,
  });

  return {
    profile: serialize(updated.rows[0]),
    file_id: fileId,
    download_url: downloadUrl,
    output_path: outputPath,
    file_size: renderResult.file_size,
  };
}

async function getCompanyProfileForRequest(req, requestedTenantId = null) {
  const tenantId = await resolveTenantIdForUser(req.user, requestedTenantId);
  if (!tenantId) {
    const error = new Error('Tenant no identificado');
    error.code = 'TENANT_REQUIRED';
    throw error;
  }
  return { tenantId, userId: getUserId(req.user) };
}

module.exports = {
  getUserTenantId,
  getUserId,
  isPlatform,
  resolveTenantIdForUser,
  getCompanyProfileForTenant,
  getCompanyProfileForRequest,
  upsertCompanyProfile,
  analyzeCompanyProfile,
  exportCompanyProfileContextPdf,
};
