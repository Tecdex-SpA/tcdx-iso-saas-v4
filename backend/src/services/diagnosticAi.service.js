'use strict';

const crypto = require('crypto');
const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const diagnosticService = require('./diagnostic.service');
const { buildRecommendationPayload } = require('./evidenceRecommendationEngine.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_MAX_ITEMS = 12;
const DEFAULT_MAX_CHUNKS = 8;
const MAX_SNIPPET_LENGTH = 700;
const schemaCache = new Map();

function publicError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function asString(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function confidenceLabel(value, fallback = 'medium') {
  const text = String(value || '').toLowerCase().trim();
  if (['high', 'alta', 'alto'].includes(text)) return 'high';
  if (['low', 'baja', 'bajo'].includes(text)) return 'low';
  if (['medium', 'media', 'medio'].includes(text)) return 'medium';
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0.75) return 'high';
    if (numeric <= 0.4) return 'low';
  }
  return fallback;
}

function priorityForStatus(status) {
  if (status === 'missing_evidence') return 'high';
  if (status === 'needs_review' || status === 'partially_covered') return 'medium';
  return 'low';
}

function sourceKey(source) {
  return `${source.source_type}:${source.source_id}`;
}

function shortSnippet(value, max = MAX_SNIPPET_LENGTH) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function tableExists(tableName) {
  const key = `table:${tableName}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [tableName]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(key, exists);
  return exists;
}

async function loadTenantContext(tenantId) {
  const context = {
    tenant_id: tenantId,
    company_profile: null,
    applicability_profile: null,
    context_quality: 'generic_adaptable',
  };

  if (await tableExists('tenant_company_profiles')) {
    const result = await pool.query(
      `
      SELECT
        industry,
        subindustry,
        company_size,
        maturity_level,
        risk_appetite,
        profile_json,
        ai_profile_summary_json
      FROM tenant_company_profiles
      WHERE tenant_id = $1::uuid
      LIMIT 1
      `,
      [tenantId]
    );

    if (result.rowCount > 0) {
      const row = result.rows[0];
      context.company_profile = {
        industry: row.industry || row.profile_json?.industry || null,
        subindustry: row.subindustry || row.profile_json?.subindustry || null,
        company_size: row.company_size || row.profile_json?.company_size || null,
        maturity_level: row.maturity_level || row.profile_json?.maturity_level || null,
        risk_appetite: row.risk_appetite || null,
        profile_summary: row.ai_profile_summary_json?.executive_summary || row.profile_json?.summary || null,
        critical_processes: asArray(row.profile_json?.critical_processes).slice(0, 12),
      };
      context.context_quality = 'tenant_profile';
    }
  }

  if (await tableExists('tenant_applicability_profiles')) {
    const result = await pool.query(
      `
      SELECT
        industry,
        subindustry,
        company_size,
        maturity_level,
        risk_appetite,
        declared_scope,
        critical_processes,
        active_standards
      FROM tenant_applicability_profiles
      WHERE tenant_id = $1::uuid
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
      `,
      [tenantId]
    );

    if (result.rowCount > 0) {
      const row = result.rows[0];
      context.applicability_profile = {
        industry: row.industry || null,
        subindustry: row.subindustry || null,
        company_size: row.company_size || null,
        maturity_level: row.maturity_level || null,
        risk_appetite: row.risk_appetite || null,
        declared_scope: row.declared_scope || {},
        critical_processes: asArray(row.critical_processes).slice(0, 12),
        active_standards: asArray(row.active_standards).slice(0, 12),
      };
      if (context.context_quality === 'generic_adaptable') context.context_quality = 'applicability_profile';
    }
  }

  return context;
}

function collectSourceRefs(controls) {
  const refs = new Map();
  for (const control of controls) {
    const sources = [
      ...asArray(control.evidence?.existing),
      ...asArray(control.evidence?.candidates),
    ];
    for (const source of sources) {
      if (!source?.source_type || !source?.source_id || !isUuid(source.source_id)) continue;
      const key = sourceKey(source);
      refs.set(key, {
        source_type: source.source_type,
        source_id: source.source_id,
        document_title: source.name || source.file_name || source.description || 'Evidencia',
      });
    }
  }
  return Array.from(refs.values());
}

async function loadEvidenceChunks({ tenantId, controls, includeChunks, maxChunks }) {
  if (!includeChunks || !(await tableExists('tenant_evidence_chunks'))) return new Map();
  const refs = collectSourceRefs(controls).slice(0, 40);
  if (refs.length === 0) return new Map();

  const params = [tenantId];
  const pairs = refs.map((ref) => {
    params.push(ref.source_type, ref.source_id);
    return `(c.source_type = $${params.length - 1} AND c.source_id = $${params.length}::uuid)`;
  });

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.source_type,
      c.source_id,
      c.chunk_index,
      c.page_number,
      c.section_label,
      c.chunk_text,
      d.file_name AS document_file_name,
      d.relative_path AS document_relative_path,
      d.status AS document_status,
      e.file_name AS evidence_file_name,
      e.description AS evidence_description,
      e.status AS evidence_status
    FROM tenant_evidence_chunks c
    LEFT JOIN document_index d
      ON c.source_type = 'document_index'
     AND d.id = c.source_id
     AND d.tenant_id = c.tenant_id
    LEFT JOIN evidences e
      ON c.source_type = 'evidence'
     AND e.id = c.source_id
     AND e.tenant_id = c.tenant_id
    WHERE c.tenant_id = $1::uuid
      AND (${pairs.join(' OR ')})
      AND (
        (c.source_type = 'document_index' AND d.id IS NOT NULL AND COALESCE(d.status, 'indexed') NOT IN ('deleted', 'ignored', 'missing', 'excluded', 'error'))
        OR
        (c.source_type = 'evidence' AND e.id IS NOT NULL AND COALESCE(e.status, 'active') NOT IN ('deleted', 'eliminada', 'eliminado', 'rechazada', 'rechazado', 'rejected'))
      )
    ORDER BY c.source_type, c.source_id, c.chunk_index ASC, c.created_at DESC NULLS LAST
    LIMIT ${Math.max(1, Math.min(Number(maxChunks || DEFAULT_MAX_CHUNKS) * 4, 80))}
    `,
    params
  );

  const bySource = new Map();
  for (const row of result.rows) {
    const key = `${row.source_type}:${row.source_id}`;
    if (!bySource.has(key)) bySource.set(key, []);
    if (bySource.get(key).length >= Number(maxChunks || DEFAULT_MAX_CHUNKS)) continue;
    bySource.get(key).push({
      source_type: 'chunk',
      source_id: row.source_id,
      chunk_id: row.id,
      document_title: row.document_file_name || row.document_relative_path || row.evidence_file_name || row.evidence_description || 'Evidencia',
      snippet: shortSnippet(row.chunk_text),
      page_number: row.page_number || null,
      section_label: row.section_label || null,
      reason: 'Fragmento semantico disponible para trazabilidad del diagnostico.',
    });
  }

  return bySource;
}

