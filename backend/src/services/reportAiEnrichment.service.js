const aiContextBuilder = require('./aiContextBuilder.service');
const aiEngineClient = require('./aiEngineClient.service');
const { createAiTimer, resolveAiMode } = require('./aiRuntimeMetrics.service');
const { getCompanyProfileForTenant } = require('./companyProfile.service');
const { buildCompanyProfileImpact } = require('./companyProfileImpact.service');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function emptyEnrichment({ reportType, metrics, limitation }) {
  return {
    ok: false,
    answer: '',
    structured_result: {},
    executive_summary: '',
    key_findings: [],
    recommended_actions: [],
    root_cause_analysis: [],
    corrective_actions: [],
    evidence_requests: [],
    audit_questions: [],
    management_focus: [],
    audit_readiness: {},
    confidence: 0,
    limitations: [limitation || 'Enriquecimiento IA no disponible; reporte generado con datos internos.'],
    source_trace: [],
    ai_enrichment_failed: true,
    fallback_used: true,
    engine: {
      fast_mode: true,
      used_llm: false,
      local_compact: true,
    },
    metrics: {
      ...(metrics || {}),
      mode: metrics?.mode || 'fast_mode',
      report_type: reportType,
    },
  };
}

function normalizeModelMode(value) {
  const mode = String(value || 'fast').trim().toLowerCase();
  return ['fast', 'balanced', 'deep'].includes(mode) ? mode : 'fast';
}

function boolOption(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 's'].includes(String(value).trim().toLowerCase());
}

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    return text(value.title || value.name || value.label || value.description || value.summary, fallback);
  }
  return fallback;
}

function priority(value, fallback = 'media') {
  const raw = String(value || fallback).trim().toLowerCase();
  if (['alta', 'high', 'critica', 'critical'].includes(raw)) return 'alta';
  if (['baja', 'low'].includes(raw)) return 'baja';
  return 'media';
}

function normalizeStringList(value, limit = 6) {
  return asArray(value).map((item) => text(item)).filter(Boolean).slice(0, limit);
}

function buildFallbackRootCause(gaps = [], actions = []) {
  const source = gaps.length ? gaps : actions;
  return source.slice(0, 5).map((item, index) => ({
    issue: text(item.title || item.issue || item.description, `Brecha prioritaria ${index + 1}`),
    probable_cause: text(
      item.probable_cause || item.cause,
      'Evidencia insuficiente, trazabilidad incompleta o responsable de cierre no formalizado.'
    ),
    evidence_basis: text(
      item.evidence_basis || item.evidence_status,
      'Datos internos TCDX: controles, evidencias, hallazgos, planes de acción y KPIs disponibles.'
    ),
    risk_if_not_corrected: text(
      item.risk_if_not_corrected || item.business_impact || item.risk_impact,
      'Riesgo de observación o no conformidad por falta de evidencia objetiva y cierre verificable.'
    ),
    recommended_corrective_action: text(
      item.recommended_corrective_action || item.recommendation || item.description,
      'Formalizar evidencia, asignar responsable, cerrar brecha y validar eficacia con revisión humana.'
    ),
    owner_role: text(item.owner_role || item.suggested_owner_role, 'Responsable del proceso y auditor interno'),
    due_days: Number(item.due_days || item.deadline_days || 15),
    effectiveness_criteria: text(
      item.effectiveness_criteria || item.effectiveness_check,
      'Evidencia vigente aprobada, control operando y mejora reflejada en trazabilidad/KPI del periodo siguiente.'
    ),
  }));
}

