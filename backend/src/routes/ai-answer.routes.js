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
const { localizeAiAnswerPayload } = require('../utils/aiAnswerLocale');
const { sendError } = require('../utils/errorResponse');
const { ERROR_CODES } = require('../utils/errorCodes');

const { tenantInternalSearch } = require('./ai-tenant-search.routes');
const { benchmarkSearch } = require('./ai-benchmark.routes');


function polishEnglishExecutiveSummary(answer, locale) {
  if (String(locale || '').toLowerCase().split('-')[0] !== 'en') {
    return answer;
  }

  if (!answer || typeof answer !== 'object') {
    return answer;
  }

  if (typeof answer.executive_summary !== 'string') {
    return answer;
  }

  answer.executive_summary = answer.executive_summary
    .replace(
      /Criterio auditor: la respuesta usa fuente ([^.]+?) con confianza (alta|media|baja|high|medium|low)\./g,
      (_, source, confidence) => {
        const confidenceMap = {
          alta: 'high',
          media: 'medium',
          baja: 'low',
          high: 'high',
          medium: 'medium',
          low: 'low',
        };

        return `Auditor criterion: the answer uses source ${source} with ${confidenceMap[confidence] || confidence} confidence.`;
      }
    )
    .replace(
      /No se observan brechas cr[ií]ticas con la informaci[oó]n disponible\./g,
      'No critical gaps are observed with the available information.'
    );

  return answer;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isPlatformRole(role) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'global_admin',
    'admin_global',
    'owner',
  ].includes(normalizeRole(role));
}

function getUserId(user) {
  return user?.id || user?.user_id || user?.userId || null;
}

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || null;
}

function resolveTenantId(req) {
  return (
    req.body?.tenant_id ||
    req.query?.tenant_id ||
    getUserTenantId(req.user) ||
    null
  );
}

function cleanQuestion(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 2000);
}

function detectQuestionIntent(question) {
  const q = String(question || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(evidencia|evidencias|registro|registros|documento|documentos|respaldo)\b/.test(q)) {
    return 'evidence_recommendation';
  }

  if (/\b(no conformidad|no conformidades|nc|incumplimiento)\b/.test(q)) {
    return 'nonconformity_guidance';
  }

  if (/\b(hallazgo|hallazgos|observacion|brecha)\b/.test(q)) {
    return 'finding_analysis';
  }

  if (/\b(riesgo|riesgos|amenaza|vulnerabilidad|impacto|probabilidad)\b/.test(q)) {
    return 'risk_guidance';
  }

  if (/\b(control|controles|clausula|requisito|cumplimiento)\b/.test(q)) {
    return 'control_guidance';
  }

  return 'general_compliance_guidance';
}


function questionNeedsTcdxKnowledge(question) {
  const q = String(question || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    /\b(que exige|qué exige|exige|requisito|requisitos|debe cumplir|debe tener|obligatorio|obligatoria|criterio normativo|segun la norma|según la norma|norma exige|iso exige)\b/.test(q) ||
    /\b(continuidad operacional|continuidad del negocio|recuperacion|recuperación|resiliencia|incidentes|control normativo)\b/.test(q)
  );
}


function confidenceToScore(confidence) {
  if (confidence === 'alta') return 85;
  if (confidence === 'media') return 60;
  return 35;
}

function buildSuggestedEvidence(intent, topHits) {
  const evidence = [];

  if (intent === 'evidence_recommendation' || intent === 'control_guidance') {
    evidence.push(
      'Procedimiento o política vigente relacionada con el control.',
      'Registro de ejecución o revisión del control.',
      'Evidencia de aprobación, responsable y fecha.',
      'Captura, reporte o documento que demuestre operación real.',
      'Historial de seguimiento, revisión o mejora cuando aplique.'
    );
  }

  if (intent === 'nonconformity_guidance' || intent === 'finding_analysis') {
    evidence.push(
      'Descripción del hallazgo o no conformidad.',
      'Evidencia objetiva asociada.',
      'Análisis de causa.',
      'Plan de acción correctiva.',
      'Registro de cierre y verificación de eficacia.'
    );
  }

  if (intent === 'risk_guidance') {
    evidence.push(
      'Matriz de riesgos actualizada.',
      'Criterio de impacto y probabilidad.',
      'Tratamiento de riesgo definido.',
      'Responsable y fecha objetivo.',
      'Evidencia de seguimiento del riesgo.'
    );
  }

  for (const hit of topHits.slice(0, 3)) {
    if (hit?.title) {
      evidence.push(`Evidencia relacionada con: ${hit.title}`);
    }
  }

  return Array.from(new Set(evidence)).slice(0, 10);
}

function buildNextSteps(intent, confidence, topHits) {
  const steps = [];

  if (topHits.length > 0) {
    steps.push('Revisar los resultados internos encontrados y confirmar si corresponden al caso consultado.');
  }

  if (intent === 'evidence_recommendation') {
    steps.push('Cargar evidencia documental contra el control correspondiente.');
    steps.push('Asignar responsable y fecha de revisión.');
  } else if (intent === 'nonconformity_guidance') {
    steps.push('Vincular la no conformidad al control afectado.');
    steps.push('Registrar causa raíz, acción correctiva y verificación de eficacia.');
  } else if (intent === 'finding_analysis') {
    steps.push('Clasificar el hallazgo por severidad e impacto.');
    steps.push('Definir si corresponde crear no conformidad o plan de acción.');
  } else if (intent === 'risk_guidance') {
    steps.push('Actualizar evaluación de riesgo y tratamiento asociado.');
    steps.push('Registrar seguimiento hasta cierre o aceptación formal.');
  } else {
    steps.push('Revisar el control, evidencia y estado operacional relacionado.');
  }

  if (confidence === 'baja') {
    steps.push('Solicitar revisión humana porque la información interna encontrada es limitada.');
  }

  return steps;
}

