const express = require('express');
const router = express.Router();

function localizeOutgoingSeniorAuditorView(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const locale = String(
    body.locale ||
    body?.answer?.locale ||
    body?.answer?.response_language ||
    ''
  ).toLowerCase();

  const isEnglish =
    locale === 'en' ||
    locale === 'english' ||
    body?.answer?.response_language === 'English';

  if (!isEnglish || !body.answer || typeof body.answer !== 'object') {
    return body;
  }

  const answer = body.answer;
  const view = answer.senior_auditor_view;

  if (view && typeof view === 'object') {
    if (typeof view.diagnostic === 'string') {
      view.diagnostic = view.diagnostic
        .replace(/Criterio auditor:\s*la respuesta usa fuente/gi, 'Auditor criterion: the answer uses source')
        .replace(/con confianza alta/gi, 'with high confidence')
        .replace(/con confianza media/gi, 'with medium confidence')
        .replace(/con confianza baja/gi, 'with low confidence')
        .replace(/con confianza medium/gi, 'with medium confidence')
        .replace(/No se observan brechas críticas con la información disponible\./gi, 'No critical gaps are observed with the available information.')
        .replace(/No se observan brechas criticas con la informacion disponible\./gi, 'No critical gaps are observed with the available information.');
    }

    if (Array.isArray(view.recommended_actions)) {
      view.recommended_actions = view.recommended_actions.map((item) => {
        if (typeof item !== 'string') return item;

        return item
          .replace(
            /Registrar decisión del auditor humano y fundamento de aceptación, rechazo o solicitud de complemento\./gi,
            'Record the human auditor decision and the rationale for acceptance, rejection, or request for additional evidence.'
          )
          .replace(
            /Registrar decision del auditor humano y fundamento de aceptacion, rechazo o solicitud de complemento\./gi,
            'Record the human auditor decision and the rationale for acceptance, rejection, or request for additional evidence.'
          );
      });
    }

    if (Array.isArray(view.review_questions)) {
      view.review_questions = view.review_questions.map((item) => {
        if (typeof item !== 'string') return item;

        return item
          .replace(
            /¿La evidencia corresponde al periodo y alcance auditado\?/gi,
            'Does the evidence correspond to the audited period and scope?'
          )
          .replace(
            /¿Existe responsable\/aprobador identificable y fecha de revisión\?/gi,
            'Is there an identifiable owner/approver and review date?'
          )
          .replace(
            /¿Existe responsable\/aprobador identificable y fecha de revision\?/gi,
            'Is there an identifiable owner/approver and review date?'
          );
      });
    }

    if (typeof view.approval_policy === 'string') {
      view.approval_policy = view.approval_policy
        .replace(
          /La IA puede anticipar brechas y sugerir acciones, pero no aprueba, cierra ni crea registros críticos sin validación humana\./gi,
          'AI can anticipate gaps and suggest actions, but it does not approve, close, or create critical records without human validation.'
        )
        .replace(
          /La IA puede anticipar brechas y sugerir acciones, pero no aprueba, cierra ni crea registros criticos sin validacion humana\./gi,
          'AI can anticipate gaps and suggest actions, but it does not approve, close, or create critical records without human validation.'
        );
    }
  }

  if (Array.isArray(answer.recommended_actions)) {
    answer.recommended_actions = answer.recommended_actions.map((item) => {
      if (typeof item !== 'string') return item;

      return item
        .replace(
          /Registrar decisión del auditor humano y fundamento de aceptación, rechazo o solicitud de complemento\./gi,
          'Record the human auditor decision and the rationale for acceptance, rejection, or request for additional evidence.'
        )
        .replace(
          /Registrar decision del auditor humano y fundamento de aceptacion, rechazo o solicitud de complemento\./gi,
          'Record the human auditor decision and the rationale for acceptance, rejection, or request for additional evidence.'
        );
    });
  }

  if (Array.isArray(answer.auditor_review_questions)) {
    answer.auditor_review_questions = answer.auditor_review_questions.map((item) => {
      if (typeof item !== 'string') return item;

      return item
        .replace(
          /¿La evidencia corresponde al periodo y alcance auditado\?/gi,
          'Does the evidence correspond to the audited period and scope?'
        )
        .replace(
          /¿Existe responsable\/aprobador identificable y fecha de revisión\?/gi,
          'Is there an identifiable owner/approver and review date?'
        )
        .replace(
          /¿Existe responsable\/aprobador identificable y fecha de revision\?/gi,
          'Is there an identifiable owner/approver and review date?'
        );
    });
  }

  return body;
}

router.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    return originalJson(localizeOutgoingSeniorAuditorView(body));
  };

  next();
});



function normalizeOutgoingAiValidationError(body, req) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const rawError = String(body.error || body.message || '').trim().toLowerCase();

  if (
    body.ok === false &&
    !body.error_code &&
    (
      rawError === 'question es obligatorio' ||
      rawError === 'la pregunta es requerida' ||
      rawError === 'pregunta requerida' ||
      rawError === 'question requerido'
    )
  ) {
    const locale = String(
      body.locale ||
      req?.body?.locale ||
      req?.headers?.['x-tcdx-locale'] ||
      'es'
    ).toLowerCase().split('-')[0];

    const message = body.message || body.error || 'question es obligatorio';

    return {
      ...body,
      ok: false,
      error_code: 'VALIDATION_ERROR',
      code: 'VALIDATION_ERROR',
      message,
      error: message,
      locale: ['es', 'en'].includes(locale) ? locale : 'es',
    };
  }

  return body;
}

router.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    return originalJson(normalizeOutgoingAiValidationError(body, req));
  };

  next();
});


const pool = require('../config/db');
const auth = require('../middleware/auth');
const { errorDetail } = require('../utils/errorResponse');
const { resolveLocale } = require('../utils/locale');
const { renderAiAuditorPremiumTemplate } = require('../reports/templates/aiAuditorPremium.template');
const {
  persistSeniorAuditorSuggestions,
  summarizeSeniorSuggestionSync,
} = require('../services/seniorAuditorSuggestions.service');
const aiContextBuilder = require('../services/aiContextBuilder.service');
const aiEngineClient = require('../services/aiEngineClient.service');
const { createAiTimer, resolveAiMode } = require('../services/aiRuntimeMetrics.service');

const AI_ENGINE_URL =
  process.env.AI_ENGINE_URL || 'http://192.168.100.140:8000';

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

function normalizeAiLocale(value) {
  const raw = String(value || '').trim().toLowerCase().replace('_', '-');
  const base = raw.split(',')[0].split(';')[0].split('-')[0];
  return ['es', 'en'].includes(base) ? base : 'es';
}

function getAiInternalToken() {
  const token = process.env.AI_INTERNAL_TOKEN || process.env.AI_TOKEN || '';

  if (!token) {
    throw new Error('AI_INTERNAL_TOKEN no configurado');
  }

  return token;
}

function getUserId(user) {
  return user?.id || user?.user_id || user?.userId || null;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  const normalized = normalizeRole(role);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalized);
}

function resolveTenantId(req) {
  const role = normalizeRole(
    req.user?.role || req.user?.user_role || req.user?.userRole
  );

  const tokenTenantId = getUserTenantId(req.user);
  const queryTenantId = req.query?.tenant_id ? String(req.query.tenant_id) : null;
  const bodyTenantId = req.body?.tenant_id ? String(req.body.tenant_id) : null;

  if (isPlatformRole(role)) {
    return bodyTenantId || queryTenantId || tokenTenantId;
  }

  return tokenTenantId;
}

function normalizePriority(value) {
  const raw = String(value || '').toLowerCase().trim();

  if (['alta', 'high', 'critical', 'critica', 'crítica'].includes(raw)) {
    return 'alta';
  }

  if (['baja', 'low'].includes(raw)) {
    return 'baja';
  }

  return 'media';
}