function buildFallbackCorrectiveActions(actions = [], rootCauses = []) {
  const source = actions.length ? actions : rootCauses;
  return source.slice(0, 6).map((item, index) => ({
    title: text(item.title || item.issue || item.action, `Acción correctiva ${index + 1}`),
    priority: priority(item.priority || item.severity),
    description: text(
      item.description || item.recommended_action || item.recommended_corrective_action,
      'Ejecutar corrección documentada con responsable, plazo, evidencia de cierre y validación de eficacia.'
    ),
    owner_role: text(item.owner_role || item.suggested_owner_role, 'Responsable del proceso'),
    due_days: Number(item.due_days || item.deadline_days || 15),
    required_evidence: normalizeStringList(item.required_evidence || item.acceptance_criteria, 4),
    closure_criteria: normalizeStringList(item.closure_criteria || item.acceptance_criteria, 4),
    effectiveness_check: text(
      item.effectiveness_check || item.effectiveness_criteria,
      'Revisión humana posterior y evidencia de que la causa no se repite en el siguiente ciclo.'
    ),
  }));
}

function buildFallbackEvidenceRequests(structured = {}) {
  const assessment = structured.evidence_assessment || {};
  const raw = [
    ...asArray(structured.evidence_requests),
    ...asArray(assessment.missing_evidence),
    ...asArray(structured.documents_to_request),
  ];
  return raw.slice(0, 8).map((item, index) => ({
    title: text(item.title || item.evidence || item, `Evidencia requerida ${index + 1}`),
    reason: text(
      item.reason || item.description,
      'Necesaria para demostrar ejecución real, periodo cubierto, responsable y resultado verificable.'
    ),
    priority: priority(item.priority || item.severity, index < 3 ? 'alta' : 'media'),
    related_clause: text(item.related_clause || item.clause, ''),
    related_control: text(item.related_control || item.control || item.control_name, ''),
  }));
}

function buildFallbackAuditQuestions(structured = {}) {
  const raw = [
    ...asArray(structured.audit_questions),
    ...asArray(structured.audit_readiness?.auditor_concerns),
  ];
  return raw.slice(0, 6).map((item) => ({
    question: text(item.question || item),
    why_it_matters: text(item.why_it_matters, 'Permite confirmar suficiencia, trazabilidad y eficacia del control.'),
    expected_answer_or_evidence: text(
      item.expected_answer_or_evidence,
      'Evidencia objetiva vigente, responsable formal, periodo auditado y criterio de aceptación.'
    ),
  })).filter((item) => item.question);
}

function buildManagementFocus(structured = {}, actions = []) {
  return normalizeStringList([
    ...asArray(structured.management_focus),
    ...actions.map((item) => item.title || item.description),
    structured.risk_impact,
  ], 6);
}

function isBackendFallback(aiResult = {}, engine = {}) {
  const model = String(engine.model || aiResult?.model_name || '').toLowerCase();
  return (
    aiResult?.ok === false ||
    model === 'backend_fallback' ||
    engine.fallback_used === true ||
    engine.ai_enrichment_failed === true
  );
}