function buildAnswerFromTenantSearch(question, tenantSearch) {
  const hits = Array.isArray(tenantSearch?.data) ? tenantSearch.data : [];
  const topHits = hits.slice(0, 5);
  const confidence = tenantSearch?.confidence_hint || 'baja';
  const intent = detectQuestionIntent(question);

  const sourceLevel =
    confidence === 'alta' || confidence === 'media'
      ? 'tenant_internal'
      : 'best_effort';

  const sourceLabel =
    sourceLevel === 'tenant_internal'
      ? 'Información interna de la empresa'
      : 'Mejor esfuerzo controlado con información interna limitada';

  const hitLines = topHits.map((hit, index) => {
    const standard = hit.standard_code ? ` (${hit.standard_code})` : '';
    const status = hit.status ? ` Estado: ${hit.status}.` : '';
    return `${index + 1}. ${hit.title || hit.entity_type}${standard}.${status}`;
  });

  const executiveSummary =
    hits.length > 0
      ? `Se encontraron ${hits.length} coincidencias internas relacionadas con la consulta. La respuesta se basa primero en información propia de la empresa.`
      : 'No se encontraron coincidencias internas fuertes, por lo que se entrega una respuesta de mejor esfuerzo con próximos pasos recomendados.';

  const analysis =
    hitLines.length > 0
      ? `Resultados internos más relevantes:\n${hitLines.join('\n')}`
      : 'No hay suficientes registros internos relacionados directamente con la consulta.';

  let recommendation = 'Revisar la información interna encontrada, validar su vigencia y completar evidencia o acciones pendientes.';

  if (intent === 'evidence_recommendation') {
    recommendation = 'Preparar evidencia objetiva que demuestre diseño, implementación, operación y revisión del control consultado.';
  }

  if (intent === 'nonconformity_guidance') {
    recommendation = 'Gestionar la no conformidad con causa raíz, acción correctiva, responsable, fecha objetivo y verificación de eficacia.';
  }

  if (intent === 'finding_analysis') {
    recommendation = 'Analizar el hallazgo, clasificar severidad, vincularlo al control afectado y decidir si corresponde plan de acción o no conformidad.';
  }

  if (intent === 'risk_guidance') {
    recommendation = 'Actualizar la evaluación de riesgos, definir tratamiento y dejar trazabilidad del seguimiento.';
  }

  return {
    executive_summary: executiveSummary,
    analysis,
    recommendation,
    suggested_evidence: buildSuggestedEvidence(intent, topHits),
    next_steps: buildNextSteps(intent, confidence, topHits),
    risk_if_not_addressed:
      'Si no se gestiona este punto, puede mantenerse una brecha de cumplimiento, falta de trazabilidad y exposición ante auditorías internas o externas.',
    confidence,
    confidence_score: confidenceToScore(confidence),
    source_level: sourceLevel,
    source_label: sourceLabel,
    used_external_lookup: false,
    used_anonymized_benchmark: false,
    used_tenant_internal: hits.length > 0,
    must_review_by_human: confidence === 'baja',
    top_internal_results: topHits,
  };
}


function normalizeSearchForKnowledge(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s./:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStandardForKnowledge(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/ISO\/IEC/g, 'ISO')
    .replace(/[^A-Z0-9]/g, '');
}

function detectStandardsForKnowledge(question) {
  const compact = normalizeStandardForKnowledge(question);

  const standards = [
    'ISO27001',
    'ISO9001',
    'ISO14001',
    'ISO14224',
    'ISO27017',
    'ISO27018',
    'ISO27701',
    'ISO20000',
    'ISO22301',
    'ISO31000',
    'ISO37301',
    'ISO50001',
    'ISO55002',
    'ISO17025',
    'ISO17020',
  ];

  return standards.filter((standard) => compact.includes(standard));
}

function buildKnowledgeSearchTerms(question) {
  const normalized = normalizeSearchForKnowledge(question);

  const terms = new Set();

  if (normalized) terms.add(normalized);

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !['para', 'como', 'cual', 'cuales', 'necesito', 'debo', 'iso'].includes(token));

  tokens.forEach((token) => terms.add(token));

  if (normalized.includes('evidencia')) {
    ['registro', 'documento', 'respaldo', 'trazabilidad'].forEach((t) => terms.add(t));
  }

  if (normalized.includes('no conformidad') || normalized.includes('conformidad')) {
    ['incumplimiento', 'accion correctiva', 'causa raiz', 'eficacia'].forEach((t) => terms.add(t));
  }

  if (normalized.includes('hallazgo')) {
    ['observacion', 'brecha', 'auditoria'].forEach((t) => terms.add(t));
  }

  if (normalized.includes('riesgo')) {
    ['amenaza', 'vulnerabilidad', 'impacto', 'probabilidad', 'tratamiento'].forEach((t) => terms.add(t));
  }

  return Array.from(terms).slice(0, 14);
}


function detectTcdxKnowledgeTopic(question) {
  const q = normalizeSearchForKnowledge(question);

  return {
    continuity:
      /\b(continuidad|continuidad operacional|continuidad del negocio|recuperacion|recuperación|disrupcion|disrupción|resiliencia|rto|rpo|drp|bcp)\b/.test(q),

    incident:
      /\b(incidente|incidentes|respuesta a incidentes|gestion de incidentes|gestión de incidentes)\b/.test(q),

    corrective:
      /\b(no conformidad|no conformidades|accion correctiva|acciones correctivas|capa|causa raiz|causa raíz|mejora)\b/.test(q),

    access:
      /\b(acceso|accesos|credencial|credenciales|privilegio|privilegios|rbac|autenticacion|autenticación)\b/.test(q),
  };
}

function applyTcdxKnowledgeTopicBoost(row, question) {
  const topic = detectTcdxKnowledgeTopic(question);

  const haystack = normalizeSearchForKnowledge([
    row.standard_code,
    row.control_ref,
    row.title,
    row.summary,
    row.requirement,
    JSON.stringify(row.suggested_evidence || []),
    JSON.stringify(row.typical_findings || []),
    JSON.stringify(row.corrective_actions || []),
    JSON.stringify(row.tags || []),
  ].filter(Boolean).join(' '));

  let topicBoost = 0;
  let topicPenalty = 0;

  if (topic.continuity) {
    if (/\b(continuidad|recuperacion|recuperación|resiliencia|disrupcion|disrupción|rto|rpo|drp|bcp|readiness|disruption)\b/.test(haystack)) {
      topicBoost += 24;
    }

    if (/\b(incidente|incidentes|gestion de incidentes|gestión de incidentes)\b/.test(haystack)) {
      topicBoost += 8;
    }

    if (String(row.control_ref || '').toUpperCase().startsWith('A.5')) {
      topicBoost += 6;
    }

    // Si la pregunta NO es de NC/CAPA, bajar registros que se van por mejora/no conformidad.
    if (!topic.corrective && /\b(no conformidad|capa|causa raiz|causa raíz|accion correctiva|acciones correctivas)\b/.test(haystack)) {
      topicPenalty += 12;
    }
  }

  if (topic.incident) {
    if (/\b(incidente|incidentes|respuesta a incidentes|gestion de incidentes|gestión de incidentes)\b/.test(haystack)) {
      topicBoost += 10;
    }
  }

  if (topic.access) {
    if (/\b(acceso|accesos|credencial|credenciales|privilegio|privilegios|autenticacion|autenticación|rbac)\b/.test(haystack)) {
      topicBoost += 14;
    }
  }

  if (topic.corrective) {
    if (/\b(no conformidad|accion correctiva|acciones correctivas|capa|causa raiz|causa raíz|mejora)\b/.test(haystack)) {
      topicBoost += 14;
    }
  }

  return {
    ...row,
    base_rank_score: Number(row.rank_score || 0),
    rank_score: Math.max(0, Number(row.rank_score || 0) + topicBoost - topicPenalty),
    topic_boost: topicBoost,
    topic_penalty: topicPenalty,
  };
}