function buildFindingAiAppendBlock(aiPayload) {
  const lines = [
    '---',
    `IA Compliance (${new Date().toISOString()})`,
    aiPayload?.summary ? `Resumen: ${aiPayload.summary}` : '',
    aiPayload?.impact ? `Impacto: ${aiPayload.impact}` : '',
    aiPayload?.priority ? `Prioridad sugerida: ${aiPayload.priority}` : '',
    Array.isArray(aiPayload?.recommended_actions) && aiPayload.recommended_actions.length
      ? `Acciones sugeridas: ${aiPayload.recommended_actions.join(' | ')}`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function buildActionPlanAiAppendBlock(aiPayload) {
  const planLines = Array.isArray(aiPayload?.action_plan)
    ? aiPayload.action_plan.map(
        (step) =>
          `Paso ${step.step}: ${step.title} (${step.owner_role}, ${step.target_days} días) - ${step.description}`
      )
    : [];

  const lines = [
    '---',
    `IA Compliance (${new Date().toISOString()})`,
    aiPayload?.objective ? `Objetivo sugerido: ${aiPayload.objective}` : '',
    Array.isArray(aiPayload?.immediate_actions) && aiPayload.immediate_actions.length
      ? `Acciones inmediatas: ${aiPayload.immediate_actions.join(' | ')}`
      : '',
    planLines.length ? `Plan sugerido: ${planLines.join(' || ')}` : '',
    Array.isArray(aiPayload?.success_criteria) && aiPayload.success_criteria.length
      ? `Criterios de cierre: ${aiPayload.success_criteria.join(' | ')}`
      : '',
    aiPayload?.priority ? `Prioridad sugerida IA: ${aiPayload.priority}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function buildNonconformityActionPlanDescription(aiPayload) {
  return [
    aiPayload?.statement ? `Redacción propuesta: ${aiPayload.statement}` : '',
    aiPayload?.objective_evidence
      ? `Evidencia objetiva: ${aiPayload.objective_evidence}`
      : '',
    aiPayload?.risk_statement ? `Riesgo / impacto: ${aiPayload.risk_statement}` : '',
    aiPayload?.immediate_correction
      ? `Corrección inmediata: ${aiPayload.immediate_correction}`
      : '',
    aiPayload?.corrective_action
      ? `Acción correctiva sugerida: ${aiPayload.corrective_action}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseAiBlocks(text) {
  const raw = String(text || '');

  if (!raw.trim()) {
    return {
      prefix: '',
      blocks: [],
    };
  }

  const marker = /---\nIA Compliance \([^)]+\)\n/g;
  const matches = [...raw.matchAll(marker)];

  if (!matches.length) {
    return {
      prefix: raw.trim(),
      blocks: [],
    };
  }

  const firstIndex = matches[0].index ?? 0;
  const prefix = raw.slice(0, firstIndex).trim();

  const blocks = matches.map((match, index) => {
    const start = match.index ?? 0;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? raw.length
        : raw.length;

    return raw.slice(start, end).trim();
  });

  return {
    prefix,
    blocks,
  };
}

function classifyAiBlock(block) {
  const raw = String(block || '').toLowerCase();

  if (
    raw.includes('objetivo sugerido:') ||
    raw.includes('acciones inmediatas:') ||
    raw.includes('plan sugerido:')
  ) {
    return 'action_plan';
  }

  if (raw.includes('resumen:') && raw.includes('impacto:')) {
    return 'finding_analysis';
  }

  return 'generic';
}

function upsertAiBlock(currentText, nextBlock, mode) {
  const { prefix, blocks } = parseAiBlocks(currentText);
  const keptBlocks = blocks.filter((block) => classifyAiBlock(block) !== mode);

  return [prefix, ...keptBlocks, String(nextBlock || '').trim()]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function buildNonconformityDerivedTitle({
  clause = null,
  controlDescription = null,
  category = null,
}) {
  if (clause && controlDescription) {
    return `No conformidad cláusula ${clause} - ${controlDescription}`;
  }

  if (controlDescription) {
    return `No conformidad - ${controlDescription}`;
  }

  if (clause) {
    return `No conformidad cláusula ${clause}`;
  }

  if (category) {
    return `No conformidad - ${category}`;
  }

  return 'No conformidad';
}

function buildNonconformityAiPayload(tenantId, source = {}, overrides = {}) {
  const clause = overrides.clause || source.clause || null;
  const category = overrides.category || source.category || null;
  const controlDescription =
    overrides.control_description || source.control_description || null;

  const title =
    overrides.title ||
    overrides.nc_title ||
    source.title ||
    buildNonconformityDerivedTitle({
      clause,
      controlDescription,
      category,
    });

  const description =
    overrides.description ||
    overrides.nc_description ||
    source.description ||
    controlDescription ||
    category ||
    title;

  return {
    tenant_id: tenantId,
    nonconformity_id: overrides.nonconformity_id || source.id || null,
    iso_code: overrides.iso_code || source.iso_code || source.iso || null,
    title,
    description,
    severity: overrides.severity || source.severity || 'media',
    clause,
    category,
    control_description: controlDescription,
    tenant_control_id:
      overrides.tenant_control_id || source.tenant_control_id || null,
    status: overrides.status || source.status || null,
    detected_at: source.detected_at || null,
    resolved_at: source.resolved_at || null,
  };
}

function normalizeProgress(value, currentValue = 0, nextStatus = '') {
  const current = Math.max(0, Math.min(100, Number(currentValue) || 0));

  if (value === null || value === undefined || value === '') {
    if (nextStatus === 'completado') return 100;
    if (nextStatus === 'en progreso' && current < 25) return 25;
    return current;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return current;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

async function getLatestActionPlanProgress(client, actionPlanId) {
  const result = await client.query(
    `
    SELECT progress_percent
    FROM action_plan_updates
    WHERE action_plan_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [actionPlanId]
  );

  return Number(result.rows[0]?.progress_percent || 0);
}

async function insertActionPlanUpdate(client, payload) {
  const {
    actionPlanId,
    tenantId,
    comment,
    progressPercent,
    statusAfter,
    blockedReason = null,
    createdBy = null,
  } = payload;

  await client.query(
    `
    INSERT INTO action_plan_updates (
      action_plan_id,
      tenant_id,
      comment,
      progress_percent,
      status_after,
      blocked_reason,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      actionPlanId,
      tenantId,
      comment,
      progressPercent,
      statusAfter,
      blockedReason,
      createdBy,
    ]
  );
}


function getInternalBackendUrl() {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_BASE_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '');
}

function getAuthHeader(req) {
  return req.headers.authorization || req.headers.Authorization || '';
}

function safeText(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function compactLine(value) {
  return safeText(value).replace(/\s+/g, ' ').slice(0, 1600);
}

function buildEnhancedQuestion(kind, payload = {}) {
  const iso = payload.iso_code || payload.standard_code || payload.iso || 'ISO';
  const title = payload.title || payload.nc_title || payload.finding_title || payload.action_title || '';
  const description = payload.description || payload.nc_description || payload.finding_description || '';
  const severity = payload.severity || payload.priority || '';
  const status = payload.status || '';

  if (kind === 'finding_analysis') {
    return compactLine(
      `Analiza este hallazgo de cumplimiento ${iso}. ` +
      `Título: ${title}. ` +
      `Descripción: ${description}. ` +
      `Severidad: ${severity}. Estado: ${status}. ` +
      `Indica causa probable, riesgo, evidencia necesaria, próximos pasos y criterio de cierre.`
    );
  }

  if (kind === 'action_plan_suggestion') {
    return compactLine(
      `Genera un plan de acción para este hallazgo de cumplimiento ${iso}. ` +
      `Título: ${title}. ` +
      `Descripción: ${description}. ` +
      `Severidad: ${severity}. Estado: ${status}. ` +
      `Indica acciones concretas, evidencia de cierre, responsables sugeridos, prioridad y verificación de eficacia.`
    );
  }

  if (kind === 'nonconformity_draft') {
    return compactLine(
      `Redacta y mejora una no conformidad de cumplimiento ${iso}. ` +
      `Título: ${title}. ` +
      `Descripción: ${description}. ` +
      `Indica causa raíz probable, acción correctiva, evidencia requerida, riesgo si no se corrige y criterio de eficacia.`
    );
  }

  return compactLine(
    `Analiza este caso de cumplimiento ${iso}. Título: ${title}. Descripción: ${description}.`
  );
}

async function callEnhancedComplianceAnswer(req, {
  tenantId,
  question,
  limit = 8,
  knowledgeLimit = 8,
  benchmarkLimit = 8,
  forceExternalLookup = false,
  acceptExtraCharge = false,
}) {
  try {
    if (!tenantId || !question) return null;

    const response = await fetch(`${getInternalBackendUrl()}/api/ai-compliance/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(req),
        'x-tcdx-locale': resolveLocale(req),
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        question,
        limit,
        knowledge_limit: knowledgeLimit,
        benchmark_limit: benchmarkLimit,
        force_external_lookup: forceExternalLookup === true,
        accept_extra_charge: acceptExtraCharge === true,
        locale: resolveLocale(req),
      }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      return {
        ok: false,
        error: json?.error || json?.detail || `Error orquestador IA HTTP ${response.status}`,
      };
    }

    return json;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Error llamando orquestador IA',
    };
  }
}

function buildStructuredGuidedFromEnhanced(enhancedResult) {
  const answer = enhancedResult?.answer || null;
  const trace = enhancedResult?.search_trace || null;

  if (!answer) return null;

  return {
    has_guided: true,
    source: 'central_ai_orchestrator',
    source_level: answer.source_level || null,
    source_label: answer.source_label || null,
    confidence: answer.confidence || null,
    confidence_score: answer.confidence_score || null,
    trace_id: enhancedResult?.trace?.id || null,
    trace_created_at: enhancedResult?.trace?.created_at || null,

    solution_summary: answer.executive_summary || '',
    next_best_action:
      Array.isArray(answer.next_steps) && answer.next_steps.length > 0
        ? answer.next_steps[0]
        : answer.recommendation || '',
    solution_steps: Array.isArray(answer.next_steps) ? answer.next_steps : [],
    expected_deliverables: Array.isArray(answer.suggested_evidence)
      ? answer.suggested_evidence
      : [],
    minimum_content: Array.isArray(answer.suggested_evidence)
      ? answer.suggested_evidence.slice(0, 6)
      : [],
    invalid_evidence: [],
    closure_conditions: Array.isArray(answer.next_steps)
      ? answer.next_steps.slice(-4)
      : [],

    health_impact: answer.risk_if_not_addressed || '',
    kpi_impact: answer.recommendation || '',
    context_summary: answer.analysis || '',

    knowledge_sources: {
      source_order: trace?.source_order || [],
      tenant_hits: trace?.tenant_hits || 0,
      knowledge_hits: trace?.knowledge_hits || 0,
      benchmark_hits: trace?.benchmark_hits || 0,
      external_hits: trace?.external_hits || 0,
      source_level: answer.source_level || null,
      source_label: answer.source_label || null,
      confidence: answer.confidence || null,
      used_tenant_internal: answer.used_tenant_internal === true,
      used_tcdx_knowledge: answer.used_tcdx_knowledge === true,
      used_anonymized_benchmark: answer.used_anonymized_benchmark === true,
      used_external_lookup: answer.used_external_lookup === true,
      requires_human_review: answer.must_review_by_human === true,
    },
  };
}

function enrichAiResponseWithOrchestrator(aiResponse, enhancedResult) {
  if (!enhancedResult?.ok || !enhancedResult?.answer) {
    return {
      ...(aiResponse || {}),
      enhanced_orchestration: enhancedResult || null,
    };
  }

  const answer = enhancedResult.answer;
  const structuredGuided = buildStructuredGuidedFromEnhanced(enhancedResult);

  return {
    ...(aiResponse || {}),

    // Campos nuevos, no rompen frontend existente.
    enhanced_answer: answer,
    enhanced_orchestration: {
      ok: true,
      question: enhancedResult.question,
      trace: enhancedResult.trace,
      search_trace: enhancedResult.search_trace,
      source_level: answer.source_level,
      source_label: answer.source_label,
      confidence: answer.confidence,
      confidence_score: answer.confidence_score,
    },

    // Campos compatibles con tarjetas IA enriquecidas ya existentes.
    structured_guided: {
      ...((aiResponse || {}).structured_guided || {}),
      ...(structuredGuided || {}),
    },

    // Alias útiles para UI actual o futura.
    enhanced_summary: answer.executive_summary || null,
    enhanced_analysis: answer.analysis || null,
    enhanced_recommendation: answer.recommendation || null,
    enhanced_suggested_evidence: answer.suggested_evidence || [],
    enhanced_next_steps: answer.next_steps || [],
    enhanced_risk_if_not_addressed: answer.risk_if_not_addressed || null,
    enhanced_source_level: answer.source_level || null,
    enhanced_source_label: answer.source_label || null,
    enhanced_confidence: answer.confidence || null,
    enhanced_trace_id: enhancedResult?.trace?.id || null,
  };
}



// =========================================================
// IA Compliance health hardening
// - Endpoint health no debe tumbar toda la vista si ai-engine
//   no responde o si cambia path/método.
// - No escribe DB ni crea registros.
// =========================================================

async function checkLocalBackendDbConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('IA COMPLIANCE LOCAL DB HEALTH ERROR:', error.message);
    return false;
  }
}

async function probeAiEngineHealthEndpoint(path, method = 'GET') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-tcdx-locale': 'es',
    };

    const internalToken = process.env.AI_INTERNAL_TOKEN || process.env.AI_TOKEN || '';
    if (internalToken) {
      headers['X-AI-Token'] = internalToken;
    }

    const response = await fetch(`${AI_ENGINE_URL}${path}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify({ ping: true, locale: 'es' }) : undefined,
      signal: controller.signal,
    });

    const text = await response.text().catch(() => '');
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        path,
        method,
        error: data?.detail || data?.error || `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      path,
      method,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      method,
      error: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'AI Engine unavailable'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getRobustAiComplianceEngineHealth() {
  const localDbOk = await checkLocalBackendDbConnection();

  const probes = [
    ['/health', 'GET'],
    ['/api/health', 'GET'],
    ['/api/ai/health', 'GET'],
    ['/health', 'POST'],
    ['/api/health', 'POST'],
    ['/api/ai/health', 'POST'],
  ];

  const attempts = [];

  for (const [path, method] of probes) {
    const result = await probeAiEngineHealthEndpoint(path, method);
    attempts.push(result);

    if (result.ok) {
      const engineData = result.data || {};

      return {
        ok: true,
        data: {
          ok: true,
          service: engineData.service || engineData.name || 'ai-engine',
          env: engineData.env || engineData.environment || process.env.NODE_ENV || 'production',
          db_connection:
            engineData.db_connection ??
            engineData.database_ok ??
            engineData.db_ok ??
            localDbOk,
          backend_db_connection: localDbOk,
          engine_url: AI_ENGINE_URL,
          health_path: result.path,
          health_method: result.method,
          degraded: false,
        },
        diagnostics: {
          attempts,
        },
      };
    }
  }

  return {
    ok: true,
    data: {
      ok: false,
      service: 'ai-engine',
      env: process.env.NODE_ENV || 'production',
      db_connection: false,
      backend_db_connection: localDbOk,
      engine_url: AI_ENGINE_URL,
      degraded: true,
      error: attempts.find((item) => item.error)?.error || 'AI Engine unavailable',
    },
    diagnostics: {
      attempts,
    },
  };
}


async function callAiEngine(path, payload) {
  const locale = normalizeAiLocale(payload?.locale || payload?.language || payload?.response_language);
  const payloadWithLocale = {
    ...(payload || {}),
    locale,
    language: locale,
    response_language: locale,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${AI_ENGINE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Token': getAiInternalToken(),
        'x-tcdx-locale': locale,
      },
      body: JSON.stringify(payloadWithLocale),
      signal: controller.signal,
    });

    const text = await res.text();

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta inválida desde AI Engine. HTTP ${res.status}`);
    }

    if (!res.ok || !json || json.ok === false) {
      throw new Error(
        json?.detail || json?.error || 'Error llamando AI Engine'
      );
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function callAiEngineOptional(path, payload, fallback = null) {
  try {
    return await callAiEngine(path, payload);
  } catch (error) {
    console.error(`AI ENGINE OPTIONAL ERROR [${path}]:`, error.message);
    return fallback;
  }
}

async function syncSeniorAuditorSuggestionsSafe(options) {
  try {
    const result = await persistSeniorAuditorSuggestions(options);
    return summarizeSeniorSuggestionSync(result);
  } catch (error) {
    console.error('AI SENIOR AUDITOR SUGGESTION SYNC ERROR:', error.message);
    return {
      created: 0,
      reused: 0,
      skipped: 0,
      error: 'No fue posible sincronizar sugerencias del auditor senior',
    };
  }
}

function isTruthyFlag(value) {
  return ['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(
    String(value || '').trim().toLowerCase()
  );
}

function getAuditorWebContextFlag(req) {
  if (req.query?.allow_web_context !== undefined) {
    return isTruthyFlag(req.query.allow_web_context);
  }

  return isTruthyFlag(
    process.env.AI_AUDITOR_WEB_CONTEXT || process.env.AI_COMPLIANCE_WEB_CONTEXT
  );
}

function buildAuditorWebContextTopics(standards = []) {
  const codes = Array.isArray(standards) ? standards.join(' ').toLowerCase() : '';
  const topics = ['iso_best_practices', 'risk_management'];

  if (codes.includes('27001') || codes.includes('22301')) {
    topics.push('cybersecurity_threats', 'business_continuity');
  }

  return [...new Set(topics)];
}

function buildSeniorAuditorPayload({
  tenantId,
  tenantName,
  standards,
  stats,
  weakestStandards = [],
  requestedOutput = 'global_analysis',
  allowWebContext = false,
}) {
  return {
    tenant_context: {
      tenant_id: tenantId,
      tenant_name: tenantName || 'Cliente',
    },
    active_standards: Array.isArray(standards) ? standards : [],
    controls_summary: {
      total_controls: Number(stats?.controls_total || 0),
      attention_controls: Number(stats?.controls_warning || 0),
      deteriorated_controls: Number(stats?.controls_critical || 0),
      controls_without_evidence: Number(stats?.evidences_pending || 0),
      weakest_standards: weakestStandards,
    },
    evidence_summary: {
      pending_evidence_count: Number(stats?.evidences_pending || 0),
    },
    findings_summary: {
      critical_findings: Number(stats?.findings_critical || 0),
    },
    risks_summary: {},
    action_plans_summary: {},
    kpi_summary: {},
    audit_context: {},
    requested_output: requestedOutput,
    allow_web_context: allowWebContext,
    web_context_topics: allowWebContext
      ? buildAuditorWebContextTopics(standards)
      : [],
  };
}

async function buildAiComplianceV2Context({ tenantId, body = {}, standardCode = null, operationId = null }) {
  if (body.tenant_control_id) {
    return aiContextBuilder.buildAiControlContext({
      tenantId,
      tenantControlId: String(body.tenant_control_id),
      standardCode,
      operationId,
    });
  }

  if (body.evidence_id) {
    return aiContextBuilder.buildAiEvidenceContext({
      tenantId,
      evidenceId: String(body.evidence_id),
    });
  }

  if (standardCode || operationId) {
    return aiContextBuilder.buildAiStandardContext({
      tenantId,
      standardCode,
      operationId,
    });
  }

  return aiContextBuilder.buildAiTenantContext({ tenantId });
}

function buildAiComplianceV2Payload({ tenantId, context, body = {}, question = '', taskType = null }) {
  const requestedDepth = String(body.depth || body.analysis_depth || 'standard');
  const depth = ['executive', 'standard', 'deep'].includes(requestedDepth)
    ? requestedDepth
    : 'standard';

  const resolvedTaskType =
    taskType ||
    (body.tenant_control_id
      ? 'control_analysis'
      : body.evidence_id
        ? 'evidence_review'
        : question
          ? 'free_question'
          : 'standard_gap_analysis');

  return {
    task_type: resolvedTaskType,
    tenant_id: tenantId,
    module_origin: 'ia-compliance',
    question: safeText(question || body.question || body.prompt || ''),
    locale: 'es',
    context,
    options: {
      local_compact: body.local_compact !== false,
      use_rag: body.use_rag !== false,
      use_drive: body.use_drive === undefined ? 'auto' : body.use_drive !== false,
      use_web: body.force_web === true || body.use_web === true,
      force_web: body.force_web === true,
      fast_mode: body.fast_mode === undefined ? depth === 'executive' : body.fast_mode === true,
      use_llm_in_fast_mode: body.use_llm_in_fast_mode === true,
      depth,
      return_structured_result: true,
    },
  };
}

function mapStructuredActionsToSuggestions(structuredResult) {
  const actions = Array.isArray(structuredResult?.recommended_actions)
    ? structuredResult.recommended_actions
    : [];

  return actions.map((item) => ({
    title: item.title || 'Acción recomendada',
    summary: item.description || '',
    recommended_action: item.description || '',
    priority: item.priority || 'media',
    target_module: item.target_module || 'plan-accion',
    due_days: item.due_days || 30,
    acceptance_criteria: Array.isArray(item.acceptance_criteria)
      ? item.acceptance_criteria
      : [],
    related_iso: item.related_iso || '',
    related_clause: item.related_clause || '',
  }));
}

function buildLegacyAiComplianceView(aiResult) {
  const structured = aiResult?.structured_result || {};
  const suggestions = mapStructuredActionsToSuggestions(structured);

  return {
    ok: aiResult?.ok !== false,
    type: 'senior_iso_compliance_v2',
    summary: structured.executive_summary || aiResult?.answer || '',
    suggestions: suggestions.map((item) => item.title || item.recommended_action).filter(Boolean),
    recommendations: suggestions,
    confidence: aiResult?.confidence ?? structured.confidence ?? 0,
    source: 'ai-engine-v2',
    structured_result: structured,
    source_trace: aiResult?.source_trace || structured.source_trace || [],
    limitations: aiResult?.limitations || structured.limitations || [],
    engine: aiResult?.engine || {},
  };
}

function buildFastLegacyAiResponse({ type, summary, suggestions = [], confidence = 'media', source = 'internal_fast_summary', endpoint, metrics = null }) {
  return {
    ok: true,
    type,
    summary,
    executive_summary: type === 'executive_brief' ? summary : undefined,
    headline: type === 'executive_brief' ? 'Resumen ejecutivo IA' : undefined,
    suggestions,
    top_priorities: type === 'executive_brief' ? suggestions : undefined,
    management_actions: type === 'executive_brief' ? suggestions : undefined,
    confidence,
    source,
    engine: {
      fast_mode: true,
      used_llm: false,
      local_compact: true,
      used_rag: true,
      used_drive: false,
      used_web: false,
      model: 'deterministic_backend_summary',
    },
    metrics: metrics || {
      endpoint,
      mode: 'fast_mode',
      duration_ms: 0,
    },
    limitations: [],
  };
}

async function runAiComplianceV2Analysis({ tenantId, body = {}, question = '', taskType = null }) {
  const standardCode = body.standard_code || body.iso_code || body.iso || null;
  const operationId = body.operation_id || null;
  const context = await buildAiComplianceV2Context({
    tenantId,
    body,
    standardCode,
    operationId,
  });
  const payload = buildAiComplianceV2Payload({
    tenantId,
    context,
    body,
    question,
    taskType,
  });
  const aiResult = await aiEngineClient.analyzeWithSeniorAuditor(payload);
  return {
    payload,
    context,
    aiResult,
    legacy: buildLegacyAiComplianceView(aiResult),
  };
}

async function getTenantName(tenantId) {
  const result = await pool.query(
    `
    SELECT name
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0]?.name || 'Cliente';
}

async function getActiveStandards(tenantId) {
  const result = await pool.query(
    `
    SELECT standard_code
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND is_active = TRUE
    ORDER BY standard_code
    `,
    [tenantId]
  );

  return result.rows.map((row) => row.standard_code).filter(Boolean);
}

async function getHealthSummaryStats(tenantId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    ),
    latest_health AS (
      SELECT DISTINCT ON (chs.tenant_control_id)
        chs.tenant_control_id,
        chs.standard_code,
        COALESCE(chs.health_score, 0) AS health_score,
        COALESCE(chs.pending_evidence_count, 0) AS pending_evidence_count,
        CASE
          WHEN COALESCE(chs.health_score, 0) < 50 THEN 'deteriorado'
          WHEN COALESCE(chs.health_score, 0) < 80 THEN 'atencion'
          ELSE 'saludable'
        END AS derived_health_status,
        chs.calculated_at
      FROM control_health_scores chs
      INNER JOIN active_standards ast
        ON ast.standard_code = chs.standard_code
      WHERE chs.tenant_id = $1::uuid
      ORDER BY chs.tenant_control_id, chs.calculated_at DESC NULLS LAST
    ),
    critical_findings AS (
      SELECT COUNT(*)::int AS total
      FROM findings f
      INNER JOIN active_standards ast
        ON ast.standard_code = f.iso_code
      WHERE f.tenant_id = $1::uuid
        AND LOWER(COALESCE(f.severity, '')) IN ('critical', 'critico', 'crítico')
        AND LOWER(COALESCE(f.status, 'open')) NOT IN ('closed', 'cerrado', 'cerrada', 'resuelto', 'resuelta')
    )
    SELECT
      COUNT(*)::int AS controls_total,
      SUM(CASE WHEN derived_health_status = 'atencion' THEN 1 ELSE 0 END)::int AS controls_warning,
      SUM(CASE WHEN derived_health_status = 'deteriorado' THEN 1 ELSE 0 END)::int AS controls_critical,
      SUM(pending_evidence_count)::int AS evidences_pending,
      (SELECT total FROM critical_findings) AS findings_critical
    FROM latest_health
    `,
    [tenantId]
  );

  const row = result.rows[0] || {};

  return {
    controls_total: Number(row.controls_total || 0),
    controls_warning: Number(row.controls_warning || 0),
    controls_critical: Number(row.controls_critical || 0),
    evidences_pending: Number(row.evidences_pending || 0),
    findings_critical: Number(row.findings_critical || 0),
  };
}

async function getWeakestStandards(tenantId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    ),
    latest_health AS (
      SELECT DISTINCT ON (chs.tenant_control_id)
        chs.tenant_control_id,
        chs.standard_code,
        COALESCE(chs.health_score, 0) AS health_score,
        chs.calculated_at
      FROM control_health_scores chs
      INNER JOIN active_standards ast
        ON ast.standard_code = chs.standard_code
      WHERE chs.tenant_id = $1::uuid
      ORDER BY chs.tenant_control_id, chs.calculated_at DESC NULLS LAST
    )
    SELECT
      standard_code,
      ROUND(AVG(health_score)::numeric, 1) AS score
    FROM latest_health
    GROUP BY standard_code
    ORDER BY score ASC, standard_code ASC
    LIMIT 3
    `,
    [tenantId]
  );

  return result.rows.map((row) => `${row.standard_code} (${row.score}%)`);
}

async function getOpenFindingsList(tenantId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    )
    SELECT
      f.id,
      f.iso_code,
      f.title,
      f.description,
      f.severity,
      f.status,
      f.owner,
      f.due_date,
      f.created_at
    FROM findings f
    INNER JOIN active_standards ast
      ON ast.standard_code = f.iso_code
    WHERE f.tenant_id = $1::uuid
      AND LOWER(COALESCE(f.status, 'open')) NOT IN ('closed', 'cerrado', 'cerrada', 'resuelto', 'resuelta')
    ORDER BY f.created_at DESC
    LIMIT 20
    `,
    [tenantId]
  );

  return result.rows;
}

async function getFindingById(tenantId, findingId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    )
    SELECT
      f.id,
      f.iso_code,
      f.title,
      f.description,
      f.severity,
      f.status,
      f.owner,
      f.due_date,
      f.created_at
    FROM findings f
    INNER JOIN active_standards ast
      ON ast.standard_code = f.iso_code
    WHERE f.tenant_id = $1::uuid
      AND f.id = $2::uuid
    LIMIT 1
    `,
    [tenantId, findingId]
  );

  return result.rows[0] || null;
}

async function getNonconformityById(tenantId, nonconformityId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    )
    SELECT
      tnc.id,
      tnc.tenant_id,
      tnc.control_id,
      tnc.nonconformity_id,
      COALESCE(tnc.control_description, cc.description, ncc.description) AS control_description,
      COALESCE(cc.iso, ncc.iso) AS iso_code,
      COALESCE(cc.clause, ncc.clause) AS clause,
      COALESCE(
        cc.category,
        CASE
          WHEN ncc.clause IS NOT NULL THEN 'Cláusula ' || ncc.clause
          ELSE NULL
        END
      ) AS category,
      tnc.status,
      tnc.detected_at,
      tnc.resolved_at
    FROM tenant_nonconformities tnc
    LEFT JOIN controls_catalog cc
      ON cc.id = tnc.control_id
    LEFT JOIN nonconformities_catalog ncc
      ON ncc.id = tnc.nonconformity_id
    INNER JOIN active_standards ast
      ON ast.standard_code = COALESCE(cc.iso, ncc.iso)
    WHERE tnc.tenant_id = $1::uuid
      AND tnc.id = $2::uuid
    LIMIT 1
    `,
    [tenantId, nonconformityId]
  );

  const row = result.rows[0] || null;

  if (!row) {
    return null;
  }

  return {
    ...row,
    title: buildNonconformityDerivedTitle({
      clause: row.clause,
      controlDescription: row.control_description,
      category: row.category,
    }),
    description:
      row.control_description ||
      row.category ||
      'No conformidad detectada',
    severity: 'media',
  };
}

async function getActionPlanById(tenantId, actionPlanId) {
  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      iso_code,
      title,
      description,
      priority,
      status,
      owner,
      due_date,
      source_type,
      finding_id,
      nonconformity_id,
      tenant_control_id,
      created_at,
      updated_at
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, actionPlanId]
  );

  return result.rows[0] || null;
}