function controlSources(control, chunksBySource) {
  const sources = [];
  const evidenceSources = [
    ...asArray(control.evidence?.existing),
    ...asArray(control.evidence?.candidates),
  ];

  for (const source of evidenceSources.slice(0, 8)) {
    const sourceType = source.source_type || 'evidence';
    const sourceId = source.source_id || source.id || null;
    const key = `${sourceType}:${sourceId}`;
    const chunks = chunksBySource.get(key) || [];

    if (chunks.length > 0) {
      sources.push(...chunks.slice(0, 2));
      continue;
    }

    sources.push({
      source_type: sourceType,
      source_id: isUuid(sourceId) ? sourceId : null,
      document_title: source.name || source.file_name || source.description || 'Evidencia',
      chunk_id: null,
      snippet: source.snippet ? shortSnippet(source.snippet) : '',
      reason: source.reason || 'Evidencia o sugerencia asociada al control.',
    });
  }

  if (sources.length === 0) {
    sources.push({
      source_type: 'absence',
      source_id: null,
      document_title: null,
      chunk_id: null,
      snippet: '',
      reason: 'No se encontraron documentos activos asociados ni chunks semanticos suficientes para demostrar trazabilidad completa.',
    });
  }

  return sources.slice(0, 8);
}

function deterministicRecommendationFor(control) {
  const recommended = asArray(control.evidence?.recommended);
  if (recommended.length > 0) return recommended;

  return buildRecommendationPayload({
    standard_code: control.standard_code,
    clause: control.clause,
    tenant_control_id: control.tenant_control_id,
    control_id: control.catalog_control_id,
    control_description: control.description,
    process_name: control.process?.name,
    operation_name: control.operation?.name,
    area: control.process?.area,
    priority: control.priority,
    criticality: control.process?.criticality,
    active_evidence_count: control.evidence?.active_count || 0,
    candidate_evidence_count: control.evidence?.candidate_count || 0,
    existing_evidences: control.evidence?.existing || [],
    existing_gaps: [...asArray(control.gaps?.nonconformities), ...asArray(control.gaps?.findings)],
    existing_actions: control.actions?.existing || [],
    existing_risks: control.risks?.existing || [],
    max_recommendations: 3,
  }).recommended_evidence;
}