async function buildReportAiEnrichment({
  tenantId,
  standardCode = null,
  operationId = null,
  reportType = 'executive',
  depth = 'executive',
  includeDeepLlm = false,
  modelMode = 'fast',
  useLlm = false,
  useRag = true,
  useWeb = false,
  useDrive = 'auto',
  quality = null,
  requestId = null,
} = {}) {
  const normalizedModelMode = normalizeModelMode(modelMode);
  const requestedLlm = boolOption(useLlm, normalizedModelMode !== 'fast' || includeDeepLlm);
  const useDeepPath = includeDeepLlm || requestedLlm || normalizedModelMode !== 'fast';
  const timer = createAiTimer({
    endpoint: 'report-ai-enrichment',
    mode: useDeepPath ? 'llm' : 'fast_mode',
    tenantId,
    operationId,
    standardCode,
  });

  if (!tenantId) {
    return emptyEnrichment({
      reportType,
      metrics: timer.finish({ report_type: reportType, request_id: requestId || null }),
      limitation: 'Enriquecimiento IA omitido: tenant_id no disponible para el reporte.',
    });
  }

  const requestedDepth = useDeepPath
    ? (['standard', 'deep'].includes(depth) ? depth : (normalizedModelMode === 'deep' ? 'deep' : 'standard'))
    : 'executive';

  const options = {
    local_compact: true,
    fast_mode: !useDeepPath,
    use_llm_in_fast_mode: requestedLlm && normalizedModelMode === 'fast',
    use_llm: requestedLlm,
    model_mode: normalizedModelMode,
    use_rag: boolOption(useRag, true),
    use_drive: useDrive === 'auto' ? 'auto' : boolOption(useDrive, false),
    use_web: boolOption(useWeb, false),
    depth: requestedDepth,
    quality,
    return_structured_result: true,
  };

  try {
    console.info('REPORT AI ENRICHMENT START:', {
      request_id: requestId || null,
      tenant_id: tenantId,
      report_type: reportType,
      model_mode: normalizedModelMode,
      use_llm: requestedLlm,
      use_rag: boolOption(useRag, true),
      use_web: boolOption(useWeb, false),
      use_drive: useDrive,
    });

    const context = standardCode
      ? await aiContextBuilder.buildAiStandardContext({ tenantId, standardCode, operationId })
      : await aiContextBuilder.buildAiTenantContext({ tenantId });
    const companyProfile = await getCompanyProfileForTenant(tenantId);
    if (companyProfile?.profile_json) {
      context.company_profile = {
        profile_json: companyProfile.profile_json || {},
        industry: companyProfile.industry || '',
        subindustry: companyProfile.subindustry || '',
        company_size: companyProfile.company_size || '',
        maturity_level: companyProfile.maturity_level || '',
        risk_appetite: companyProfile.risk_appetite || '',
        allow_web_research: companyProfile.allow_web_research === true,
        allow_document_context: companyProfile.allow_document_context !== false,
        allow_ai_recommendations: companyProfile.allow_ai_recommendations !== false,
        ai_profile_summary_json: companyProfile.ai_profile_summary_json || null,
      };
      context.source_trace = [
        ...(context.source_trace || []),
        {
          source: 'internal_db',
          reference: 'tenant_company_profiles',
          used_for: 'perfil empresa usado como contexto operativo para recomendaciones IA',
        },
      ];
    }

    let companyProfileImpact = context.company_profile_impact || null;
    try {
      companyProfileImpact = await buildCompanyProfileImpact({
        tenantId,
        standardCodes: standardCode ? [standardCode] : [],
      });
      context.company_profile_impact = companyProfileImpact;
      context.company_profile_trace = companyProfileImpact?.trace || context.company_profile_trace || null;
    } catch (impactError) {
      console.warn('REPORT COMPANY PROFILE IMPACT SKIPPED:', {
        request_id: requestId || null,
        tenant_id: tenantId,
        report_type: reportType,
        error: impactError?.message,
      });
    }

    const payload = {
      task_type: reportType === 'audit_report' ? 'audit_analysis' : 'standard_gap_analysis',
      tenant_id: tenantId,
      report_type_code: reportType,
      standard_code: standardCode,
      model_mode: normalizedModelMode,
      use_llm: requestedLlm,
      use_rag: boolOption(useRag, true),
      use_web: boolOption(useWeb, false),
      use_drive: useDrive === 'auto' ? 'auto' : boolOption(useDrive, false),
      allow_web_research: boolOption(useWeb, false) || context.company_profile?.allow_web_research === true,
      allow_document_context: useDrive === 'auto' ? context.company_profile?.allow_document_context !== false : boolOption(useDrive, false),
      used_company_profile: Boolean(context.company_profile),
      depth: requestedDepth,
      quality,
      module_origin: 'reports',
      question: requestedLlm
        ? [
            'Genera enriquecimiento premium de reporte para un auditor ISO senior.',
            'Devuelve JSON renderizable con executive_narrative, auditor_opinion, root_cause_analysis, corrective_actions, evidence_requests, audit_questions, management_focus, limitations y trace.',
            'Cada acción debe incluir causa probable, acción correctiva, evidencia requerida, responsable sugerido, plazo, criterio de cierre y criterio de eficacia.',
            'No inventes certificación ni cumplimiento. Separa hechos internos de inferencias. Los datos internos del tenant son la fuente de verdad; RAG/web/Drive son solo apoyo.',
            'Si existe company_profile en el contexto, úsalo para ajustar riesgos, evidencias esperadas, objetivos, controles y tono ejecutivo, sin sobreescribir los hechos de base de datos.',
          ].join(' ')
        : 'Genera enriquecimiento ejecutivo de reporte con brechas, readiness y acciones prioritarias.',
      locale: 'es',
      company_profile_impact: companyProfileImpact,
      company_applicability_universe: context.company_applicability_universe || companyProfileImpact?.impact_profile?.applicability_universe || null,
      applicable_controls: context.applicable_controls || [],
      applicable_kpis: context.applicable_kpis || [],
      applicable_evidence_requirements: context.applicable_evidence_requirements || [],
      applicability_exclusions_summary: context.applicability_exclusions_summary || [],
      company_profile_trace: context.company_profile_trace || null,
      context,
      options,
      request_metadata: {
        report_type: reportType,
        request_id: requestId || null,
        model_mode: normalizedModelMode,
        quality,
        used_company_profile: Boolean(context.company_profile),
      },
    };

    const aiResult = await aiEngineClient.analyzeReport(payload);
    const structured = aiResult?.structured_result && typeof aiResult.structured_result === 'object'
      ? aiResult.structured_result
      : {};
    const gaps = asArray(structured.gaps);
    const recommendedActions = asArray(structured.recommended_actions);
    const rootCauseAnalysis = asArray(structured.root_cause_analysis).length
      ? asArray(structured.root_cause_analysis)
      : buildFallbackRootCause(gaps, recommendedActions);
    const correctiveActions = asArray(structured.corrective_actions).length
      ? asArray(structured.corrective_actions)
      : buildFallbackCorrectiveActions(recommendedActions, rootCauseAnalysis);
    const evidenceRequests = asArray(structured.evidence_requests).length
      ? asArray(structured.evidence_requests)
      : buildFallbackEvidenceRequests(structured);
    const auditQuestions = buildFallbackAuditQuestions(structured);
    const managementFocus = buildManagementFocus(structured, correctiveActions);
    const engine = aiResult?.engine || {};
    const fallbackUsed = isBackendFallback(aiResult, engine);
    const llmUsed = engine.used_llm === true && !fallbackUsed;
    const metrics = timer.finish({
      mode: resolveAiMode(options, engine),
      report_type: reportType,
      request_id: requestId || null,
      used_llm: llmUsed,
      fast_mode: engine.fast_mode === true,
      local_compact: engine.local_compact === true,
      used_rag: engine.used_rag === true,
      used_drive: engine.used_drive === true,
      used_web: engine.used_web === true,
      used_company_profile: Boolean(context.company_profile),
      fallback_used: fallbackUsed,
    });

    console.info(fallbackUsed ? 'REPORT AI ENRICHMENT FALLBACK:' : 'REPORT AI ENRICHMENT OK:', {
      request_id: requestId || null,
      tenant_id: tenantId,
      report_type: reportType,
      model_mode: normalizedModelMode,
      selected_model: engine.selected_model || engine.model || null,
      used_llm: llmUsed,
      used_rag: engine.used_rag === true,
      used_web: engine.used_web === true,
      used_drive: engine.used_drive === true,
      used_company_profile: Boolean(context.company_profile),
      company_profile_impact_used: Boolean(companyProfileImpact),
      applicability_universe_applied: context.company_applicability_universe?.active_universe === true,
        fallback_used: fallbackUsed,
      duration_ms: metrics.duration_ms,
    });

    return {
      ok: aiResult?.ok !== false && !fallbackUsed,
      answer: aiResult?.answer || '',
      structured_result: structured,
      executive_summary: structured.executive_narrative || structured.executive_summary || aiResult?.answer || '',
      executive_narrative: structured.executive_narrative || structured.executive_summary || aiResult?.answer || '',
      auditor_opinion: structured.auditor_opinion || structured.diagnosis || '',
      key_findings: gaps.map((gap) => gap.title || gap.description).filter(Boolean),
      recommended_actions: recommendedActions,
      root_cause_analysis: rootCauseAnalysis,
      corrective_actions: correctiveActions,
      evidence_requests: evidenceRequests,
      audit_questions: auditQuestions,
      management_focus: managementFocus,
      audit_readiness: structured.audit_readiness || {},
      confidence: Number(aiResult?.confidence ?? structured.confidence ?? 0),
      limitations: aiResult?.limitations || structured.limitations || [],
      source_trace: aiResult?.source_trace || structured.source_trace || [],
      engine,
      metrics: {
        ...metrics,
        model_mode_used: normalizedModelMode,
        llm_used: llmUsed,
        llm_provider: engine.llm_provider || null,
        model_name: engine.model || null,
        source: fallbackUsed ? 'ai-engine-v2-report-fallback' : (llmUsed ? 'ai-engine-v2-report-llm' : 'ai-engine-v2-report-fast'),
        duration_ms: metrics.duration_ms,
        fallback_used: fallbackUsed,
        ai_enrichment_failed: fallbackUsed,
        timeout_stage: engine.timeout_stage || null,
        timeout_ms: engine.timeout_ms || null,
        error_type: engine.error_type || null,
        error_message: engine.error_message || null,
      },
      model_mode_used: normalizedModelMode,
      llm_used: llmUsed,
      llm_provider: engine.llm_provider || null,
      model_name: engine.model || null,
      source: fallbackUsed ? 'ai-engine-v2-report-fallback' : (llmUsed ? 'ai-engine-v2-report-llm' : 'ai-engine-v2-report-fast'),
      duration_ms: metrics.duration_ms,
      trace: {
        ai_engine_used: !fallbackUsed,
        used_llm: llmUsed,
        model_mode: normalizedModelMode,
        selected_model: engine.selected_model || engine.model || null,
        used_rag: engine.used_rag === true,
        used_web: engine.used_web === true,
        used_drive: engine.used_drive === true,
        used_company_profile: Boolean(context.company_profile),
        company_profile_impact_used: Boolean(companyProfileImpact),
        applicability_universe_applied: context.company_applicability_universe?.active_universe === true,
        used_documents: engine.used_drive === true || Boolean((context.documents || []).length),
        fallback_used: fallbackUsed,
        ai_enrichment_failed: fallbackUsed,
        timeout_stage: engine.timeout_stage || null,
        timeout_ms: engine.timeout_ms || null,
        error_type: engine.error_type || null,
        error_message: engine.error_message || null,
        duration_ms: metrics.duration_ms,
        request_id: requestId || null,
      },
      ai_enrichment_failed: fallbackUsed,
      fallback_used: fallbackUsed,
    };
  } catch (error) {
    const metrics = timer.finish({
      mode: 'fast_mode',
      report_type: reportType,
      request_id: requestId || null,
      used_llm: false,
    });
    console.error('REPORT AI ENRICHMENT ERROR:', {
      request_id: requestId || null,
      tenant_id: tenantId,
      report_type: reportType,
      model_mode: normalizedModelMode,
      error: error.message,
    });
    const fallback = emptyEnrichment({
      reportType,
      metrics,
      limitation: 'Enriquecimiento IA no disponible; reporte generado con datos internos.',
    });
    return {
      ...fallback,
      model_mode_used: normalizedModelMode,
      llm_used: false,
      source: 'ai-engine-v2-report-fallback',
      trace: {
        ai_engine_used: false,
        used_llm: false,
        model_mode: normalizedModelMode,
        selected_model: 'backend_fallback',
        fallback_used: true,
        ai_enrichment_failed: true,
        request_id: requestId || null,
      },
    };
  }
}

module.exports = {
  buildReportAiEnrichment,
};