function filterEvidenceForQuestion(question, evidenceItems) {
  const topic = detectTcdxKnowledgeTopic(question);
  const items = Array.isArray(evidenceItems) ? evidenceItems : [];

  if (!topic.continuity) {
    return items;
  }

  const blocked = [
    'cctv',
    'visitor logs',
    'control de acceso',
    'escritorio limpio',
    'registro de no conformidades',
    'análisis de causa raíz',
    'analisis de causa raiz',
    'planes capa',
    'verificación de eficacia',
    'verificacion de eficacia',
    'registro de mejoras implementadas'
  ];

  return items.filter((item) => {
    const value = String(item || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return !blocked.some((blockedTerm) => value.includes(blockedTerm));
  });
}


function buildTopicSuggestedEvidence(question) {
  const topic = detectTcdxKnowledgeTopic(question);

  if (topic.continuity) {
    return [
      'Plan de continuidad operacional o continuidad del negocio.',
      'Plan de recuperación ante desastres o recuperación tecnológica.',
      'Procedimiento de respuesta ante incidentes.',
      'Registro de pruebas de continuidad, simulacros o ejercicios.',
      'Definición de RTO/RPO cuando aplique.',
      'Registro de lecciones aprendidas posteriores a incidentes o pruebas.',
      'Evidencia de responsables, fechas de revisión y aprobación.',
    ];
  }

  return [];
}

function buildTopicRecommendation(question) {
  const topic = detectTcdxKnowledgeTopic(question);

  if (topic.continuity) {
    return [
      'Definir escenarios de interrupción relevantes para la organización.',
      'Mantener procedimientos documentados de continuidad y recuperación.',
      'Establecer responsables, tiempos objetivo de recuperación y criterios de escalamiento.',
      'Probar periódicamente los planes de continuidad y recuperación.',
      'Registrar resultados, brechas detectadas, acciones de mejora y verificación posterior.',
    ].join('\n');
  }

  return '';
}


async function searchTcdxKnowledge({ question, limit = 8 }) {
  const cleanQuestion = cleanQuestionForSql(question);
  const detectedStandards = detectStandardsForKnowledge(cleanQuestion);
  const terms = buildKnowledgeSearchTerms(cleanQuestion);

  const result = await pool.query(
    `
    WITH query_terms AS (
      SELECT unnest($4::text[]) AS term
    ),
    base AS (
      SELECT
        r.id,
        r.record_id,
        r.norma,
        r.norma_key,
        r.clausula_o_control,
        r.titulo,
        r.descripcion_resumen,
        r.que_exige,
        r.ejemplos_evidencia_json,
        r.hallazgos_tipicos_json,
        r.acciones_correctivas_sugeridas_json,
        r.palabras_clave_tags_json,
        r.embedding_text,
        r.search_text,
        unaccent(lower(
          coalesce(r.norma, '') || ' ' ||
          coalesce(r.norma_key, '') || ' ' ||
          coalesce(r.clausula_o_control, '') || ' ' ||
          coalesce(r.titulo, '') || ' ' ||
          coalesce(r.descripcion_resumen, '') || ' ' ||
          coalesce(r.que_exige, '') || ' ' ||
          coalesce(r.search_text, '') || ' ' ||
          coalesce(r.embedding_text, '')
        )) AS search_doc
      FROM ai_knowledge_records r
      WHERE r.is_active = true
        AND r.is_draft = false
    )
    SELECT
      id,
      record_id,
      norma,
      norma_key,
      clausula_o_control,
      titulo,
      descripcion_resumen,
      que_exige,
      ejemplos_evidencia_json,
      hallazgos_tipicos_json,
      acciones_correctivas_sugeridas_json,
      palabras_clave_tags_json,
      (
        CASE
          WHEN cardinality($3::text[]) > 0
           AND regexp_replace(replace(upper(coalesce(norma_key, '')), 'ISO/IEC', 'ISO'), '[^A-Z0-9]', '', 'g') = ANY($3::text[])
          THEN 12 ELSE 0
        END
        +
        CASE
          WHEN search_doc ILIKE '%' || unaccent(lower($1)) || '%' THEN 10
          ELSE 0
        END
        +
        COALESCE(similarity(search_doc, unaccent(lower($1))), 0) * 10
        +
        (
          SELECT COUNT(*)::numeric * 2
          FROM query_terms qt
          WHERE search_doc ILIKE '%' || unaccent(lower(qt.term)) || '%'
        )
      ) AS rank_score
    FROM base
    WHERE
      COALESCE($1, '') = ''
      OR search_doc ILIKE '%' || unaccent(lower($1)) || '%'
      OR similarity(search_doc, unaccent(lower($1))) > 0.04
      OR EXISTS (
        SELECT 1
        FROM query_terms qt
        WHERE search_doc ILIKE '%' || unaccent(lower(qt.term)) || '%'
      )
    ORDER BY rank_score DESC, norma_key ASC, clausula_o_control ASC NULLS LAST
    LIMIT $2
    `,
    [
      cleanQuestion,
      Math.max(1, Math.min(Number(limit || 8), 30)),
      detectedStandards.map(normalizeStandardForKnowledge),
      terms.length ? terms : [cleanQuestion],
    ]
  );

  let rows = result.rows.map((row) => ({
    source_table: 'ai_knowledge_records',
    entity_type: 'tcdx_knowledge',
    entity_id: row.id,
    record_id: row.record_id,
    standard_code: row.norma_key,
    control_ref: row.clausula_o_control,
    title: row.titulo || row.clausula_o_control || row.norma,
    summary: row.descripcion_resumen || row.que_exige || '',
    requirement: row.que_exige || '',
    suggested_evidence: row.ejemplos_evidencia_json || [],
    typical_findings: row.hallazgos_tipicos_json || [],
    corrective_actions: row.acciones_correctivas_sugeridas_json || [],
    tags: row.palabras_clave_tags_json || [],
    rank_score: Number(row.rank_score || 0),
  }));

  rows = rows
    .map((row) => applyTcdxKnowledgeTopicBoost(row, cleanQuestion))
    .sort((a, b) => Number(b.rank_score || 0) - Number(a.rank_score || 0))
    .slice(0, Math.max(1, Math.min(Number(limit || 8), 30)));

  const topRank = Number(rows[0]?.rank_score || 0);
  const strongHits = rows.filter((row) => Number(row.rank_score || 0) >= 14).length;
  const mediumHits = rows.filter((row) => Number(row.rank_score || 0) >= 7).length;

  let confidence_hint = 'baja';
  if (topRank >= 20 && strongHits >= 2) confidence_hint = 'alta';
  else if (topRank >= 10 || mediumHits >= 2 || strongHits >= 1) confidence_hint = 'media';

  return {
    ok: true,
    query: cleanQuestion,
    detected_standards: detectedStandards,
    total: rows.length,
    strong_hits: strongHits,
    medium_hits: mediumHits,
    top_rank: topRank,
    confidence_hint,
    data: rows,
  };
}

function cleanQuestionForSql(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 1000);
}

