'use strict';

const SENSITIVE_KEY_RE = /(token|secret|password|authorization|cookie|api_key|apikey|credential|prompt|trace|embedding|chunk|raw_text|full_text|content_text|download_url|provider_file_id|internal_url)/i;
const INTERNAL_URL_RE = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|[^/\s]+\.int)(?:[^\s]*)?/gi;

const DISCLAIMER = 'Este Intelligence Brief es un apoyo para gestión y preparación de auditoría. Requiere revisión humana y no constituye certificación, aprobación automática ni reemplazo de auditoría.';

function asString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).replace(INTERNAL_URL_RE, '[url_interna_redactada]').replace(/\s+/g, ' ').trim() || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampText(value, maxLength = 700, fallback = '') {
  const text = asString(value, fallback);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function safeValue(value, depth = 0) {
  if (depth > 4) return '[redactado]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return clampText(value, 700);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => safeValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (SENSITIVE_KEY_RE.test(key)) return acc;
      acc[key] = safeValue(item, depth + 1);
      return acc;
    }, {});
  }
  return null;
}

function titleFromItem(item, fallback) {
  if (typeof item === 'string') return clampText(item, 180, fallback);
  return clampText(
    item?.title ||
      item?.name ||
      item?.label ||
      item?.action ||
      item?.summary ||
      item?.description ||
      fallback,
    180,
    fallback
  );
}

function descriptionFromItem(item, fallback) {
  if (typeof item === 'string') return clampText(item, 420, fallback);
  return clampText(
    item?.description ||
      item?.detail ||
      item?.reason ||
      item?.rationale ||
      item?.summary ||
      item?.title ||
      fallback,
    420,
    fallback
  );
}

function normalizeItems(items, fallbackTitle, limit = 5) {
  return asArray(items).slice(0, limit).map((item, index) => ({
    title: titleFromItem(item, `${fallbackTitle} ${index + 1}`),
    description: descriptionFromItem(item, 'Requiere revisión humana para confirmar alcance, evidencia y prioridad.'),
    priority: asString(item?.priority || item?.severity || item?.risk_level || item?.level || '', ''),
    confidence: asString(item?.confidence || '', ''),
  }));
}

function normalizeKnowledgeBasis(items, limit = 10) {
  return asArray(items).slice(0, limit).map((item, index) => ({
    ref_id: asString(item?.ref_id || item?.id || item?.code || `kb_${index + 1}`),
    title: clampText(item?.title || item?.name || item?.clause || item?.control || 'Base de conocimiento interna', 180),
    source_type: asString(item?.source_type || item?.type || item?.provider || 'knowledge_basis'),
    basis: clampText(item?.basis || item?.summary || item?.description || item?.rationale || item?.text || '', 420),
  }));
}

function fallbackFromPreview(preview = {}) {
  const sections = asArray(preview.sections).reduce((acc, section) => {
    if (section?.code) acc[section.code] = section.data || {};
    return acc;
  }, {});
  const health = sections.health?.summary || sections.summary?.health_global || {};
  const gaps = sections.gaps?.gaps || [];
  const risks = sections.risks?.risks || [];
  const actions = sections.actions?.actions || [];
  const evidence = sections.evidence?.missing || [];

  return {
    executive_summary: [
      'Análisis asistido construido desde el preview estructurado del reporte.',
      health.score || health.global_score ? `Health informado: ${health.score ?? health.global_score}.` : 'Health no informado para el alcance.',
      `Brechas priorizadas: ${asArray(gaps).length}; riesgos revisados: ${asArray(risks).length}; acciones consideradas: ${asArray(actions).length}; evidencias faltantes: ${asArray(evidence).length}.`,
    ].join(' '),
    overall_state: health.label || health.status || null,
    overall_score: health.score ?? health.global_score ?? null,
    main_gaps: asArray(gaps).slice(0, 5),
    main_risks: asArray(risks).slice(0, 5),
    priority_actions: asArray(actions).slice(0, 5),
    data_limitations: asArray(preview.warnings).slice(0, 5),
    knowledge_basis_annex: [],
  };
}

function normalizeIntelligenceBrief({ payload = {}, preview = {} } = {}) {
  if (payload.include_intelligence_brief === false) return null;
  const source = payload.intelligence_brief && typeof payload.intelligence_brief === 'object'
    ? payload.intelligence_brief
    : fallbackFromPreview(preview);

  const executiveSummary = clampText(
    source.executive_summary ||
      source.summary ||
      source.overview ||
      fallbackFromPreview(preview).executive_summary,
    1400
  );

  const brief = {
    status: 'included',
    generated_at: new Date().toISOString(),
    title: 'Intelligence Brief / Análisis asistido',
    executive_summary: executiveSummary,
    overall_state: clampText(source.overall_state || source.state || '', 120),
    overall_score: source.overall_score ?? source.score ?? null,
    audit_readiness: safeValue(source.audit_readiness || null),
    confidence: safeValue(source.confidence || null),
    key_signals: [
      ...normalizeItems(source.main_gaps || source.gaps || source.findings, 'Brecha o señal relevante', 5),
      ...normalizeItems(source.main_risks || source.risks, 'Riesgo relevante', 5),
    ].slice(0, 8),
    recommended_actions: normalizeItems(source.priority_actions || source.next_best_actions || source.actions, 'Acción recomendada', 6),
    knowledge_basis: normalizeKnowledgeBasis(source.knowledge_basis_annex || source.knowledge_basis || source.sources, 10),
    limitations: Array.from(new Set([
      ...asArray(source.data_limitations || source.limitations).map((item) => clampText(item, 280)),
      ...(source.fallback_reason ? [`Modo fallback: ${clampText(source.fallback_reason, 160)}`] : []),
      'Debe ser revisado por una persona competente antes de usarse en una reunión, auditoría o decisión formal.',
    ])).slice(0, 8),
    requires_human_review: true,
    disclaimer: DISCLAIMER,
  };

  return safeValue(brief);
}

module.exports = {
  DISCLAIMER,
  normalizeIntelligenceBrief,
};