function normalizeEvidence(item) {
  return {
    name: asString(item?.name || item?.title || 'Evidencia recomendada', 180),
    purpose: asString(item?.purpose || item?.description || 'Demostrar trazabilidad objetiva del control.', 700),
    recommended_formats: asArray(item?.recommended_formats || item?.recommended_format).map((value) => asString(value, 120)).filter(Boolean),
    minimum_fields: asArray(item?.minimum_fields).map((value) => asString(value, 160)).filter(Boolean),
    frequency: asString(item?.frequency || 'Segun criticidad del proceso; revision periodica.', 220),
    owner_role: asString(item?.owner_role || item?.suggested_owner || 'Responsable del proceso.', 220),
    how_to_present: asString(item?.how_to_present || 'Cargar evidencia vigente, indicando periodo, responsable, fuente y fecha de generacion.', 700),
    iso_use: asArray(item?.iso_use).map((value) => asString(value, 180)).filter(Boolean),
    evidence_strength: ['primary', 'secondary', 'supporting', 'complementary'].includes(String(item?.evidence_strength || '').toLowerCase())
      ? String(item.evidence_strength).toLowerCase()
      : 'primary',
    maturity_level: ['basic', 'intermediate', 'advanced'].includes(String(item?.maturity_level || '').toLowerCase())
      ? String(item.maturity_level).toLowerCase()
      : 'intermediate',
  };
}

function buildDeterministicItem(control, chunksBySource, aiOverlay = null) {
  const recommendations = deterministicRecommendationFor(control).map(normalizeEvidence);
  const firstRecommendation = recommendations[0] || normalizeEvidence({});
  const sources = controlSources(control, chunksBySource);
  const status = control.status;
  const gapStatement = status === 'covered'
    ? 'Existe evidencia asociada, pero debe mantenerse revision humana para confirmar vigencia y suficiencia ante auditoria.'
    : status === 'partially_covered'
      ? 'La cobertura documental es parcial; falta evidencia suficientemente trazable o revisada para sostener el control ante auditoria.'
      : status === 'needs_review'
        ? 'Hay evidencia candidata o de baja confianza que requiere revision humana antes de considerarse cobertura.'
        : 'No existe evidencia suficiente asociada para demostrar el control con trazabilidad completa.';

  const overlayAssessment = aiOverlay?.ai_assessment || {};
  const overlayActions = asArray(aiOverlay?.suggested_actions);
  const overlayEvidence = asArray(aiOverlay?.recommended_evidence).map(normalizeEvidence).filter((item) => item.name);

  return {
    control_id: control.tenant_control_id,
    catalog_control_id: control.catalog_control_id,
    control_code: control.clause || control.category || control.catalog_control_id,
    control_name: control.category || control.description || 'Control',
    process_id: control.process?.id || null,
    process_name: control.process?.name || control.operation?.name || null,
    operation_id: control.operation?.id || null,
    operation_name: control.operation?.name || null,
    deterministic_status: status,
    ai_assessment: {
      summary: asString(overlayAssessment.summary || `${control.description || 'Control evaluado'}: ${gapStatement}`, 900),
      gap_statement: asString(overlayAssessment.gap_statement || gapStatement, 900),
      audit_relevance: asString(
        overlayAssessment.audit_relevance ||
          firstRecommendation.iso_use?.join(', ') ||
          'Sirve como evidencia objetiva para demostrar control operacional, seguimiento y mejora ante auditoria.',
        900
      ),
      confidence: confidenceLabel(overlayAssessment.confidence || control.confidence, control.confidence || 'medium'),
      confidence_reason: asString(
        overlayAssessment.confidence_reason ||
          (sources[0]?.source_type === 'absence'
            ? 'La confianza se basa en ausencia explicita de evidencias activas asociadas en el diagnostico deterministico.'
            : 'La confianza se basa en evidencias o chunks asociados al control y requiere revision humana.'),
        900
      ),
    },
    recommended_evidence: overlayEvidence.length > 0 ? overlayEvidence.slice(0, 5) : recommendations.slice(0, 5),
    suggested_actions: overlayActions.length > 0
      ? overlayActions.slice(0, 5).map((action) => ({
        title: asString(action.title || 'Revisar y cargar evidencia del control', 180),
        description: asString(action.description || firstRecommendation.how_to_present, 900),
        priority: confidenceLabel(action.priority, priorityForStatus(status)),
        suggested_owner: asString(action.suggested_owner || firstRecommendation.owner_role, 220),
        suggested_due_days: Number.isFinite(Number(action.suggested_due_days)) ? Number(action.suggested_due_days) : (status === 'missing_evidence' ? 15 : 30),
        human_review_required: true,
      }))
      : [
        {
          title: asString(`Implementar o cargar ${firstRecommendation.name}`, 180),
          description: asString(firstRecommendation.how_to_present || firstRecommendation.purpose, 900),
          priority: priorityForStatus(status),
          suggested_owner: firstRecommendation.owner_role,
          suggested_due_days: status === 'missing_evidence' ? 15 : 30,
          human_review_required: true,
        },
      ],
    sources,
    human_review_required: true,
  };
}