function buildAnswerFromTcdxKnowledge(question, tenantSearch, knowledgeSearch) {
  const rows = Array.isArray(knowledgeSearch?.data) ? knowledgeSearch.data : [];
  const topRows = rows.slice(0, 5);
  const intent = detectQuestionIntent(question);

  const confidence =
    knowledgeSearch?.confidence_hint === 'alta'
      ? 'alta'
      : knowledgeSearch?.confidence_hint === 'media'
        ? 'media'
        : 'baja';

  const lines = topRows.map((row, index) => {
    const standard = row.standard_code ? ` (${row.standard_code})` : '';
    const control = row.control_ref ? ` - ${row.control_ref}` : '';
    return `${index + 1}. ${row.title || 'Referencia TCDX'}${standard}${control}.`;
  });

  const suggestedEvidence = [];

  for (const row of topRows) {
    if (Array.isArray(row.suggested_evidence)) {
      for (const item of row.suggested_evidence) {
        if (typeof item === 'string') suggestedEvidence.push(item);
        else if (item && typeof item === 'object') suggestedEvidence.push(JSON.stringify(item));
      }
    }
  }

  const correctiveActions = [];

  for (const row of topRows) {
    if (Array.isArray(row.corrective_actions)) {
      for (const item of row.corrective_actions) {
        if (typeof item === 'string') correctiveActions.push(item);
        else if (item && typeof item === 'object') correctiveActions.push(JSON.stringify(item));
      }
    }
  }

  const fallbackEvidence = buildSuggestedEvidence(intent, topRows);
  const topicEvidence = buildTopicSuggestedEvidence(question);
  const topicRecommendation = buildTopicRecommendation(question);

  return {
    executive_summary:
      `La información interna de la empresa no fue suficiente para responder con seguridad completa. Se complementó la respuesta con la Base de Conocimiento TCDX.`,
    analysis:
      lines.length > 0
        ? `Referencias TCDX más relevantes:\n${lines.join('\n')}`
        : 'No se encontraron referencias TCDX fuertes, por lo que se entrega una recomendación de mejor esfuerzo.',
    recommendation:
      topicRecommendation ||
      (
        correctiveActions.length > 0
          ? correctiveActions.slice(0, 5).join('\n')
          : 'Aplicar el criterio de la norma, documentar evidencia objetiva y dejar trazabilidad de responsable, fecha, revisión y eficacia.'
      ),
    suggested_evidence:
      filterEvidenceForQuestion(
        question,
        Array.from(new Set([...topicEvidence, ...suggestedEvidence, ...fallbackEvidence]))
      ).slice(0, 12),
    next_steps:
      detectTcdxKnowledgeTopic(question).continuity
        ? [
            'Confirmar escenarios críticos de interrupción para la empresa.',
            'Validar si existe plan de continuidad operacional y plan de recuperación.',
            'Definir o revisar RTO/RPO cuando aplique.',
            'Programar prueba o simulacro de continuidad y recuperación.',
            'Registrar brechas, responsables, fechas y acciones de mejora.'
          ]
        : buildNextSteps(intent, confidence, topRows),
    risk_if_not_addressed:
      'Si no se gestiona este punto, puede mantenerse una brecha de cumplimiento, evidencia insuficiente y mayor exposición ante auditoría.',
    confidence,
    confidence_score: confidenceToScore(confidence),
    source_level: 'tcdx_knowledge',
    source_label: 'Base de conocimiento TCDX',
    used_external_lookup: false,
    used_anonymized_benchmark: false,
    used_tenant_internal: Number(tenantSearch?.total || 0) > 0,
    used_tcdx_knowledge: true,
    must_review_by_human: confidence === 'baja',
    top_internal_results: Array.isArray(tenantSearch?.data)
      ? tenantSearch.data.slice(0, 5)
      : [],
    top_knowledge_results: topRows,
  };
}



function buildAnswerFromBenchmark(question, tenantSearch, knowledgeSearch, benchmarkResult) {
  const rows = Array.isArray(benchmarkResult?.data) ? benchmarkResult.data : [];
  const topRows = rows.slice(0, 5);
  const intent = detectQuestionIntent(question);

  const confidence =
    benchmarkResult?.confidence_hint === 'alta'
      ? 'alta'
      : benchmarkResult?.confidence_hint === 'media'
        ? 'media'
        : 'baja';

  const lines = topRows.map((row, index) => {
    const standard = row.standard_code ? ` (${row.standard_code})` : '';
    const control = row.control_ref ? ` - ${row.control_ref}` : '';
    const sample = row.tenant_sample_size
      ? ` Muestra anonimizada: ${row.tenant_sample_size} empresa(s).`
      : '';

    return `${index + 1}. ${row.pattern_label || 'Patrón anonimizado'}${standard}${control}.${sample}`;
  });

  const evidence = buildSuggestedEvidence(intent, topRows);

  const benchmarkEvidence = topRows.map((row) => {
    if (row.benchmark_type === 'control_pattern') {
      return `Evidencia asociada al patrón: ${row.pattern_label}`;
    }

    if (row.benchmark_type === 'evidence_pattern') {
      return `Referencia de evidencia anonimizada: ${row.pattern_label}`;
    }

    return null;
  }).filter(Boolean);

  let recommendation =
    'Usar estos patrones anonimizados como referencia de buenas prácticas, validar aplicabilidad al contexto de la empresa y documentar evidencia propia antes de cerrar cumplimiento.';

  if (intent === 'nonconformity_guidance') {
    recommendation =
      'Gestionar la no conformidad con causa raíz, acción correctiva, responsable, fecha objetivo y verificación de eficacia. Usar los patrones anonimizados solo como referencia, sin asumir cumplimiento automático.';
  }

  if (intent === 'evidence_recommendation') {
    recommendation =
      'Preparar evidencia propia del tenant tomando como referencia los patrones anonimizados encontrados. La evidencia debe demostrar diseño, implementación, operación y revisión del control.';
  }

  if (intent === 'risk_guidance') {
    recommendation =
      'Comparar el caso interno con patrones agregados de riesgo, definir tratamiento propio y registrar responsables, fechas y seguimiento.';
  }

  return {
    executive_summary:
      'La información interna y/o la Base TCDX no fueron suficientes para responder con total precisión. Se complementó con buenas prácticas anonimizadas de implementaciones similares.',
    analysis:
      lines.length > 0
        ? `Patrones anonimizados más relevantes:\n${lines.join('\n')}`
        : 'No se encontraron patrones anonimizados suficientemente relevantes.',
    recommendation,
    suggested_evidence:
      Array.from(new Set([...evidence, ...benchmarkEvidence])).slice(0, 12),
    next_steps: [
      'Validar si los patrones anonimizados aplican al contexto real de la empresa.',
      'Completar evidencia propia del tenant; no usar benchmark como evidencia directa.',
      'Vincular la recomendación al control, hallazgo, riesgo o no conformidad correspondiente.',
      'Registrar responsable, fecha objetivo y criterio de cierre.',
    ],
    risk_if_not_addressed:
      'Si no se gestiona este punto, puede mantenerse una brecha de cumplimiento sin evidencia suficiente y con mayor exposición ante auditoría.',
    confidence,
    confidence_score: confidenceToScore(confidence),
    source_level: 'anonymized_benchmark',
    source_label: 'Buenas prácticas anonimizadas',
    used_external_lookup: false,
    used_anonymized_benchmark: true,
    used_tenant_internal: Number(tenantSearch?.total || 0) > 0,
    used_tcdx_knowledge: Number(knowledgeSearch?.total || 0) > 0,
    must_review_by_human: confidence === 'baja',
    top_internal_results: Array.isArray(tenantSearch?.data)
      ? tenantSearch.data.slice(0, 5)
      : [],
    top_knowledge_results: Array.isArray(knowledgeSearch?.data)
      ? knowledgeSearch.data.slice(0, 5)
      : [],
    top_benchmark_results: topRows,
  };
}