async function getReusableNonconformityActionPlan(
  tenantId,
  nonconformityId,
  tenantControlId = null
) {
  if (!nonconformityId) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      iso_code,
      title,
      description,
      priority,
      status,
      owner,
      due_date,
      source_type,
      nonconformity_id,
      tenant_control_id,
      created_at,
      updated_at
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND nonconformity_id = $2::uuid
      AND source_type = 'nonconformity'
      AND (
        $3::uuid IS NULL
        OR tenant_control_id = $3::uuid
      )
      AND LOWER(COALESCE(status, 'abierto')) NOT IN (
        'completado',
        'closed',
        'cerrado',
        'cerrada',
        'resuelto',
        'resuelta'
      )
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
    `,
    [tenantId, nonconformityId, tenantControlId || null]
  );

  return result.rows[0] || null;
}

async function savePromptLog({
  tenantId,
  promptType,
  sourceModule,
  sourceEntityType = null,
  sourceEntityId = null,
  requestPayload = {},
  responsePayload = {},
  status = 'ok',
  errorMessage = null,
  createdBy = null,
}) {
  await pool.query(
    `
    INSERT INTO ai_prompt_logs (
      tenant_id,
      prompt_type,
      source_module,
      source_entity_type,
      source_entity_id,
      request_payload,
      response_payload,
      status,
      error_message,
      created_by
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5::uuid,
      $6::jsonb,
      $7::jsonb,
      $8,
      $9,
      $10::uuid
    )
    `,
    [
      tenantId,
      promptType,
      sourceModule,
      sourceEntityType,
      sourceEntityId,
      JSON.stringify(requestPayload || {}),
      JSON.stringify(responsePayload || {}),
      status,
      errorMessage,
      createdBy,
    ]
  );
}

async function saveSuggestionDraft({
  tenantId,
  suggestionType,
  sourceModule,
  sourceEntityType = null,
  sourceEntityId = null,
  title = null,
  inputPayload = {},
  outputPayload = {},
  confidence = null,
  createdBy = null,
}) {
  const result = await pool.query(
    `
    INSERT INTO ai_suggestions (
      tenant_id,
      suggestion_type,
      source_module,
      source_entity_type,
      source_entity_id,
      title,
      input_payload,
      output_payload,
      confidence,
      created_by
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5::uuid,
      $6,
      $7::jsonb,
      $8::jsonb,
      $9,
      $10::uuid
    )
    RETURNING *
    `,
    [
      tenantId,
      suggestionType,
      sourceModule,
      sourceEntityType,
      sourceEntityId,
      title,
      JSON.stringify(inputPayload || {}),
      JSON.stringify(outputPayload || {}),
      confidence,
      createdBy,
    ]
  );

  return result.rows[0];
}

async function listSuggestionDrafts(tenantId, suggestionType = null) {
  if (suggestionType) {
    const result = await pool.query(
      `
      SELECT
        id,
        tenant_id,
        suggestion_type,
        source_module,
        source_entity_type,
        source_entity_id,
        title,
        input_payload,
        output_payload,
        confidence,
        status,
        created_by,
        applied_by,
        applied_at,
        created_at,
        updated_at
      FROM ai_suggestions
      WHERE tenant_id = $1::uuid
        AND suggestion_type = $2
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [tenantId, suggestionType]
    );

    return result.rows;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      suggestion_type,
      source_module,
      source_entity_type,
      source_entity_id,
      title,
      input_payload,
      output_payload,
      confidence,
      status,
      created_by,
      applied_by,
      applied_at,
      created_at,
      updated_at
    FROM ai_suggestions
    WHERE tenant_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [tenantId]
  );

  return result.rows;
}