function selectControls(diagnostic, payload = {}) {
  const requestedControlId = payload.control_id || payload.controlId || payload.tenant_control_id || null;
  let controls = asArray(diagnostic.controls);

  if (requestedControlId) {
    controls = controls.filter((control) => (
      String(control.tenant_control_id) === String(requestedControlId) ||
      String(control.catalog_control_id) === String(requestedControlId)
    ));
    if (controls.length === 0) {
      throw publicError(404, 'CONTROL_NOT_FOUND', 'Control no encontrado en el diagnostico solicitado.');
    }
    return controls;
  }

  const priority = { missing_evidence: 1, needs_review: 2, partially_covered: 3, covered: 4, not_applicable: 5 };
  return controls
    .filter((control) => control.status !== 'not_applicable')
    .sort((a, b) => (priority[a.status] || 9) - (priority[b.status] || 9))
    .slice(0, Math.max(1, Math.min(Number(payload.max_items || DEFAULT_MAX_ITEMS), 30)));
}

function buildAiPrompt() {
  return [
    'Eres un auditor ISO senior dentro de TCDX Compliance.',
    'Trabajas solo con el contexto entregado por el backend.',
    'No inventes documentos existentes, fuentes, chunks ni evidencias.',
    'Si no hay evidencia, dilo explicitamente.',
    'No certificas, no apruebas cumplimiento y no cierras brechas.',
    'No creas acciones formales; toda accion requiere revision humana.',
    'Debes producir recomendaciones accionables con formato, campos minimos, responsable, frecuencia y valor ISO.',
    'No incluyas trazas internas, razonamiento privado, tokens, secretos ni datos fuera del tenant.',
    'Devuelve JSON valido con esta forma exacta: {"items":[{"control_id":"","ai_assessment":{"summary":"","gap_statement":"","audit_relevance":"","confidence":"high|medium|low","confidence_reason":""},"recommended_evidence":[{"name":"","purpose":"","recommended_formats":[],"minimum_fields":[],"frequency":"","owner_role":"","how_to_present":"","iso_use":[],"evidence_strength":"primary|secondary|supporting","maturity_level":"basic|intermediate|advanced"}],"suggested_actions":[{"title":"","description":"","priority":"high|medium|low","suggested_owner":"","suggested_due_days":15,"human_review_required":true}],"sources":[{"source_type":"document_index|evidence|chunk|absence","source_id":null,"document_title":"","chunk_id":null,"snippet":"","reason":""}],"human_review_required":true}],"warnings":[]}.',
  ].join('\n');
}