function getAuthHeaderFromReq(req) {
  return req.headers.authorization || req.headers.Authorization || '';
}

function getExternalLookupData(externalLookupResult) {
  const raw = externalLookupResult?.raw || externalLookupResult || {};
  return raw?.data || raw || {};
}

function getExternalLookupResults(externalLookupResult) {
  const data = getExternalLookupData(externalLookupResult);

  if (Array.isArray(data?.trusted_results)) return data.trusted_results;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.sources)) return data.sources;

  return [];
}

function getExternalHitCount(externalLookupResult) {
  return getExternalLookupResults(externalLookupResult).length;
}

async function callExternalLookup({ req, tenantId, question, acceptExtraCharge = false, forceRefresh = false }) {
  if (typeof fetch !== 'function') {
    return {
      ok: false,
      error: 'fetch no disponible en runtime Node.js para ejecutar búsqueda externa.',
      raw: null,
    };
  }

  const baseUrl = (
    process.env.INTERNAL_API_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/ai-external-lookup/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeaderFromReq(req),
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      query: question,
      scenario: detectQuestionIntent(question),
      accept_extra_charge: acceptExtraCharge === true,
      force_refresh: forceRefresh === true,
    }),
  });

  let json = null;

  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return {
    ok: response.ok && json?.ok !== false,
    http_status: response.status,
    code: json?.code || null,
    error: json?.error || null,
    detail: json?.detail || null,
    raw: json,
  };
}

function buildAnswerFromExternalLookup(question, tenantSearch, knowledgeSearch, benchmarkResult, externalLookupResult) {
  const results = getExternalLookupResults(externalLookupResult);
  const topResults = results.slice(0, 5);
  const intent = detectQuestionIntent(question);

  const extraChargeRequired =
    externalLookupResult?.code === 'EXTERNAL_LOOKUP_EXTRA_CHARGE_REQUIRED';

  if (extraChargeRequired) {
    return {
      executive_summary:
        'La información interna disponible no fue suficiente y la búsqueda externa requiere autorización de consulta adicional.',
      analysis:
        'El sistema llegó hasta la capa externa, pero no ejecutó una nueva búsqueda porque se requiere aceptación de consulta adicional.',
      recommendation:
        'Autorizar la consulta adicional solo si la respuesta requiere respaldo externo actualizado. Si no se autoriza, usar la recomendación de mejor esfuerzo y completar evidencia interna.',
      suggested_evidence: buildSuggestedEvidence(intent, []),
      next_steps: [
        'Solicitar autorización para consulta adicional si se requiere respaldo externo.',
        'Completar evidencia propia del tenant.',
        'Registrar responsable, fecha objetivo y criterio de cierre.',
      ],
      risk_if_not_addressed:
        'Si no se obtiene respaldo adicional ni se completa evidencia interna, puede mantenerse una brecha de cumplimiento y trazabilidad insuficiente.',
      confidence: 'baja',
      confidence_score: 35,
      source_level: 'best_effort',
      source_label: 'Mejor esfuerzo controlado; búsqueda externa pendiente de autorización',
      used_external_lookup: false,
      used_anonymized_benchmark: Number(benchmarkResult?.total || 0) > 0,
      used_tenant_internal: Number(tenantSearch?.total || 0) > 0,
      used_tcdx_knowledge: Number(knowledgeSearch?.total || 0) > 0,
      must_review_by_human: true,
      top_internal_results: Array.isArray(tenantSearch?.data) ? tenantSearch.data.slice(0, 5) : [],
      top_knowledge_results: Array.isArray(knowledgeSearch?.data) ? knowledgeSearch.data.slice(0, 5) : [],
      top_benchmark_results: Array.isArray(benchmarkResult?.data) ? benchmarkResult.data.slice(0, 5) : [],
      top_external_results: [],
    };
  }

  if (topResults.length === 0) {
    return {
      executive_summary:
        'La IA consultó las capas disponibles, incluyendo búsqueda externa, pero no encontró fuentes externas confiables suficientemente relevantes. Se entrega una respuesta de mejor esfuerzo.',
      analysis:
        'No se encontraron resultados externos confiables dentro de los dominios configurados. La recomendación queda basada en criterios generales de cumplimiento y en los datos internos disponibles.',
      recommendation:
        'Documentar el caso, completar evidencia propia, asignar responsable y solicitar revisión humana para confirmar el criterio de cumplimiento.',
      suggested_evidence: buildSuggestedEvidence(intent, []),
      next_steps: [
        'Completar evidencia interna del tenant.',
        'Revisar manualmente el criterio normativo aplicable.',
        'Registrar decisión, responsable, fecha y fundamento.',
      ],
      risk_if_not_addressed:
        'Si no se documenta el criterio, puede mantenerse incertidumbre en auditoría y falta de trazabilidad.',
      confidence: 'baja',
      confidence_score: 35,
      source_level: 'best_effort',
      source_label: 'Mejor esfuerzo controlado con búsqueda externa sin resultados útiles',
      used_external_lookup: externalLookupResult?.ok === true,
      used_anonymized_benchmark: Number(benchmarkResult?.total || 0) > 0,
      used_tenant_internal: Number(tenantSearch?.total || 0) > 0,
      used_tcdx_knowledge: Number(knowledgeSearch?.total || 0) > 0,
      must_review_by_human: true,
      top_internal_results: Array.isArray(tenantSearch?.data) ? tenantSearch.data.slice(0, 5) : [],
      top_knowledge_results: Array.isArray(knowledgeSearch?.data) ? knowledgeSearch.data.slice(0, 5) : [],
      top_benchmark_results: Array.isArray(benchmarkResult?.data) ? benchmarkResult.data.slice(0, 5) : [],
      top_external_results: [],
    };
  }

  const externalLines = topResults.map((item, index) => {
    const title = item.title || item.name || item.source || 'Fuente externa confiable';
    const source = item.domain || item.source_domain || item.url || '';
    const suffix = source ? ` Fuente: ${source}.` : '';

    return `${index + 1}. ${title}.${suffix}`;
  });

  return {
    executive_summary:
      'La información interna, la Base TCDX y/o el benchmark no fueron suficientes. Se complementó la respuesta con fuentes externas confiables.',
    analysis:
      `Fuentes externas más relevantes:\n${externalLines.join('\n')}`,
    recommendation:
      'Usar las fuentes externas como respaldo complementario, pero registrar evidencia propia del tenant antes de cerrar cumplimiento.',
    suggested_evidence: buildSuggestedEvidence(intent, topResults),
    next_steps: [
      'Validar la aplicabilidad de las fuentes externas al contexto de la empresa.',
      'Registrar evidencia propia y no depender solo de la fuente externa.',
      'Vincular la respuesta al control, hallazgo, riesgo o no conformidad correspondiente.',
      'Guardar trazabilidad de la consulta externa y criterio usado.',
    ],
    risk_if_not_addressed:
      'Si no se formaliza evidencia propia, puede existir dependencia de fuentes externas sin respaldo operativo interno.',
    confidence: 'media',
    confidence_score: 60,
    source_level: 'external_web',
    source_label: 'Fuentes externas confiables',
    used_external_lookup: true,
    used_anonymized_benchmark: Number(benchmarkResult?.total || 0) > 0,
    used_tenant_internal: Number(tenantSearch?.total || 0) > 0,
    used_tcdx_knowledge: Number(knowledgeSearch?.total || 0) > 0,
    must_review_by_human: false,
    top_internal_results: Array.isArray(tenantSearch?.data) ? tenantSearch.data.slice(0, 5) : [],
    top_knowledge_results: Array.isArray(knowledgeSearch?.data) ? knowledgeSearch.data.slice(0, 5) : [],
    top_benchmark_results: Array.isArray(benchmarkResult?.data) ? benchmarkResult.data.slice(0, 5) : [],
    top_external_results: topResults,
  };
}