async function markSuggestionApplied(suggestionId, userId) {
  const result = await pool.query(
    `
    UPDATE ai_suggestions
    SET
      status = 'applied',
      applied_by = $2::uuid,
      applied_at = NOW(),
      updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [suggestionId, userId]
  );

  return result.rows[0] || null;
}

async function createDraftActionPlanFromSuggestion(tenantId, suggestion) {
  const payload = suggestion.output_payload || {};
  const input = suggestion.input_payload || {};

  const title =
    input.title ||
    payload.objective ||
    payload.title ||
    payload.recommended_action ||
    'Plan de acción generado por IA';

  const description = [
    payload.objective ? `Objetivo: ${payload.objective}` : '',
    payload.summary ? `Resumen: ${payload.summary}` : '',
    payload.reason ? `Razón: ${payload.reason}` : '',
    payload.recommended_action
      ? `Acción recomendada: ${payload.recommended_action}`
      : '',
    Array.isArray(payload.immediate_actions) && payload.immediate_actions.length
      ? `Acciones inmediatas: ${payload.immediate_actions.join(' | ')}`
      : '',
    Array.isArray(payload.success_criteria) && payload.success_criteria.length
      ? `Criterios de cierre: ${payload.success_criteria.join(' | ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const sourceType = 'ai_suggestion';
  const priority = normalizePriority(payload.priority || input.priority);
  const status = 'draft';

  const result = await pool.query(
    `
    INSERT INTO action_plans (
      tenant_id,
      iso_code,
      title,
      description,
      source_type,
      priority,
      status,
      owner,
      finding_id,
      created_at,
      updated_at
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      NULL,
      $8::uuid,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenantId,
      input.iso_code || null,
      title,
      description,
      sourceType,
      priority,
      status,
      input.finding_id || null,
    ]
  );

  return result.rows[0];
}


router.get('/engine-health', auth, async (req, res) => {
  try {
    const health = await getRobustAiComplianceEngineHealth();

    return res.json({
      ...health,
      locale: resolveLocale(req),
    });
  } catch (error) {
    console.error('IA COMPLIANCE ENGINE HEALTH SAFE ERROR:', error.message);

    return res.json({
      ok: true,
      locale: resolveLocale(req),
      data: {
        ok: false,
        service: 'ai-engine',
        env: process.env.NODE_ENV || 'production',
        db_connection: false,
        backend_db_connection: false,
        degraded: true,
        error: error.message || 'AI Engine unavailable',
      },
    });
  }
});

router.get('/engine-health', auth, async (_req, res) => {
  try {
    const healthRes = await fetch(`${AI_ENGINE_URL}/health/deep`, {
      headers: {
        'X-AI-Token': getAiInternalToken(),
      },
    });
    const text = await healthRes.text();

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return res.status(502).json({
        ok: false,
        error: 'Respuesta inválida desde AI Engine /health',
        raw: text,
      });
    }

    if (!healthRes.ok || json?.ok === false) {
      return res.status(502).json({
        ok: false,
        error: json?.detail || json?.error || 'AI Engine health profundo falló',
      });
    }

    return res.json({
      ok: true,
      locale,
      data: {
        ...json,
        db_connection: Boolean(json?.db_connection ?? json?.db_ok),
      },
    });
  } catch (error) {
    console.error('ERROR AI ENGINE HEALTH:', error);

    return res.status(500).json({
      ok: false,
      error: 'No fue posible conectar con AI Engine',
      ...errorDetail(error),
    });
  }
});

router.get('/health-summary', auth, async (req, res) => {
  const timer = createAiTimer({
    endpoint: '/api/ai-compliance/health-summary',
    mode: 'fast_mode',
    tenantId: resolveTenantId(req),
    operationId: req.query?.operation_id || null,
    standardCode: req.query?.standard_code || req.query?.iso || null,
  });
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id para IA Compliance',
      });
    }

    const tenantName = await getTenantName(tenantId);
    const standards = await getActiveStandards(tenantId);
    const stats = await getHealthSummaryStats(tenantId);

    const aiPayload = {
      tenant_id: tenantId,
      tenant_name: tenantName,
      standards,
      controls_total: stats.controls_total,
      controls_warning: stats.controls_warning,
      controls_critical: stats.controls_critical,
      evidences_pending: stats.evidences_pending,
      findings_critical: stats.findings_critical,
    };

    const seniorAuditorPayload = buildSeniorAuditorPayload({
      tenantId,
      tenantName,
      standards,
      stats,
      requestedOutput: 'global_analysis',
      allowWebContext: getAuditorWebContextFlag(req),
    });

    const complianceV2 = await runAiComplianceV2Analysis({
        tenantId,
        body: {
          depth: 'executive',
          local_compact: true,
          fast_mode: true,
          use_llm_in_fast_mode: false,
          use_web: false,
          use_drive: 'auto',
          use_rag: true,
        },
        question: 'Analiza el estado de cumplimiento, brechas críticas y acciones prioritarias del tenant.',
        taskType: 'standard_gap_analysis',
      });

    const seniorAuditor = complianceV2.aiResult;
    const metrics = timer.finish({
      mode: resolveAiMode(complianceV2.payload?.options, complianceV2.aiResult?.engine || {}),
      used_llm: complianceV2.aiResult?.engine?.used_llm === true,
      fast_mode: complianceV2.aiResult?.engine?.fast_mode === true,
      local_compact: complianceV2.aiResult?.engine?.local_compact === true,
      used_rag: complianceV2.aiResult?.engine?.used_rag === true,
      used_drive: complianceV2.aiResult?.engine?.used_drive === true,
      used_web: complianceV2.aiResult?.engine?.used_web === true,
    });
    const aiResponse = buildFastLegacyAiResponse({
      type: 'health_summary',
      endpoint: '/api/ai-compliance/health-summary',
      summary: complianceV2.aiResult?.structured_result?.executive_summary ||
        `Resumen rápido: ${stats.controls_total} controles, ${stats.controls_warning} en atención, ${stats.controls_critical} críticos, ${stats.evidences_pending} evidencias pendientes y ${stats.findings_critical} hallazgos críticos.`,
      suggestions: complianceV2.legacy.suggestions || [],
      confidence: complianceV2.aiResult?.confidence ?? 'media',
      source: 'ai-compliance-v2-fast',
      metrics,
    });

    const seniorAuditorSuggestions = await syncSeniorAuditorSuggestionsSafe({
      tenantId,
      seniorAuditor,
      sourceModule: 'ia_compliance_health_summary',
      sourceEntityType: 'tenant',
      sourceEntityId: tenantId,
      inputPayload: seniorAuditorPayload,
      createdBy: userId,
    });

    await savePromptLog({
      tenantId,
      promptType: 'health_summary',
      sourceModule: 'ia_compliance',
      sourceEntityType: 'tenant',
      sourceEntityId: tenantId,
      requestPayload: {
        health_summary: aiPayload,
        senior_auditor: seniorAuditorPayload,
        ai_v2: complianceV2.payload,
      },
      responsePayload: {
        health_summary: aiResponse,
        senior_auditor: seniorAuditor,
        ai_v2: complianceV2.aiResult,
        senior_auditor_suggestions: seniorAuditorSuggestions,
        metrics,
      },
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      context: aiPayload,
      ai: {
        ...(aiResponse || {}),
        structured_result: complianceV2.aiResult?.structured_result || null,
        source_trace: complianceV2.aiResult?.source_trace || [],
        limitations: complianceV2.aiResult?.limitations || [],
        engine: complianceV2.aiResult?.engine || {},
        metrics,
      },
      answer: complianceV2.aiResult?.answer || aiResponse?.summary || '',
      structured_result: complianceV2.aiResult?.structured_result || null,
      source_trace: complianceV2.aiResult?.source_trace || [],
      confidence: complianceV2.aiResult?.confidence ?? null,
      limitations: complianceV2.aiResult?.limitations || [],
      engine: complianceV2.aiResult?.engine || {},
      metrics,
      suggestions: complianceV2.legacy.suggestions || [],
      senior_auditor: seniorAuditor,
      senior_auditor_suggestions: seniorAuditorSuggestions,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE HEALTH SUMMARY:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error generando resumen IA de cumplimiento',
      ...errorDetail(error),
    });
  }
});

router.post('/analyze', auth, async (req, res) => {
  const timer = createAiTimer({
    endpoint: '/api/ai-compliance/analyze',
    mode: req.body?.fast_mode ? 'fast_mode' : 'local_compact',
    tenantId: resolveTenantId(req),
    operationId: req.body?.operation_id || null,
    standardCode: req.body?.standard_code || req.body?.iso || null,
  });
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id para IA Compliance',
      });
    }

    const question =
      req.body?.question ||
      'Analiza brechas críticas de cumplimiento, evidencia faltante y acciones prioritarias para auditoría.';

    const complianceV2 = await runAiComplianceV2Analysis({
      tenantId,
      body: req.body || {},
      question,
      taskType: req.body?.tenant_control_id
        ? 'control_analysis'
        : req.body?.evidence_id
          ? 'evidence_review'
          : req.body?.task_type || 'standard_gap_analysis',
    });
    const metrics = timer.finish({
      mode: resolveAiMode(complianceV2.payload?.options, complianceV2.aiResult?.engine || {}),
      used_llm: complianceV2.aiResult?.engine?.used_llm === true,
      fast_mode: complianceV2.aiResult?.engine?.fast_mode === true,
      local_compact: complianceV2.aiResult?.engine?.local_compact === true,
      used_rag: complianceV2.aiResult?.engine?.used_rag === true,
      used_drive: complianceV2.aiResult?.engine?.used_drive === true,
      used_web: complianceV2.aiResult?.engine?.used_web === true,
    });

    return res.json({
      ok: complianceV2.aiResult?.ok !== false,
      locale,
      tenant_id: tenantId,
      answer: complianceV2.aiResult?.answer || '',
      structured_result: complianceV2.aiResult?.structured_result || null,
      source_trace: complianceV2.aiResult?.source_trace || [],
      confidence: complianceV2.aiResult?.confidence ?? null,
      limitations: complianceV2.aiResult?.limitations || [],
      engine: complianceV2.aiResult?.engine || {},
      metrics,
      suggestions: complianceV2.legacy.suggestions || [],
      recommendations: complianceV2.legacy.recommendations || [],
      analysis: complianceV2.legacy.summary || '',
      summary: complianceV2.aiResult?.structured_result?.executive_summary || '',
      context: complianceV2.context,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE V2 ANALYZE:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error ejecutando análisis IA Compliance v2',
      ...errorDetail(error),
    });
  }
});

router.get('/findings', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id',
      });
    }

    const rows = await getOpenFindingsList(tenantId);

    return res.json({
      ok: true,
      locale,
      data: rows,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE FINDINGS:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error cargando hallazgos para IA Compliance',
      ...errorDetail(error),
    });
  }
});

router.post('/finding-analysis', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);
    const findingId = String(req.body?.finding_id || '');

    if (!tenantId || !findingId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id o finding_id no informado',
      });
    }

    const finding = await getFindingById(tenantId, findingId);

    if (!finding) {
      return res.status(404).json({
        ok: false,
        error: 'Hallazgo no encontrado en el tenant',
      });
    }

    const aiPayload = {
      tenant_id: tenantId,
      finding_id: finding.id,
      iso_code: finding.iso_code,
      title: finding.title,
      description: finding.description || '',
      severity: finding.severity || 'media',
      status: finding.status || 'open',
      owner: finding.owner || null,
      due_date: finding.due_date || null,
    };

    const aiResponse = await callAiEngine(
      '/api/ai/suggest/finding-analysis',
      aiPayload
    );

    const enhancedResult = await callEnhancedComplianceAnswer(req, {
      tenantId,
      question: buildEnhancedQuestion('finding_analysis', aiPayload),
      limit: 8,
      knowledgeLimit: 8,
      benchmarkLimit: 8,
      forceExternalLookup: req.body?.force_external_lookup === true,
      acceptExtraCharge: req.body?.accept_extra_charge === true,
    });

    const enrichedAiResponse = enrichAiResponseWithOrchestrator(
      aiResponse,
      enhancedResult
    );

    await savePromptLog({
      tenantId,
      promptType: 'finding_analysis',
      sourceModule: 'ia_compliance',
      sourceEntityType: 'finding',
      sourceEntityId: finding.id,
      requestPayload: {
        ...aiPayload,
        enhanced_question: buildEnhancedQuestion('finding_analysis', aiPayload),
      },
      responsePayload: enrichedAiResponse,
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      context: aiPayload,
      ai: enrichedAiResponse,
      enhanced: enhancedResult,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE FINDING ANALYSIS:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error analizando hallazgo con IA',
      ...errorDetail(error),
    });
  }
});

router.post('/nonconformity-draft', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);
    const nonconformityId = req.body?.nonconformity_id
      ? String(req.body.nonconformity_id)
      : null;

    let aiPayload = null;
    let sourceEntityType = 'manual_input';
    let sourceEntityId = null;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id',
      });
    }

    if (nonconformityId) {
      const nonconformity = await getNonconformityById(
        tenantId,
        nonconformityId
      );

      if (!nonconformity) {
        return res.status(404).json({
          ok: false,
          error: 'No conformidad no encontrada en el tenant',
        });
      }

      aiPayload = buildNonconformityAiPayload(tenantId, nonconformity, req.body || {});
      sourceEntityType = 'nonconformity';
      sourceEntityId = nonconformity.id;
    } else {
      aiPayload = buildNonconformityAiPayload(tenantId, {}, req.body || {});
    }

    if (!aiPayload.iso_code || !aiPayload.title || !aiPayload.description) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan datos para redactar la no conformidad',
      });
    }

    const aiResponse = await callAiEngine(
      '/api/ai/suggest/nonconformity-draft',
      aiPayload
    );

    const enhancedResult = await callEnhancedComplianceAnswer(req, {
      tenantId,
      question: buildEnhancedQuestion('nonconformity_draft', aiPayload),
      limit: 8,
      knowledgeLimit: 8,
      benchmarkLimit: 8,
      forceExternalLookup: req.body?.force_external_lookup === true,
      acceptExtraCharge: req.body?.accept_extra_charge === true,
    });

    const enrichedAiResponse = enrichAiResponseWithOrchestrator(
      aiResponse,
      enhancedResult
    );

    await savePromptLog({
      tenantId,
      promptType: 'nonconformity_draft',
      sourceModule: 'ia_compliance',
      sourceEntityType,
      sourceEntityId,
      requestPayload: {
        ...aiPayload,
        enhanced_question: buildEnhancedQuestion('nonconformity_draft', aiPayload),
      },
      responsePayload: enrichedAiResponse,
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      context: aiPayload,
      ai: enrichedAiResponse,
      enhanced: enhancedResult,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE NONCONFORMITY DRAFT:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error generando borrador de no conformidad',
      ...errorDetail(error),
    });
  }
});

router.post('/action-plan-suggestion', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);
    const findingId = String(req.body?.finding_id || '');

    if (!tenantId || !findingId) {
      return res.status(400).json({
        ok: false,
        error: 'Falta finding_id para sugerir plan de acción',
      });
    }

    const finding = await getFindingById(tenantId, findingId);

    if (!finding) {
      return res.status(404).json({
        ok: false,
        error: 'Hallazgo no encontrado en el tenant',
      });
    }

    const aiPayload = {
      tenant_id: tenantId,
      finding_id: finding.id,
      iso_code: finding.iso_code,
      title: finding.title,
      description: finding.description || '',
      severity: finding.severity || 'media',
      status: finding.status || 'open',
    };

    const aiResponse = await callAiEngine(
      '/api/ai/suggest/action-plan',
      aiPayload
    );

    const enhancedResult = await callEnhancedComplianceAnswer(req, {
      tenantId,
      question: buildEnhancedQuestion('action_plan_suggestion', aiPayload),
      limit: 8,
      knowledgeLimit: 8,
      benchmarkLimit: 8,
      forceExternalLookup: req.body?.force_external_lookup === true,
      acceptExtraCharge: req.body?.accept_extra_charge === true,
    });

    const enrichedAiResponse = enrichAiResponseWithOrchestrator(
      aiResponse,
      enhancedResult
    );

    await savePromptLog({
      tenantId,
      promptType: 'action_plan_suggestion',
      sourceModule: 'ia_compliance',
      sourceEntityType: 'finding',
      sourceEntityId: finding.id,
      requestPayload: aiPayload,
      responsePayload: enrichedAiResponse,
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      context: aiPayload,
      ai: enrichedAiResponse,
      enhanced: enhancedResult,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE ACTION PLAN:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error generando plan de acción con IA',
      ...errorDetail(error),
    });
  }
});

router.get('/executive-brief', auth, async (req, res) => {
  const timer = createAiTimer({
    endpoint: '/api/ai-compliance/executive-brief',
    mode: 'fast_mode',
    tenantId: resolveTenantId(req),
    operationId: req.query?.operation_id || null,
    standardCode: req.query?.standard_code || req.query?.iso || null,
  });
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id',
      });
    }

    const tenantName = await getTenantName(tenantId);
    const standards = await getActiveStandards(tenantId);
    const stats = await getHealthSummaryStats(tenantId);
    const weakestStandards = await getWeakestStandards(tenantId);

    const aiPayload = {
      tenant_id: tenantId,
      tenant_name: tenantName,
      period: String(req.query?.period || 'Periodo actual'),
      standards,
      controls_total: stats.controls_total,
      controls_warning: stats.controls_warning,
      controls_critical: stats.controls_critical,
      evidences_pending: stats.evidences_pending,
      findings_critical: stats.findings_critical,
      weakest_standards: weakestStandards,
    };

    const seniorAuditorPayload = buildSeniorAuditorPayload({
      tenantId,
      tenantName,
      standards,
      stats,
      weakestStandards,
      requestedOutput: 'report',
      allowWebContext: getAuditorWebContextFlag(req),
    });

    const complianceV2 = await runAiComplianceV2Analysis({
        tenantId,
        body: {
          depth: 'executive',
          local_compact: true,
          fast_mode: true,
          use_llm_in_fast_mode: false,
          use_web: false,
          use_drive: 'auto',
          use_rag: true,
        },
        question: `Genera un resumen ejecutivo de cumplimiento para ${aiPayload.period}, priorizando brechas y acciones gerenciales.`,
        taskType: 'standard_gap_analysis',
      });

    const seniorAuditor = complianceV2.aiResult;
    const metrics = timer.finish({
      mode: resolveAiMode(complianceV2.payload?.options, complianceV2.aiResult?.engine || {}),
      used_llm: complianceV2.aiResult?.engine?.used_llm === true,
      fast_mode: complianceV2.aiResult?.engine?.fast_mode === true,
      local_compact: complianceV2.aiResult?.engine?.local_compact === true,
      used_rag: complianceV2.aiResult?.engine?.used_rag === true,
      used_drive: complianceV2.aiResult?.engine?.used_drive === true,
      used_web: complianceV2.aiResult?.engine?.used_web === true,
    });
    const aiResponse = buildFastLegacyAiResponse({
      type: 'executive_brief',
      endpoint: '/api/ai-compliance/executive-brief',
      summary: complianceV2.aiResult?.structured_result?.executive_summary ||
        `Resumen ejecutivo rápido para ${tenantName}: ${stats.controls_total} controles, ${stats.controls_warning} en atención, ${stats.controls_critical} críticos y ${stats.evidences_pending} evidencias pendientes.`,
      suggestions: complianceV2.legacy.suggestions || [],
      confidence: complianceV2.aiResult?.confidence ?? 'media',
      source: 'ai-compliance-v2-fast',
      metrics,
    });

    const seniorAuditorSuggestions = await syncSeniorAuditorSuggestionsSafe({
      tenantId,
      seniorAuditor,
      sourceModule: 'ia_compliance_executive_brief',
      sourceEntityType: 'tenant',
      sourceEntityId: tenantId,
      inputPayload: seniorAuditorPayload,
      createdBy: userId,
    });

    await savePromptLog({
      tenantId,
      promptType: 'executive_brief',
      sourceModule: 'ia_compliance',
      sourceEntityType: 'tenant',
      sourceEntityId: tenantId,
      requestPayload: {
        executive_brief: aiPayload,
        senior_auditor: seniorAuditorPayload,
        ai_v2: complianceV2.payload,
      },
      responsePayload: {
        executive_brief: aiResponse,
        senior_auditor: seniorAuditor,
        ai_v2: complianceV2.aiResult,
        senior_auditor_suggestions: seniorAuditorSuggestions,
        metrics,
      },
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      context: aiPayload,
      ai: {
        ...(aiResponse || {}),
        structured_result: complianceV2.aiResult?.structured_result || null,
        source_trace: complianceV2.aiResult?.source_trace || [],
        limitations: complianceV2.aiResult?.limitations || [],
        engine: complianceV2.aiResult?.engine || {},
        metrics,
      },
      answer: complianceV2.aiResult?.answer || aiResponse?.executive_summary || '',
      structured_result: complianceV2.aiResult?.structured_result || null,
      source_trace: complianceV2.aiResult?.source_trace || [],
      confidence: complianceV2.aiResult?.confidence ?? null,
      limitations: complianceV2.aiResult?.limitations || [],
      engine: complianceV2.aiResult?.engine || {},
      metrics,
      suggestions: complianceV2.legacy.suggestions || [],
      senior_auditor: seniorAuditor,
      senior_auditor_suggestions: seniorAuditorSuggestions,
    });
  } catch (error) {
    console.error('ERROR AI COMPLIANCE EXECUTIVE BRIEF:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error generando resumen gerencial con IA',
      ...errorDetail(error),
    });
  }
});

router.get('/suggestions', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const suggestionType = req.query?.suggestion_type
      ? String(req.query.suggestion_type)
      : null;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id',
      });
    }

    const rows = await listSuggestionDrafts(tenantId, suggestionType);

    return res.json({
      ok: true,
      locale,
      data: rows,
    });
  } catch (error) {
    console.error('ERROR AI SUGGESTIONS LIST:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error listando sugerencias IA',
      ...errorDetail(error),
    });
  }
});

router.post('/suggestions/save', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);

    const {
      suggestion_type,
      source_module,
      source_entity_type,
      source_entity_id,
      title,
      input_payload,
      output_payload,
      confidence,
    } = req.body || {};

    if (!tenantId || !suggestion_type || !source_module || !output_payload) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan datos para guardar sugerencia IA',
      });
    }

    const row = await saveSuggestionDraft({
      tenantId,
      suggestionType: suggestion_type,
      sourceModule: source_module,
      sourceEntityType: source_entity_type || null,
      sourceEntityId: source_entity_id || null,
      title: title || null,
      inputPayload: input_payload || {},
      outputPayload: output_payload || {},
      confidence: confidence || null,
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      data: row,
    });
  } catch (error) {
    console.error('ERROR SAVE AI SUGGESTION:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error guardando sugerencia IA',
      ...errorDetail(error),
    });
  }
});

router.post('/suggestions/:id/apply', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const suggestionId = String(req.params.id || '');
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);
    const applyMode = String(req.body?.apply_mode || 'mark_only');

    if (!tenantId || !suggestionId) {
      return res.status(400).json({
        ok: false,
        error: 'Falta suggestionId o tenantId',
      });
    }

    const suggestionRes = await pool.query(
      `
      SELECT *
      FROM ai_suggestions
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      LIMIT 1
      `,
      [suggestionId, tenantId]
    );

    const suggestion = suggestionRes.rows[0];

    if (!suggestion) {
      return res.status(404).json({
        ok: false,
        error: 'Sugerencia IA no encontrada',
      });
    }

    let appliedArtifact = null;

    const canCreateActionPlanDraft =
      applyMode === 'create_action_plan_draft' &&
      (
        suggestion.suggestion_type === 'action_plan_suggestion' ||
        [
          'senior_auditor_task',
          'senior_auditor_risk_alert',
          'senior_auditor_evidence_gap',
          'senior_auditor_insight',
        ].includes(suggestion.suggestion_type) ||
        suggestion.output_payload?.should_create_task === true
      );

    if (canCreateActionPlanDraft) {
      appliedArtifact = await createDraftActionPlanFromSuggestion(
        tenantId,
        suggestion
      );
    }

    const updated = await markSuggestionApplied(suggestionId, userId);

    return res.json({
      ok: true,
      locale,
      data: updated,
      applied_artifact: appliedArtifact,
    });
  } catch (error) {
    console.error('ERROR APPLY AI SUGGESTION:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error aplicando sugerencia IA',
      ...errorDetail(error),
    });
  }
});

/*
 * NUEVOS ENDPOINTS PARA APLICACIÓN DIRECTA EN MÓDULOS
 */

router.post('/apply/finding-analysis-to-finding', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);
    const findingId = String(req.body?.finding_id || '');
    let aiResult = req.body?.ai_result || null;

    if (!tenantId || !findingId) {
      return res.status(400).json({
        ok: false,
        error: 'Falta finding_id o tenant_id',
      });
    }

    const finding = await getFindingById(tenantId, findingId);

    if (!finding) {
      return res.status(404).json({
        ok: false,
        error: 'Hallazgo no encontrado',
      });
    }

    if (!aiResult) {
      const aiPayload = {
        tenant_id: tenantId,
        finding_id: finding.id,
        iso_code: finding.iso_code,
        title: finding.title,
        description: finding.description || '',
        severity: finding.severity || 'media',
        status: finding.status || 'open',
        owner: finding.owner || null,
        due_date: finding.due_date || null,
      };

      const aiResponse = await callAiEngine(
        '/api/ai/suggest/finding-analysis',
        aiPayload
      );

      aiResult = aiResponse;
    }

    const aiData = aiResult?.ai || aiResult;
    if (!aiData?.summary) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió análisis IA válido',
      });
    }

    const appendBlock = buildFindingAiAppendBlock(aiData);
    const nextDescription = upsertAiBlock(
      finding.description || '',
      appendBlock,
      'finding_analysis'
    );

    const updateRes = await pool.query(
      `
      UPDATE findings
      SET
        description = $2,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $3::uuid
      RETURNING *
      `,
      [finding.id, nextDescription, tenantId]
    );

    await savePromptLog({
      tenantId,
      promptType: 'finding_analysis_apply_direct',
      sourceModule: 'ia_compliance_apply',
      sourceEntityType: 'finding',
      sourceEntityId: finding.id,
      requestPayload: req.body || {},
      responsePayload: aiData,
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      data: updateRes.rows[0],
      applied_text: appendBlock,
    });
  } catch (error) {
    console.error('ERROR APPLY FINDING ANALYSIS DIRECT:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error aplicando análisis IA al hallazgo',
      ...errorDetail(error),
    });
  }
});


function extractActionPlanAiTrace(aiResult) {
  const ai = aiResult?.ai || aiResult || {};
  const enhanced = aiResult?.enhanced || null;
  const enhancedAnswer =
    enhanced?.answer ||
    ai?.enhanced_answer ||
    null;

  const enhancedOrchestration =
    ai?.enhanced_orchestration ||
    (
      enhanced
        ? {
            ok: enhanced?.ok === true,
            question: enhanced?.question || null,
            trace: enhanced?.trace || null,
            search_trace: enhanced?.search_trace || null,
            source_level: enhancedAnswer?.source_level || null,
            source_label: enhancedAnswer?.source_label || null,
            confidence: enhancedAnswer?.confidence || null,
            confidence_score: enhancedAnswer?.confidence_score || null,
          }
        : null
    );

  const structuredGuided = ai?.structured_guided || {};
  const knowledgeSources = structuredGuided?.knowledge_sources || {};

  const traceId =
    ai?.enhanced_trace_id ||
    enhanced?.trace?.id ||
    enhancedOrchestration?.trace?.id ||
    structuredGuided?.trace_id ||
    knowledgeSources?.trace_id ||
    null;

  const sourceLevel =
    ai?.enhanced_source_level ||
    enhancedAnswer?.source_level ||
    enhancedOrchestration?.source_level ||
    knowledgeSources?.source_level ||
    null;

  const sourceLabel =
    ai?.enhanced_source_label ||
    enhancedAnswer?.source_label ||
    enhancedOrchestration?.source_label ||
    knowledgeSources?.source_label ||
    null;

  const confidence =
    ai?.enhanced_confidence ||
    enhancedAnswer?.confidence ||
    enhancedOrchestration?.confidence ||
    knowledgeSources?.confidence ||
    ai?.confidence ||
    null;

  const confidenceScore =
    enhancedAnswer?.confidence_score ||
    enhancedOrchestration?.confidence_score ||
    null;

  return {
    traceId: traceId || null,
    sourceLevel: sourceLevel || null,
    sourceLabel: sourceLabel || null,
    confidence: confidence ? String(confidence) : null,
    confidenceScore:
      confidenceScore === null || confidenceScore === undefined || confidenceScore === ''
        ? null
        : Number(confidenceScore),
    orchestrationJson: enhancedOrchestration || {},
    enhancedAnswerJson: enhancedAnswer || {},
  };
}



function actionPlanAiTraceIsEmpty(trace) {
  // La confianza del motor IA antiguo puede venir como 0.95 o 1,
  // pero eso NO significa que exista trazabilidad del orquestador central.
  // Para considerar que hay traza real exigimos traceId, sourceLevel o sourceLabel.
  return !trace?.traceId &&
    !trace?.sourceLevel &&
    !trace?.sourceLabel;
}

async function ensureActionPlanAiResultHasTrace(req, {
  tenantId,
  aiResult,
  kind,
  payload,
}) {
  const currentTrace = extractActionPlanAiTrace(aiResult);

  if (!actionPlanAiTraceIsEmpty(currentTrace)) {
    return aiResult;
  }

  if (
    typeof callEnhancedComplianceAnswer !== 'function' ||
    typeof buildEnhancedQuestion !== 'function' ||
    typeof enrichAiResponseWithOrchestrator !== 'function'
  ) {
    return aiResult;
  }

  const enhancedResult = await callEnhancedComplianceAnswer(req, {
    tenantId,
    question: buildEnhancedQuestion(kind, payload || {}),
    limit: 8,
    knowledgeLimit: 8,
    benchmarkLimit: 8,
    forceExternalLookup: req.body?.force_external_lookup === true,
    acceptExtraCharge: req.body?.accept_extra_charge === true,
  });

  if (!enhancedResult?.ok || !enhancedResult?.answer) {
    return aiResult;
  }

  const baseAi = aiResult?.ai || aiResult || {};

  return {
    ...(aiResult && typeof aiResult === 'object' ? aiResult : {}),
    ai: enrichAiResponseWithOrchestrator(baseAi, enhancedResult),
    enhanced: enhancedResult,
  };
}


router.post('/apply/action-plan-suggestion-to-plan', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);
    const actionPlanId = String(req.body?.action_plan_id || '');
    const findingId = req.body?.finding_id ? String(req.body.finding_id) : null;
    let aiResult = req.body?.ai_result || null;

    if (!tenantId || !actionPlanId) {
      return res.status(400).json({
        ok: false,
        error: 'Falta action_plan_id o tenant_id',
      });
    }

    const actionPlan = await getActionPlanById(tenantId, actionPlanId);

    if (!actionPlan) {
      return res.status(404).json({
        ok: false,
        error: 'Plan de acción no encontrado',
      });
    }

    if (!aiResult) {
      const effectiveFindingId = findingId || actionPlan.finding_id;

      if (!effectiveFindingId) {
        return res.status(400).json({
          ok: false,
          error: 'No se encontró finding_id para generar plan IA',
        });
      }

      const finding = await getFindingById(tenantId, effectiveFindingId);

      if (!finding) {
        return res.status(404).json({
          ok: false,
          error: 'Hallazgo origen no encontrado',
        });
      }

      const aiPayload = {
        tenant_id: tenantId,
        finding_id: finding.id,
        iso_code: finding.iso_code,
        title: finding.title,
        description: finding.description || '',
        severity: finding.severity || 'media',
        status: finding.status || 'open',
      };

      const aiResponse = await callAiEngine(
        '/api/ai/suggest/action-plan',
        aiPayload
      );

      aiResult = aiResponse;
    }

    aiResult = await ensureActionPlanAiResultHasTrace(req, {
      tenantId,
      aiResult,
      kind: 'action_plan_suggestion',
      payload: {
        tenant_id: tenantId,
        action_plan_id: actionPlan.id,
        iso_code: actionPlan.iso_code,
        title: actionPlan.title,
        description: actionPlan.description,
        priority: actionPlan.priority,
        status: actionPlan.status,
        finding_id: findingId || actionPlan.finding_id || null,
      },
    });

    const aiData = aiResult?.ai || aiResult;
    if (!aiData?.objective) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió plan IA válido',
      });
    }

    const aiTrace = extractActionPlanAiTrace(aiResult);

    const appendBlock = buildActionPlanAiAppendBlock(aiData);
    const nextDescription = upsertAiBlock(
      actionPlan.description || '',
      appendBlock,
      'action_plan'
    );

    const nextPriority = normalizePriority(aiData.priority);
    const nextStatus =
      actionPlan.status === 'abierto' ? 'en progreso' : actionPlan.status;

    const currentProgress = await getLatestActionPlanProgress(client, actionPlan.id);
    const nextProgress = normalizeProgress(null, currentProgress, nextStatus);

    await client.query('BEGIN');

    const updateRes = await client.query(
      `
      UPDATE action_plans
      SET
        description = $2,
        priority = $3,
        status = $4,
        ai_trace_id = COALESCE(NULLIF($5::text, '')::uuid, ai_trace_id),
        ai_source_level = COALESCE(NULLIF($6::text, ''), ai_source_level),
        ai_source_label = COALESCE(NULLIF($7::text, ''), ai_source_label),
        ai_confidence = COALESCE(NULLIF($8::text, ''), ai_confidence),
        ai_confidence_score = COALESCE($9::numeric, ai_confidence_score),
        ai_orchestration_json = CASE
          WHEN COALESCE($10::jsonb, '{}'::jsonb) = '{}'::jsonb
            THEN ai_orchestration_json
          ELSE $10::jsonb
        END,
        ai_enhanced_answer_json = CASE
          WHEN COALESCE($11::jsonb, '{}'::jsonb) = '{}'::jsonb
            THEN ai_enhanced_answer_json
          ELSE $11::jsonb
        END,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $12::uuid
      RETURNING *
      `,
      [
        actionPlan.id,
        nextDescription,
        nextPriority,
        nextStatus,
        aiTrace.traceId || '',
        aiTrace.sourceLevel || '',
        aiTrace.sourceLabel || '',
        aiTrace.confidence || '',
        aiTrace.confidenceScore,
        JSON.stringify(aiTrace.orchestrationJson || {}),
        JSON.stringify(aiTrace.enhancedAnswerJson || {}),
        tenantId,
      ]
    );

    await insertActionPlanUpdate(client, {
      actionPlanId: actionPlan.id,
      tenantId,
      comment: 'Plan actualizado con sugerencia IA.',
      progressPercent: nextProgress,
      statusAfter: nextStatus,
      blockedReason: null,
      createdBy: userId,
    });

    await client.query('COMMIT');

    await savePromptLog({
      tenantId,
      promptType: 'action_plan_apply_direct',
      sourceModule: 'ia_compliance_apply',
      sourceEntityType: 'action_plan',
      sourceEntityId: actionPlan.id,
      requestPayload: req.body || {},
      responsePayload: aiData,
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      data: updateRes.rows[0],
      applied_text: appendBlock,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR APPLY ACTION PLAN DIRECT:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error aplicando plan IA al plan de acción',
      ...errorDetail(error),
    });
  } finally {
    client.release();
  }
});

router.post('/apply/nonconformity-draft-to-action-plan', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const tenantId = resolveTenantId(req);
    const userId = getUserId(req.user);

    const {
      nonconformity_id,
      iso_code,
      nc_title,
      nc_description,
      tenant_control_id,
      owner,
      due_date,
    } = req.body || {};

    let aiResult = req.body?.ai_result || null;
    let effectivePayload = null;

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar tenant_id',
      });
    }

    if (!aiResult) {
      if (nonconformity_id) {
        const nonconformity = await getNonconformityById(
          tenantId,
          String(nonconformity_id)
        );

        if (!nonconformity) {
          return res.status(404).json({
            ok: false,
            error: 'No conformidad no encontrada en el tenant',
          });
        }

        effectivePayload = buildNonconformityAiPayload(tenantId, nonconformity, {
          ...req.body,
          title: nc_title || undefined,
          description: nc_description || undefined,
        });
      } else {
        effectivePayload = buildNonconformityAiPayload(tenantId, {}, {
          ...req.body,
          title: nc_title || undefined,
          description: nc_description || undefined,
        });
      }

      if (
        !effectivePayload.iso_code ||
        !effectivePayload.title ||
        !effectivePayload.description
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Faltan datos para crear acción desde borrador IA de NC',
        });
      }

      const aiResponse = await callAiEngine(
        '/api/ai/suggest/nonconformity-draft',
        effectivePayload
      );

      aiResult = aiResponse;
    } else {
      effectivePayload = buildNonconformityAiPayload(tenantId, {}, {
        ...req.body,
        title: nc_title || undefined,
        description: nc_description || undefined,
      });
    }

    aiResult = await ensureActionPlanAiResultHasTrace(req, {
      tenantId,
      aiResult,
      kind: 'nonconformity_draft',
      payload: {
        ...(effectivePayload || {}),
        tenant_id: tenantId,
        nonconformity_id: nonconformity_id || null,
        iso_code: effectivePayload?.iso_code || iso_code || null,
        title: effectivePayload?.title || nc_title || null,
        description: effectivePayload?.description || nc_description || null,
      },
    });

    const aiData = aiResult?.ai || aiResult;
    if (!aiData?.corrective_action && !aiData?.statement) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió borrador IA válido para la no conformidad',
      });
    }

    const aiTrace = extractActionPlanAiTrace(aiResult);

    const finalIsoCode = effectivePayload?.iso_code || iso_code || null;
    const finalTenantControlId =
      effectivePayload?.tenant_control_id || tenant_control_id || null;

    if (!finalIsoCode) {
      return res.status(400).json({
        ok: false,
        error: 'No se pudo determinar iso_code para crear la acción',
      });
    }

    const title =
      aiData?.draft_title ||
      effectivePayload?.title ||
      'Plan de acción derivado de no conformidad';

    const description = buildNonconformityActionPlanDescription(aiData);
    const priority = normalizePriority('media');

    const reusablePlan = await getReusableNonconformityActionPlan(
      tenantId,
      nonconformity_id || null,
      finalTenantControlId || null
    );

    let savedRow = null;

    await client.query('BEGIN');

    if (reusablePlan) {
      const updateRes = await client.query(
        `
        UPDATE action_plans
        SET
          iso_code = $2,
          title = $3,
          description = $4,
          priority = $5,
          owner = $6,
          due_date = $7,
          tenant_control_id = $8::uuid,
          ai_trace_id = COALESCE(NULLIF($9::text, '')::uuid, ai_trace_id),
          ai_source_level = COALESCE(NULLIF($10::text, ''), ai_source_level),
          ai_source_label = COALESCE(NULLIF($11::text, ''), ai_source_label),
          ai_confidence = COALESCE(NULLIF($12::text, ''), ai_confidence),
          ai_confidence_score = COALESCE($13::numeric, ai_confidence_score),
          ai_orchestration_json = CASE
            WHEN COALESCE($14::jsonb, '{}'::jsonb) = '{}'::jsonb
              THEN ai_orchestration_json
            ELSE $14::jsonb
          END,
          ai_enhanced_answer_json = CASE
            WHEN COALESCE($15::jsonb, '{}'::jsonb) = '{}'::jsonb
              THEN ai_enhanced_answer_json
            ELSE $15::jsonb
          END,
          updated_at = NOW()
        WHERE id = $1::uuid
          AND tenant_id = $16::uuid
        RETURNING *
        `,
        [
          reusablePlan.id,
          finalIsoCode,
          title,
          description,
          priority,
          owner || null,
          due_date || null,
          finalTenantControlId || null,
          aiTrace.traceId || '',
          aiTrace.sourceLevel || '',
          aiTrace.sourceLabel || '',
          aiTrace.confidence || '',
          aiTrace.confidenceScore,
          JSON.stringify(aiTrace.orchestrationJson || {}),
          JSON.stringify(aiTrace.enhancedAnswerJson || {}),
          tenantId,
        ]
      );

      savedRow = updateRes.rows[0];

      const currentProgress = await getLatestActionPlanProgress(client, reusablePlan.id);
      const nextProgress = normalizeProgress(
        null,
        currentProgress,
        savedRow.status || 'abierto'
      );

      await insertActionPlanUpdate(client, {
        actionPlanId: reusablePlan.id,
        tenantId,
        comment: 'Plan actualizado desde borrador IA de no conformidad.',
        progressPercent: nextProgress,
        statusAfter: savedRow.status || 'abierto',
        blockedReason: null,
        createdBy: userId,
      });
    } else {
      const insertRes = await client.query(
        `
        INSERT INTO action_plans (
          tenant_id,
          iso_code,
          title,
          description,
          source_type,
          priority,
          status,
          owner,
          due_date,
          nonconformity_id,
          tenant_control_id,
          ai_trace_id,
          ai_source_level,
          ai_source_label,
          ai_confidence,
          ai_confidence_score,
          ai_orchestration_json,
          ai_enhanced_answer_json,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          'nonconformity',
          $5,
          'abierto',
          $6,
          $7,
          $8::uuid,
          $9::uuid,
          NULLIF($10::text, '')::uuid,
          NULLIF($11::text, ''),
          NULLIF($12::text, ''),
          NULLIF($13::text, ''),
          $14::numeric,
          COALESCE($15::jsonb, '{}'::jsonb),
          COALESCE($16::jsonb, '{}'::jsonb),
          NOW(),
          NOW()
        )
        RETURNING *
        `,
        [
          tenantId,
          finalIsoCode,
          title,
          description,
          priority,
          owner || null,
          due_date || null,
          nonconformity_id || null,
          finalTenantControlId || null,
          aiTrace.traceId || '',
          aiTrace.sourceLevel || '',
          aiTrace.sourceLabel || '',
          aiTrace.confidence || '',
          aiTrace.confidenceScore,
          JSON.stringify(aiTrace.orchestrationJson || {}),
          JSON.stringify(aiTrace.enhancedAnswerJson || {}),
        ]
      );

      savedRow = insertRes.rows[0];

      await insertActionPlanUpdate(client, {
        actionPlanId: savedRow.id,
        tenantId,
        comment: 'Plan creado desde borrador IA de no conformidad.',
        progressPercent: 0,
        statusAfter: 'abierto',
        blockedReason: null,
        createdBy: userId,
      });
    }

    await client.query('COMMIT');

    await savePromptLog({
      tenantId,
      promptType: 'nonconformity_to_action_plan_apply_direct',
      sourceModule: 'ia_compliance_apply',
      sourceEntityType: nonconformity_id ? 'nonconformity' : 'manual_input',
      sourceEntityId: nonconformity_id || null,
      requestPayload: effectivePayload || req.body || {},
      responsePayload: aiData,
      status: 'ok',
      createdBy: userId,
    });

    return res.json({
      ok: true,
      locale,
      data: savedRow,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR APPLY NC DRAFT TO ACTION PLAN:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error creando acción desde borrador IA de no conformidad',
      ...errorDetail(error),
    });
  } finally {
    client.release();
  }
});

module.exports = router;