function safeControlForAi(control, chunksBySource) {
  return {
    control_id: control.tenant_control_id,
    catalog_control_id: control.catalog_control_id,
    control_code: control.clause || control.category || null,
    control_name: control.category || null,
    control_description: control.description || null,
    standard_code: control.standard_code,
    deterministic_status: control.status,
    confidence: control.confidence,
    process: {
      id: control.process?.id || null,
      name: control.process?.name || null,
      area: control.process?.area || null,
      criticality: control.process?.criticality || null,
    },
    operation: {
      id: control.operation?.id || null,
      name: control.operation?.name || null,
      type: control.operation?.operation_type || null,
    },
    evidence: {
      active_count: control.evidence?.active_count || 0,
      candidate_count: control.evidence?.candidate_count || 0,
      existing: asArray(control.evidence?.existing).slice(0, 5).map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        name: item.name,
        status: item.status || null,
        evidence_usage: item.evidence_usage || null,
      })),
      candidates: asArray(control.evidence?.candidates).slice(0, 5).map((item) => ({
        source_type: item.source_type,
        source_id: item.source_id,
        name: item.name,
        confidence: item.confidence || null,
        reason: item.reason || null,
        snippet: shortSnippet(item.snippet || ''),
      })),
      deterministic_recommendations: deterministicRecommendationFor(control).map(normalizeEvidence).slice(0, 3),
    },
    gaps: {
      open_count: control.gaps?.open_count || 0,
      suggested_count: control.gaps?.suggested_count || 0,
    },
    actions: {
      open_count: control.actions?.open_count || 0,
      suggested_count: control.actions?.suggested_count || 0,
    },
    risks: {
      associated_count: control.risks?.associated_count || 0,
    },
    sources: controlSources(control, chunksBySource),
  };
}

function buildAiPayload({ diagnostic, controls, chunksBySource, tenantContext, payload }) {
  const requestId = `diagnostic-ai-${crypto.randomUUID()}`;
  return {
    task_type: 'diagnostic_contextual_enrichment',
    tenant_id: diagnostic.tenant_id,
    module_origin: 'diagnostics',
    locale: 'es',
    question: buildAiPrompt(),
    context: {
      scope: {
        mode: payload.mode || 'diagnostic_enrichment',
        standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
        standard_code: diagnostic.standard?.standard_code || null,
        process_id: payload.process_id || payload.processId || null,
        operation_id: payload.operation_id || payload.operationId || null,
        control_id: payload.control_id || payload.controlId || payload.tenant_control_id || null,
      },
      tenant: {
        tenant_id: diagnostic.tenant_id,
      },
      tenant_context: tenantContext,
      deterministic_summary: diagnostic.summary,
      controls: controls.map((control) => safeControlForAi(control, chunksBySource)),
      source_trace: [
        {
          source: 'internal_db',
          reference: 'diagnostic.service.buildDiagnostic',
          used_for: 'estado deterministico de controles, evidencias, brechas y acciones',
        },
        {
          source: 'internal_db',
          reference: 'tenant_evidence_chunks',
          used_for: 'fragmentos semanticos filtrados por tenant y documentos no excluidos',
        },
      ],
    },
    options: {
      local_compact: true,
      use_rag: true,
      use_drive: false,
      use_web: false,
      fast_mode: true,
      use_llm_in_fast_mode: true,
      depth: 'standard',
      return_structured_result: true,
      model_mode: 'balanced',
    },
    request_metadata: {
      request_id: requestId,
      feature: 'diagnostic_contextual_enrichment',
      model_mode: 'balanced',
    },
  };
}

function extractAiItems(aiResult) {
  const structured = safeJson(aiResult?.structured_result, {});
  const candidates = [
    aiResult?.items,
    aiResult?.data?.items,
    structured.items,
    structured.diagnostic_enrichment_items,
    structured.contextual_recommendations,
    structured.recommendations,
  ];
  const items = candidates.find(Array.isArray) || [];
  return items.filter((item) => item && typeof item === 'object');
}

function overlayByControlId(aiItems) {
  const map = new Map();
  for (const item of aiItems) {
    const controlId = item.control_id || item.tenant_control_id || item.catalog_control_id;
    if (!controlId) continue;
    map.set(String(controlId), item);
  }
  return map;
}