function uniqueStrings(items, limit = 12) {
  const out = [];
  const seen = new Set();

  for (const item of items || []) {
    const value =
      typeof item === 'string'
        ? item.trim()
        : item?.title || item?.summary || item?.requirement || item?.pattern_label || '';
    const key = String(value || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }

  return out;
}

function detectSeniorAuditorFocus(question) {
  const q = normalizeSearchForKnowledge(question);

  return {
    standard:
      detectStandardsForKnowledge(question)[0] ||
      (q.includes('27001') ? 'ISO27001' : q.includes('9001') ? 'ISO9001' : q.includes('22301') ? 'ISO22301' : null),
    evidence: /\b(evidencia|registro|documento|respaldo|prueba|archivo)\b/.test(q),
    audit: /\b(auditoria|auditoría|auditor|hallazgo|no conformidad|observacion|observación)\b/.test(q),
    action: /\b(accion|acción|correctiva|plan|remediar|solucionar|cerrar)\b/.test(q),
    risk: /\b(riesgo|impacto|critic|critico|crítico|brecha|vulnerabilidad)\b/.test(q),
    continuity: detectTcdxKnowledgeTopic(question).continuity,
  };
}

function buildSeniorEvidenceGaps(question, answer) {
  const focus = detectSeniorAuditorFocus(question);
  const gaps = [];
  const evidence = Array.isArray(answer.suggested_evidence) ? answer.suggested_evidence : [];
  const hasInternal = Number(answer.top_internal_results?.length || 0) > 0;

  if (!hasInternal) {
    gaps.push('No hay suficiente evidencia interna directamente asociada a la consulta.');
  }

  if (focus.evidence || focus.audit) {
    gaps.push('Confirmar que la evidencia tenga fecha, responsable, alcance, resultado y aprobación.');
    gaps.push('Verificar que la evidencia esté vinculada al control/cláusula correcta y al periodo auditado.');
  }

  if (focus.continuity) {
    gaps.push('Validar RTO/RPO, escenarios de interrupción, prueba de continuidad y lecciones aprendidas.');
  }

  if (evidence.length === 0) {
    gaps.push('Falta definir qué documentos o registros demostrarán cumplimiento objetivo.');
  }

  if (answer.confidence === 'baja') {
    gaps.push('La respuesta requiere revisión humana porque la confianza de contexto es baja.');
  }

  return uniqueStrings(gaps, 8);
}

function buildSeniorRecommendedActions(question, answer) {
  const focus = detectSeniorAuditorFocus(question);
  const actions = [];

  if (focus.audit) {
    actions.push('Clasificar la brecha como observación, no conformidad o riesgo según severidad y evidencia disponible.');
  }

  if (focus.evidence) {
    actions.push('Solicitar evidencia objetiva adicional antes de aceptar cierre del control.');
  }

  if (focus.action || answer.confidence === 'baja') {
    actions.push('Crear o actualizar plan de acción con responsable, fecha objetivo, evidencia esperada y criterio de cierre.');
  }

  if (focus.risk) {
    actions.push('Evaluar impacto, probabilidad y tratamiento; dejar trazabilidad de aceptación o mitigación.');
  }

  actions.push('Registrar decisión del auditor humano y fundamento de aceptación, rechazo o solicitud de complemento.');

  return uniqueStrings([...(answer.next_steps || []), ...actions], 10);
}

function buildSeniorQuestions(question, answer) {
  const focus = detectSeniorAuditorFocus(question);
  const questions = [];

  questions.push('¿La evidencia corresponde al periodo y alcance auditado?');
  questions.push('¿Existe responsable/aprobador identificable y fecha de revisión?');

  if (focus.continuity) {
    questions.push('¿El plan fue probado y existen resultados, brechas y acciones posteriores?');
    questions.push('¿Los RTO/RPO están definidos y validados contra procesos críticos?');
  }

  if (focus.audit || focus.evidence) {
    questions.push('¿La evidencia demuestra ejecución real del control o solo diseño documental?');
  }

  if (answer.confidence === 'baja') {
    questions.push('¿Qué dato interno adicional permitiría elevar la confianza del análisis?');
  }

  return uniqueStrings(questions, 8);
}

function enhanceAnswerWithSeniorAuditor(question, answer) {
  const focus = detectSeniorAuditorFocus(question);
  const evidenceGaps = buildSeniorEvidenceGaps(question, answer);
  const recommendedActions = buildSeniorRecommendedActions(question, answer);
  const reviewQuestions = buildSeniorQuestions(question, answer);
  const suggestedFindings = [];

  if (evidenceGaps.length > 0 && (focus.audit || focus.evidence || focus.risk)) {
    suggestedFindings.push({
      type: focus.risk ? 'riesgo' : 'observacion',
      severity: answer.confidence === 'baja' ? 'media' : 'baja',
      title: 'Brecha de evidencia o trazabilidad pendiente de validación',
      rationale: evidenceGaps[0],
      human_approval_required: true,
    });
  }

  const seniorSummary = [
    answer.executive_summary,
    `Criterio auditor: la respuesta usa fuente ${answer.source_label || answer.source_level || 'no informada'} con confianza ${answer.confidence || 'no determinada'}.`,
    evidenceGaps.length
      ? `Brechas principales: ${evidenceGaps.slice(0, 3).join('; ')}.`
      : 'No se observan brechas críticas con la información disponible.',
  ].filter(Boolean).join(' ');

  return {
    ...answer,
    executive_summary: seniorSummary,
    senior_auditor_view: {
      role: 'auditor_senior_iso_27001_9001_22301',
      standard_focus: focus.standard,
      diagnostic: seniorSummary,
      evidence_gaps: evidenceGaps,
      recommended_actions: recommendedActions,
      review_questions: reviewQuestions,
      suggested_findings: suggestedFindings,
      approval_policy:
        'La IA puede anticipar brechas y sugerir acciones, pero no aprueba, cierra ni crea registros críticos sin validación humana.',
    },
    evidence_gaps: evidenceGaps,
    recommended_actions: recommendedActions,
    auditor_review_questions: reviewQuestions,
    suggested_findings: suggestedFindings,
    human_approval_required: true,
    must_review_by_human: true,
  };
}


async function saveTrace({
  tenantId,
  userId,
  question,
  intent,
  answer,
  tenantSearch,
  knowledgeSearch = null,
  benchmarkResult = null,
  externalLookupResult = null,
}) {
  const externalHits = getExternalHitCount(externalLookupResult);

  const result = await pool.query(
    `
    INSERT INTO ai_core.ai_response_traces (
      tenant_id,
      user_id,
      question,
      normalized_question,
      intent,
      source_level,
      source_label,
      confidence,
      confidence_score,
      tenant_hits,
      knowledge_hits,
      benchmark_hits,
      external_hits,
      used_tenant_internal,
      used_tcdx_knowledge,
      used_anonymized_benchmark,
      used_external_lookup,
      must_review_by_human,
      final_strategy,
      answer_summary,
      answer_json,
      sources_json,
      trace_json,
      metadata
    )
    VALUES (
      $1::uuid,
      NULLIF($2::text, '')::uuid,
      $3::text,
      lower($3::text),
      $4::text,
      $5::text,
      $6::text,
      $7::text,
      $8::numeric,
      $9::int,
      $10::int,
      $11::int,
      $12::int,
      $13::boolean,
      $14::boolean,
      $15::boolean,
      $16::boolean,
      $17::boolean,
      $18::text,
      $19::text,
      $20::jsonb,
      $21::jsonb,
      $22::jsonb,
      $23::jsonb
    )
    RETURNING id, created_at
    `,
    [
      tenantId,
      userId || '',
      question,
      intent,
      answer.source_level,
      answer.source_label,
      answer.confidence,
      answer.confidence_score,
      Number(tenantSearch?.total || 0),
      Number(knowledgeSearch?.total || 0),
      Number(benchmarkResult?.total || 0),
      externalHits,
      answer.used_tenant_internal === true,
      answer.used_tcdx_knowledge === true,
      answer.used_anonymized_benchmark === true,
      answer.used_external_lookup === true,
      answer.must_review_by_human === true,
      answer.used_external_lookup
        ? (
            answer.used_anonymized_benchmark
              ? (
                  answer.used_tcdx_knowledge
                    ? 'tenant_internal_then_tcdx_then_benchmark_then_external'
                    : 'tenant_internal_then_benchmark_then_external'
                )
              : answer.used_tcdx_knowledge
                ? 'tenant_internal_then_tcdx_then_external'
                : 'tenant_internal_then_external'
          )
        : answer.used_anonymized_benchmark
          ? (
              answer.used_tcdx_knowledge
                ? 'tenant_internal_then_tcdx_then_benchmark'
                : 'tenant_internal_then_benchmark'
            )
          : answer.used_tcdx_knowledge
            ? 'tenant_internal_then_tcdx_knowledge'
            : 'tenant_internal_first',
      answer.executive_summary,
      JSON.stringify(answer),
      JSON.stringify([
        ...(answer.top_internal_results || []),
        ...(answer.top_knowledge_results || []),
        ...(answer.top_benchmark_results || []),
        ...(answer.top_external_results || []),
      ]),
      JSON.stringify({
        tenant_search: {
          total: tenantSearch?.total || 0,
          strong_hits: tenantSearch?.strong_hits || 0,
          medium_hits: tenantSearch?.medium_hits || 0,
          top_rank: tenantSearch?.top_rank || 0,
          confidence_hint: tenantSearch?.confidence_hint || 'baja',
          detected_standards: tenantSearch?.detected_standards || [],
          detected_intent: tenantSearch?.detected_intent || {},
        },
        tcdx_knowledge_search: knowledgeSearch
          ? {
              total: knowledgeSearch?.total || 0,
              strong_hits: knowledgeSearch?.strong_hits || 0,
              medium_hits: knowledgeSearch?.medium_hits || 0,
              top_rank: knowledgeSearch?.top_rank || 0,
              confidence_hint: knowledgeSearch?.confidence_hint || 'baja',
              detected_standards: knowledgeSearch?.detected_standards || [],
            }
          : null,
        anonymized_benchmark_search: benchmarkResult
          ? {
              total: benchmarkResult?.total || 0,
              strong_hits: benchmarkResult?.strong_hits || 0,
              medium_hits: benchmarkResult?.medium_hits || 0,
              top_rank: benchmarkResult?.top_rank || 0,
              confidence_hint: benchmarkResult?.confidence_hint || 'baja',
              detected_standards: benchmarkResult?.detected_standards || [],
              privacy_guardrails: benchmarkResult?.privacy_guardrails || {},
            }
          : null,
        external_lookup: externalLookupResult
          ? {
              ok: externalLookupResult?.ok === true,
              http_status: externalLookupResult?.http_status || null,
              code: externalLookupResult?.code || null,
              error: externalLookupResult?.error || null,
              detail: externalLookupResult?.detail || null,
              hits: externalHits,
            }
          : null,
      }),
      JSON.stringify({
        created_from: 'ai_answer_route',
        phase: 'IA-06',
      }),
    ]
  );

  return result.rows[0];
}

// =====================================================
// POST /api/ai-compliance/answer
// Primera versión de respuesta IA: busca primero en información interna del tenant.
// =====================================================
router.post('/', auth, async (req, res) => {
  try {
    const locale = resolveLocale(req);
    res.set('x-tcdx-locale', locale);
    const question = cleanQuestion(req.body?.question || req.body?.q || '');

    if (!question) {
      return res.status(400).json({
        ok: false,
        error: 'question es obligatorio',
      });
    }

    const role = normalizeRole(req.user?.role || req.user?.user_role || req.user?.userRole);
    const isPlatform = isPlatformRole(role);
    const userTenantId = getUserTenantId(req.user);
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        ok: false,
        error: 'tenant_id es obligatorio o debe venir en el token',
      });
    }

    if (!isPlatform && String(tenantId) !== String(userTenantId)) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes permiso para consultar este tenant',
      });
    }

    const intent = detectQuestionIntent(question);

    const tenantSearch = await tenantInternalSearch({
      tenantId,
      q: question,
      limit: Number(req.body?.limit || 12),
    });

    let knowledgeSearch = null;
    let benchmarkResult = null;
    let externalLookupResult = null;
    let answer = buildAnswerFromTenantSearch(question, tenantSearch);
    answer = polishEnglishExecutiveSummary(localizeAiAnswerPayload(answer, locale), locale);

    const needsTcdxKnowledge = questionNeedsTcdxKnowledge(question);

    const shouldUseTcdxKnowledge =
      answer.confidence === 'baja' ||
      answer.source_level === 'best_effort' ||
      Number(tenantSearch?.top_rank || 0) < 10 ||
      Number(tenantSearch?.strong_hits || 0) === 0 ||
      (
        needsTcdxKnowledge &&
        (
          answer.confidence !== 'alta' ||
          Number(tenantSearch?.top_rank || 0) < 25
        )
      );

    if (shouldUseTcdxKnowledge) {
      knowledgeSearch = await searchTcdxKnowledge({
        question,
        limit: Number(req.body?.knowledge_limit || 8),
      });

      const knowledgeIsUseful =
        ['alta', 'media'].includes(String(knowledgeSearch?.confidence_hint || '').toLowerCase()) ||
        Number(knowledgeSearch?.top_rank || 0) >= 10 ||
        (
          needsTcdxKnowledge &&
          Number(knowledgeSearch?.total || 0) > 0
        );

      if (Number(knowledgeSearch?.total || 0) > 0 && knowledgeIsUseful) {
        answer = buildAnswerFromTcdxKnowledge(question, tenantSearch, knowledgeSearch);
    answer = polishEnglishExecutiveSummary(localizeAiAnswerPayload(answer, locale), locale);
      }
    }

    const requestedBenchmarkMinTenants = Number(req.body?.min_tenants || 2);
    const benchmarkMinTenants = isPlatform
      ? Math.max(1, requestedBenchmarkMinTenants)
      : Math.max(2, requestedBenchmarkMinTenants);

    const shouldUseBenchmark =
      req.body?.force_benchmark === true ||
      answer.confidence === 'baja' ||
      answer.source_level === 'best_effort';

    if (shouldUseBenchmark) {
      benchmarkResult = await benchmarkSearch({
        tenantId,
        q: question,
        limit: Number(req.body?.benchmark_limit || 8),
        minTenants: benchmarkMinTenants,
      });

      const benchmarkIsUseful =
        ['alta', 'media'].includes(String(benchmarkResult?.confidence_hint || '').toLowerCase()) ||
        Number(benchmarkResult?.top_rank || 0) >= 10;

      if (Number(benchmarkResult?.total || 0) > 0 && benchmarkIsUseful) {
        answer = buildAnswerFromBenchmark(
          question,
          tenantSearch,
          knowledgeSearch,
          benchmarkResult
        );
    answer = polishEnglishExecutiveSummary(localizeAiAnswerPayload(answer, locale), locale);
      }
    }

    const shouldUseExternalLookup =
      req.body?.force_external_lookup === true ||
      req.body?.force_external === true ||
      answer.confidence === 'baja' ||
      answer.source_level === 'best_effort';

    if (shouldUseExternalLookup && req.body?.allow_external_lookup !== false) {
      externalLookupResult = await callExternalLookup({
        req,
        tenantId,
        question,
        acceptExtraCharge: req.body?.accept_extra_charge === true,
        forceRefresh: req.body?.force_external_refresh === true || req.body?.force_refresh === true,
      });

      const externalHasResults = getExternalHitCount(externalLookupResult) > 0;
      const externalNeedsAttention =
        externalLookupResult?.code === 'EXTERNAL_LOOKUP_EXTRA_CHARGE_REQUIRED';

      if (externalHasResults || externalNeedsAttention || req.body?.force_external_lookup === true || req.body?.force_external === true) {
        answer = buildAnswerFromExternalLookup(
          question,
          tenantSearch,
          knowledgeSearch,
          benchmarkResult,
          externalLookupResult
        );
    answer = polishEnglishExecutiveSummary(localizeAiAnswerPayload(answer, locale), locale);
      }
    }

    answer = polishEnglishExecutiveSummary(
      localizeAiAnswerPayload(enhanceAnswerWithSeniorAuditor(question, answer), locale),
      locale
    );

    const sourceOrder = ['tenant_internal'];

    if (answer.used_tcdx_knowledge) {
      sourceOrder.push('tcdx_knowledge');
    }

    if (answer.used_anonymized_benchmark) {
      sourceOrder.push('anonymized_benchmark');
    }

    if (answer.used_external_lookup) {
      sourceOrder.push('external_web');
    }

    const trace = await saveTrace({
      tenantId,
      userId: getUserId(req.user),
      question,
      intent,
      answer,
      tenantSearch,
      knowledgeSearch,
      benchmarkResult,
      externalLookupResult,
    });

    return res.json({
      ok: true,
      locale,
      tenant_id: tenantId,
      question,
      answer,
      trace: {
        id: trace.id,
        created_at: trace.created_at,
      },
      search_trace: {
        source_order: sourceOrder,
        tenant_hits: tenantSearch.total,
        knowledge_hits: knowledgeSearch?.total || 0,
        benchmark_hits: benchmarkResult?.total || 0,
        external_hits: getExternalHitCount(externalLookupResult),
        tenant_confidence_hint: tenantSearch.confidence_hint,
        knowledge_confidence_hint: knowledgeSearch?.confidence_hint || null,
        benchmark_confidence_hint: benchmarkResult?.confidence_hint || null,
        external_lookup_status: externalLookupResult
          ? {
              ok: externalLookupResult?.ok === true,
              http_status: externalLookupResult?.http_status || null,
              code: externalLookupResult?.code || null,
              error: externalLookupResult?.error || null,
            }
          : null,
        top_rank: answer.used_external_lookup
          ? getExternalHitCount(externalLookupResult)
          : answer.used_anonymized_benchmark
            ? benchmarkResult?.top_rank || 0
            : answer.used_tcdx_knowledge
              ? knowledgeSearch?.top_rank || 0
              : tenantSearch.top_rank,
        fallback_pending: answer.source_level === 'best_effort',
      },
    });
  } catch (error) {
    console.error('ERROR AI ANSWER:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error generando respuesta IA',
      ...errorDetail(error),
    });
  }
});

module.exports = router;
