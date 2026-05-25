'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const aiContextBuilder = require('./aiContextBuilder.service');
const aiEngineClient = require('./aiEngineClient.service');
const { buildCompanyProfileImpact } = require('./companyProfileImpact.service');
const {
  isTenantAiFeatureEnabled,
  buildAiDisabledTrace,
} = require('./tenantAiSettings.service');
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

function compactArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function parseJsonLikeString(value) {
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (!text) return null;
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  if (!text.startsWith('{') && text.includes('{') && text.includes('}')) {
    text = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  }
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractCompanyProfileAiStructured(aiResult = {}, profile = {}, context = {}) {
  const parsedAnswer = parseJsonLikeString(aiResult.answer);
  const answerStructured = parsedAnswer && typeof parsedAnswer === 'object'
    ? {
        ...safeObject(parsedAnswer),
        ...safeObject(parsedAnswer.structured_result),
      }
    : {};
  const structured = safeObject(aiResult.structured_result);
  const topLevel = {
    normalized_company_profile: aiResult.normalized_company_profile,
    tenant_applied_context_summary: aiResult.tenant_applied_context_summary,
    executive_narrative: aiResult.executive_narrative || aiResult.executive_summary || aiResult.summary,
    company_context_diagnosis: aiResult.company_context_diagnosis || aiResult.diagnosis,
    industry_assumptions: aiResult.industry_assumptions,
    industry_references: aiResult.industry_references,
    iso_scope_recommendations: aiResult.iso_scope_recommendations,
    proposed_objectives: aiResult.proposed_objectives,
    proposed_kpis: aiResult.proposed_kpis,
    suggested_controls: aiResult.suggested_controls,
    typical_industry_risks: aiResult.typical_industry_risks,
    suggested_evidence_baseline: aiResult.suggested_evidence_baseline,
    maturity_baseline: aiResult.maturity_baseline,
    audit_focus_areas: aiResult.audit_focus_areas,
    corrective_action_themes: aiResult.corrective_action_themes,
    improvement_roadmap: aiResult.improvement_roadmap,
    risk_and_gap_analysis: aiResult.risk_and_gap_analysis,
    nonconformity_and_finding_analysis: aiResult.nonconformity_and_finding_analysis,
    evidence_baseline: aiResult.evidence_baseline,
    management_focus: aiResult.management_focus,
    external_references: aiResult.external_references || aiResult.industry_references,
    data_quality_limitations: aiResult.data_quality_limitations,
    what_not_to_conclude: aiResult.what_not_to_conclude,
    external_context: aiResult.external_context,
    web_research_summary: aiResult.web_research_summary,
    web_sources: aiResult.web_sources,
    document_context_summary: aiResult.document_context_summary,
    limitations: aiResult.limitations,
    confidence: aiResult.confidence,
  };
  const cleanedTopLevel = Object.fromEntries(
    Object.entries(topLevel).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const merged = { ...answerStructured, ...structured, ...cleanedTopLevel };

  if (!Object.keys(merged).length) {
    return buildCompanyProfileStructuredFallback(profile, context);
  }

  return {
    ...merged,
    industry_assumptions: compactArray(merged.industry_assumptions),
    industry_references: compactArray(merged.industry_references || merged.web_sources),
    proposed_objectives: compactArray(merged.proposed_objectives),
    proposed_kpis: compactArray(merged.proposed_kpis),
    suggested_controls: compactArray(merged.suggested_controls),
    typical_industry_risks: compactArray(merged.typical_industry_risks),
    suggested_evidence_baseline: compactArray(merged.suggested_evidence_baseline),
    risk_and_gap_analysis: compactArray(merged.risk_and_gap_analysis),
    nonconformity_and_finding_analysis: compactArray(merged.nonconformity_and_finding_analysis),
    evidence_baseline: compactArray(merged.evidence_baseline || merged.suggested_evidence_baseline),
    management_focus: compactArray(merged.management_focus),
    audit_focus_areas: compactArray(merged.audit_focus_areas),
    corrective_action_themes: compactArray(merged.corrective_action_themes),
    improvement_roadmap: compactArray(merged.improvement_roadmap),
    external_references: compactArray(merged.external_references || merged.industry_references || merged.web_sources),
    data_quality_limitations: compactArray(merged.data_quality_limitations || merged.limitations),
    what_not_to_conclude: compactArray(merged.what_not_to_conclude),
    limitations: compactArray(merged.limitations),
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

  const profileJson = profile.profile_json || {};
  const standardCodes = compactArray(profileJson.active_standards || profileJson.target_standards);
  const context = await aiContextBuilder.buildCompanyProfileAiContext({
    tenantId,
    standardCodes,
  });
  context.company_profile = profile;
  const normalizedModelMode = modelMode === 'deep' ? 'deep' : 'balanced';
  const internalCounts = context.internal_context_counts || {};
  const payload = {
    tenant_id: tenantId,
    user_id: userId,
    task_type: 'company_profile_context',
    module_origin: 'company_profile',
    question: [
      'Actúa como auditor senior ISO y consultor de mejora continua.',
      'Usa primero datos internos reales del tenant autenticado: controles, salud, KPIs, riesgos, no conformidades, hallazgos, planes de acción, evidencias, auditorías y documentos.',
      'No mezcles tenants, no inventes evidencia y no afirmes cumplimiento sin evidencia interna suficiente.',
      'Usa referencias externas sólo como apoyo contextual, nunca como evidencia interna ni fuente de cumplimiento.',
      'Cada recomendación debe conectarse a un dato interno real, ausencia de dato, riesgo, control, KPI, no conformidad, hallazgo, evidencia o brecha explícita.',
      'Si falta el dato, declara “No hay evidencia interna suficiente” y pide la evidencia requerida.',
      'Devuelve exclusivamente JSON estructurado aplicable a esta empresa específica.',
    ].join(' '),
    locale: 'es',
    model_mode: normalizedModelMode,
    use_llm: true,
    use_rag: true,
    use_web: profile.allow_web_research === true,
    allow_web_research: profile.allow_web_research === true,
    use_drive: profile.allow_document_context === true,
    allow_document_context: profile.allow_document_context === true,
    used_company_profile: true,
    company_profile: profile,
    company_profile_impact: context.company_profile_impact,
    company_applicability_universe: context.company_applicability_universe,
    applicable_controls: context.applicable_controls || [],
    applicable_kpis: context.applicable_kpis || [],
    applicable_evidence_requirements: context.applicable_evidence_requirements || [],
    applicability_exclusions_summary: context.applicability_exclusions_summary || [],
    company_profile_trace: context.company_profile_trace,
    tenant_context: context.tenant_context,
    iso_context: context.iso_context,
    controls_context: context.controls_context,
    health_context: context.health_context,
    kpi_context: context.kpi_context,
    risk_context: context.risk_context,
    nonconformity_context: context.nonconformity_context,
    finding_context: context.finding_context,
    action_plan_context: context.action_plan_context,
    evidence_context: context.evidence_context,
    audit_context: context.audit_context,
    document_context: context.document_context,
    data_quality_context: context.data_quality_context,
    maturity_signals: context.maturity_signals,
    active_standards: context.active_standards,
    tenant_controls: context.tenant_controls,
    control_health: context.control_health,
    kpi_summary: context.kpi_summary,
    kpi_snapshots: context.kpi_snapshots,
    nonconformities: context.nonconformities,
    findings: context.findings,
    action_plans: context.action_plans,
    evidences: context.evidences,
    risks: context.risks,
    audits: context.audits,
    document_sources: context.document_sources,
    source_trace: context.source_trace,
    industry: profile.industry || profile.profile_json?.industry || '',
    subindustry: profile.subindustry || profile.profile_json?.subindustry || '',
    company_size: profile.company_size || profile.profile_json?.company_size || '',
    maturity_level: profile.maturity_level || profile.profile_json?.current_maturity_level || '',
    risk_appetite: profile.risk_appetite || profile.profile_json?.risk_appetite || '',
    context,
    stats: {
      internal_context_counts: internalCounts,
      controls_analyzed: internalCounts.controls_analyzed || 0,
      kpis_analyzed: internalCounts.kpis_analyzed || 0,
      risks_analyzed: internalCounts.risks_analyzed || 0,
      nonconformities_analyzed: internalCounts.nonconformities_analyzed || 0,
      findings_analyzed: internalCounts.findings_analyzed || 0,
      action_plans_analyzed: internalCounts.action_plans_analyzed || 0,
      evidences_analyzed: internalCounts.evidences_analyzed || 0,
      audits_analyzed: internalCounts.audits_analyzed || 0,
    },
    web_context_topics: [
      profile.industry,
      profile.subindustry,
      ...(context.active_standards || []),
      ...(context.controls_context?.top_controls_by_low_health || []).map((item) => item.control_description || item.category || item.clause),
      ...(context.nonconformity_context?.open_nonconformities || []).map((item) => item.title || item.description),
      ...(context.finding_context?.open_findings || []).map((item) => item.title || item.description),
      ...(context.kpi_context?.kpis_below_target || []).map((item) => item.kpi_name || item.kpi_code),
    ].filter(Boolean).slice(0, 12),
    requested_output_schema: {
      tenant_applied_context_summary: true,
      company_context_diagnosis: true,
      proposed_objectives: 'array of objects with objective, reason, linked_internal_signal, suggested_kpi, target, period, owner_role, required_evidence',
      proposed_kpis: 'array of objects with kpi, reason, formula, source_data_needed, linked_control_or_process, target_suggestion, frequency',
      suggested_controls: 'array of objects with control, reason, linked_standard, linked_internal_gap, priority, required_evidence, implementation_hint',
      risk_and_gap_analysis: true,
      nonconformity_and_finding_analysis: true,
      evidence_baseline: true,
      improvement_roadmap: '30/60/90 days',
      data_quality_limitations: true,
      what_not_to_conclude: true,
    },
    options: {
      local_compact: true,
      fast_mode: false,
      use_llm: true,
      model_mode: normalizedModelMode,
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
      model_mode: normalizedModelMode,
      use_web: profile.allow_web_research === true,
      used_company_profile: true,
      internal_context_counts: internalCounts,
    },
  };

  const aiAccess = await isTenantAiFeatureEnabled(tenantId, 'company_profile_analysis');
  let aiResult = null;
  let aiError = null;
  if (!aiAccess.enabled) {
    const trace = buildAiDisabledTrace({
      tenantId,
      feature: 'company_profile_analysis',
      requestId,
      modelMode: normalizedModelMode,
      reason: aiAccess.reason,
    });
    aiResult = {
      ok: true,
      source: 'deterministic-ai-disabled-by-plan',
      structured_result: buildCompanyProfileStructuredFallback(profile, context),
      trace,
      engine: trace,
      metrics: trace,
      limitations: ['IA no habilitada para este plan/empresa. Se conserva contexto interno determinístico.'],
    };
  } else if (profile.allow_ai_recommendations) {
    try {
      aiResult = await aiEngineClient.analyzeCompanyProfile(payload, {
        timeoutMs: modelMode === 'deep'
          ? Number.parseInt(process.env.AI_COMPANY_PROFILE_ANALYSIS_TIMEOUT_MS || process.env.REPORT_DEEP_JOB_TIMEOUT_MS || '900000', 10)
          : Number.parseInt(process.env.AI_COMPANY_PROFILE_ANALYSIS_TIMEOUT_MS || process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS || process.env.AI_ENGINE_REQUEST_TIMEOUT_MS || '600000', 10),
      });
    } catch (error) {
      aiError = error;
    }
  }
  const engine = safeObject(aiResult?.trace || aiResult?.engine || {});
  const structured = aiResult && aiResult?.ok !== false
    ? extractCompanyProfileAiStructured(aiResult, profile, context)
    : buildCompanyProfileStructuredFallback(profile, context);
  const selectedModel = engine.selected_model || engine.model_name || engine.model || null;
  const aiDisabledByPlan = engine.ai_disabled_by_plan === true;
  const fallbackUsed = !aiDisabledByPlan && (!aiResult ||
    aiResult?.ok === false ||
    engine.fallback_used === true ||
    String(selectedModel || '').toLowerCase() === 'backend_fallback');
  const trace = {
    source: aiResult?.source || (fallbackUsed ? 'backend_company_profile_fallback' : 'ai-engine-company-profile-analyze'),
    ai_engine_used: !aiDisabledByPlan && (aiResult?.ok === true || engine.ai_engine_used === true),
    llm_used: engine.llm_used === true && !fallbackUsed,
    used_llm: engine.llm_used === true && !fallbackUsed,
    deterministic_mode: engine.deterministic_mode === true || aiDisabledByPlan,
    ai_disabled_by_plan: aiDisabledByPlan,
    ai_disabled_reason: engine.ai_disabled_reason || null,
    llm_provider: engine.llm_provider || null,
    selected_model: aiDisabledByPlan ? null : (fallbackUsed ? 'backend_fallback' : selectedModel),
    model_mode: normalizedModelMode,
    used_rag: engine.used_rag === true,
    used_web: engine.used_web === true,
    used_drive: engine.used_drive === true || engine.used_documents === true,
    used_documents: engine.used_documents === true || engine.used_drive === true,
    used_company_profile: true,
    fallback_used: fallbackUsed,
    ai_enrichment_failed: fallbackUsed,
    duration_ms: engine.duration_ms || aiResult?.metrics?.duration_ms || null,
    web_results_count: engine.web_results_count || aiResult?.external_context?.web_results_count || 0,
    trusted_results_count: engine.trusted_results_count || aiResult?.external_context?.trusted_results_count || 0,
    internal_context_counts: engine.internal_context_counts || aiResult?.tenant_applied_context_summary || internalCounts,
    tenant_id: tenantId,
    timeout_stage: engine.timeout_stage || (aiError?.name === 'AbortError' ? 'backend_to_ai_engine' : null),
    timeout_ms: engine.timeout_ms || aiError?.timeout_ms || null,
    error_type: engine.error_type || aiError?.code || aiError?.name || null,
    error_message: engine.error_message || (aiError?.message ? String(aiError.message).slice(0, 500) : null),
    request_id: requestId,
    limitations: fallbackUsed
      ? ['El análisis IA no se completó; se conserva contexto interno y se requiere reintento para enriquecimiento IA real.']
      : (aiResult?.limitations || structured.limitations || []),
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

  console.info(fallbackUsed ? 'COMPANY PROFILE AI ANALYSIS COMPLETED WITH FALLBACK:' : 'COMPANY PROFILE AI ANALYSIS OK:', {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    model_mode: modelMode,
    selected_model: trace.selected_model,
    used_llm: trace.used_llm,
    used_web: trace.used_web,
    used_company_profile: true,
    fallback_used: trace.fallback_used,
    ai_enrichment_failed: trace.ai_enrichment_failed,
    timeout_stage: trace.timeout_stage,
    timeout_ms: trace.timeout_ms,
    duration_ms: trace.duration_ms,
  });

  return serialize(result.rows[0]);
}

async function exportCompanyProfileContextPdf({ tenantId, userId = null, requestId = null }) {
  const [profile, tenant, impact] = await Promise.all([
    getCompanyProfileForTenant(tenantId),
    getTenant(tenantId),
    buildCompanyProfileImpact({ tenantId }),
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
    company_profile_impact: impact,
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