function aiWarnings(aiResult, aiItems) {
  const warnings = [];
  const engine = safeJson(aiResult?.engine || aiResult?.trace, {});
  if (!aiResult || aiResult.ok === false || engine.fallback_used === true || engine.ai_enrichment_failed === true) {
    warnings.push({
      code: 'AI_ENRICHMENT_UNAVAILABLE',
      message: 'El motor IA no entrego enriquecimiento valido; se usa fallback deterministico.',
    });
  } else if (aiItems.length === 0) {
    warnings.push({
      code: 'AI_RESPONSE_SCHEMA_FALLBACK',
      message: 'La IA respondio sin items validos del contrato; se normalizo con recomendaciones deterministicas.',
    });
  }
  return warnings;
}

async function generateContextualRecommendations({ user, payload = {} } = {}) {
  const mode = payload.mode || 'diagnostic_enrichment';
  if (mode !== 'diagnostic_enrichment') {
    throw publicError(400, 'INVALID_DIAGNOSTIC_AI_MODE', 'mode invalido para diagnostico IA contextual.');
  }

  const diagnostic = await diagnosticService.buildDiagnostic({
    user,
    tenantId: payload.tenant_id || payload.tenantId || null,
    standardId: payload.standard_id || payload.standardId || payload.standard_code || payload.standardCode,
    standardCode: payload.standard_code || payload.standardCode,
    filters: {
      process_id: payload.process_id || payload.processId || null,
      operation_id: payload.operation_id || payload.operationId || null,
      area: payload.area || null,
      responsible_user_id: payload.responsible_user_id || payload.responsibleUserId || null,
      evidence_status: payload.evidence_status || payload.evidenceStatus || null,
      gap_status: payload.gap_status || payload.gapStatus || null,
      action_status: payload.action_status || payload.actionStatus || null,
      criticality: payload.criticality || null,
    },
  });

  const selectedControls = selectControls(diagnostic, payload);
  if (selectedControls.length === 0) {
    return {
      standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
      standard_code: diagnostic.standard?.standard_code || null,
      process_id: payload.process_id || payload.processId || null,
      operation_id: payload.operation_id || payload.operationId || null,
      generated_at: new Date().toISOString(),
      mode,
      items: [],
      warnings: [
        {
          code: 'NO_DIAGNOSTIC_CONTROLS',
          message: 'No se encontraron controles evaluables para el filtro solicitado.',
        },
      ],
      metadata: {
        deterministic_source: 'diagnostic.service',
        ai_engine_used: false,
        ai_items_received: 0,
        human_review_required: true,
        persistence: 'not_persisted',
        ai_trace_exposed: false,
      },
    };
  }

  const maxChunks = Math.max(1, Math.min(Number(payload.max_chunks || DEFAULT_MAX_CHUNKS), 20));
  const chunksBySource = await loadEvidenceChunks({
    tenantId: diagnostic.tenant_id,
    controls: selectedControls,
    includeChunks: payload.include_chunks !== false,
    maxChunks,
  });
  const tenantContext = await loadTenantContext(diagnostic.tenant_id);
  const aiPayload = buildAiPayload({
    diagnostic,
    controls: selectedControls,
    chunksBySource,
    tenantContext,
    payload,
  });

  const aiResult = await aiEngineClient.analyzeWithSeniorAuditor(aiPayload);
  const aiItems = extractAiItems(aiResult);
  const overlays = overlayByControlId(aiItems);
  const items = selectedControls.map((control) => {
    const overlay =
      overlays.get(String(control.tenant_control_id)) ||
      overlays.get(String(control.catalog_control_id)) ||
      null;
    return buildDeterministicItem(control, chunksBySource, overlay);
  });
  const warnings = aiWarnings(aiResult, aiItems);

  if (tenantContext.context_quality === 'generic_adaptable') {
    warnings.push({
      code: 'TENANT_CONTEXT_LIMITED',
      message: 'No se encontro contexto organizacional suficiente; la recomendacion es generica-adaptable.',
    });
  }

  return {
    standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
    standard_code: diagnostic.standard?.standard_code || null,
    process_id: payload.process_id || payload.processId || null,
    operation_id: payload.operation_id || payload.operationId || null,
    generated_at: new Date().toISOString(),
    mode,
    items,
    warnings,
    metadata: {
      deterministic_source: 'diagnostic.service',
      ai_engine_used: warnings.every((warning) => warning.code !== 'AI_ENRICHMENT_UNAVAILABLE'),
      ai_items_received: aiItems.length,
      human_review_required: true,
      persistence: 'not_persisted',
      ai_trace_exposed: false,
    },
  };
}

module.exports = {
  generateContextualRecommendations,
};
