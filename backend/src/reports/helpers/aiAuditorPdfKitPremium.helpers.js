'use strict';

const fs = require('fs');
const path = require('path');

const MARGIN_LEFT = 46;
const MARGIN_RIGHT = 46;
const MARGIN_TOP = 58;
const MARGIN_BOTTOM = 52;
const HEADER_HEIGHT = 42;
const FOOTER_HEIGHT = 34;
const GAP = 8;

const COLORS = {
  night: '#071B3A',
  slate: '#0F172A',
  blue: '#0B5FFF',
  blueSoft: '#EAF2FF',
  green: '#16A34A',
  amber: '#F59E0B',
  red: '#EF4444',
  bg: '#F8FAFC',
  border: '#E5E7EB',
  text: '#111827',
  muted: '#4B5563',
  lightMuted: '#64748B',
};

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function cleanText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'object') {
    return cleanText(value.title || value.name || value.label || value.description || value.summary, fallback);
  }
  return String(value).replace(/\s+/g, ' ').trim() || fallback;
}

function truncateText(value, maxChars = 220, fallback = '-') {
  const text = cleanText(value, fallback);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

function displayStatus(value, fallback = '-') {
  if (value === true) return 'Si';
  if (value === false) return 'No';
  const raw = normalizeKey(value);
  const map = {
    not_ready: 'No listo',
    no_listo: 'No listo',
    no_apto: 'No listo',
    ready: 'Listo',
    listo: 'Listo',
    partial: 'Parcial',
    parcial: 'Parcial',
    ready_with_observations: 'Listo con observaciones',
    listo_con_observaciones: 'Listo con observaciones',
    critical: 'Critico',
    critica: 'Critico',
    critico: 'Critico',
    needs_review: 'Requiere revision',
    requiere_revision: 'Requiere revision',
    no_data: 'Sin datos',
    sin_datos: 'Sin datos',
    approved: 'Aprobada',
    aprobada: 'Aprobada',
    rejected: 'Rechazada',
    rechazada: 'Rechazada',
    pending: 'Pendiente',
    pendiente: 'Pendiente',
    high: 'Alta',
    alta: 'Alta',
    medium: 'Media',
    media: 'Media',
    low: 'Baja',
    baja: 'Baja',
    fast: 'Rapido',
    balanced: 'Balanceado',
    deep: 'Profundo',
    deterministic: 'Deterministico',
  };
  return map[raw] || cleanText(value, fallback);
}

function boolLabel(value, fallback = 'No') {
  if (value === true || String(value).toLowerCase() === 'true') return 'Si';
  if (value === false || String(value).toLowerCase() === 'false') return 'No';
  return fallback;
}

function severityColor(value) {
  const raw = normalizeKey(value);
  if (raw.includes('not_ready') || raw.includes('no_listo') || raw.includes('crit') || raw.includes('alta') || raw.includes('high')) return COLORS.red;
  if (raw.includes('partial') || raw.includes('parcial') || raw.includes('media') || raw.includes('medium')) return COLORS.amber;
  if (raw.includes('ready') || raw.includes('listo') || raw.includes('baja') || raw.includes('low')) return COLORS.green;
  return '#475569';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value, fallback = 0) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value, fallback))));
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function localeText(locale, key) {
  const en = String(locale || '').toLowerCase().startsWith('en');
  const dict = {
    title: en ? 'Senior AI Auditor Report' : 'Informe IA Auditor Senior',
    subtitle: en
      ? 'Non-destructive audit assessment with mandatory human review.'
      : 'Evaluacion auditora no destructiva con revision humana obligatoria.',
    footer: en
      ? 'TCDX by Tecdex · AI Auditor · Human review required'
      : 'TCDX by Tecdex · IA Auditor · Revision humana obligatoria',
    empty: en ? 'No data available for this section.' : 'Sin datos disponibles para esta seccion.',
  };
  return dict[key] || key;
}

function resolveImagePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const candidates = [];
  if (path.isAbsolute(raw)) candidates.push(raw);
  const fileName = path.basename(raw);
  if (fileName && fileName === path.basename(fileName)) {
    candidates.push(path.join(__dirname, '..', '..', '..', 'uploads', 'logos', fileName));
    candidates.push(path.join(__dirname, '..', '..', '..', 'uploads', fileName));
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function drawImageSafe(doc, imagePath, x, y, options = {}) {
  if (!imagePath) return false;
  try {
    doc.image(imagePath, x, y, options);
    return true;
  } catch {
    return false;
  }
}

function fullResult(analysis) {
  return asObject(analysis?.full_result_json || analysis);
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function dedupeByText(rows, mapper = (item) => cleanText(item)) {
  const seen = new Set();
  const result = [];
  asArray(rows).forEach((row) => {
    const key = mapper(row).toLowerCase();
    if (!key || key === '-' || seen.has(key)) return;
    seen.add(key);
    result.push(row);
  });
  return result;
}

function normalizeGaps(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const rows = firstArray(
    structured.gaps,
    full.gaps,
    analysis?.gaps,
    full.summary?.main_gaps,
    analysis?.summary?.main_gaps,
    full.evidence_gaps
  );
  return dedupeByText(rows, (item) => cleanText(item.title || item.description || item.requirement || item))
    .slice(0, 5)
    .map((item, index) => ({
      severity: displayStatus(item.severity || item.priority || item.level || 'media'),
      color: severityColor(item.severity || item.priority || item.level),
      title: truncateText(item.title || item.type || item.requirement || `Brecha ${index + 1}`, 76),
      requirement: truncateText(item.clause || item.requirement || item.control_id || item.control_code || item.standard_code || '-', 42),
      cause: truncateText(item.cause || item.evidence || item.description || item.detail || 'Requiere evidencia objetiva y revision de causa.', 132),
      risk: truncateText(item.audit_risk || item.risk || item.impact || item.business_impact || 'Riesgo de observacion o no conformidad.', 110),
      recommendation: truncateText(item.recommendation || item.suggested_action || item.action || 'Definir tratamiento, responsable y evidencia esperada.', 118),
    }));
}

function normalizeEvidences(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const assessment = asObject(structured.evidence_assessment || full.evidence_assessment);
  const rows = firstArray(
    structured.evidence_requests,
    full.evidence_requests,
    analysis?.evidence_requests,
    assessment.missing_evidence,
    structured.documents_to_request,
    full.documents_to_request,
    full.evidence_gaps
  );
  return dedupeByText(rows, (item) => cleanText(item.title || item.evidence || item.document || item.name || item))
    .slice(0, 6)
    .map((item, index) => {
      const row = typeof item === 'string' ? { title: item } : item;
      return {
        evidence: truncateText(row.filename || row.file_name || row.title || row.evidence || row.document || row.name || `Evidencia ${index + 1}`, 72),
        priority: displayStatus(row.priority || row.severity || row.status || 'alta'),
        reason: truncateText(row.reason || row.description || row.expected_evidence || row.observation || 'Necesaria para sustentar conclusion auditora.', 116),
        control: truncateText(row.control_id || row.control_code || row.requirement || row.standard_code || '-', 34),
      };
    });
}

function normalizeActions(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const rows = firstArray(
    structured.recommended_actions,
    full.recommended_actions,
    full.suggested_actions,
    analysis?.suggested_actions,
    full.action_plan_suggestions,
    analysis?.action_plan_suggestions,
    analysis?.suggestions_json?.action_plan_suggestions,
    full.next_steps,
    analysis?.next_steps
  );
  return dedupeByText(rows, (item) => cleanText(item.action || item.title || item.description || item))
    .slice(0, 5)
    .map((item, index) => {
      const row = typeof item === 'string' ? { title: item } : item;
      return {
        priority: displayStatus(row.priority || row.severity || row.level || (index < 2 ? 'alta' : 'media')),
        action: truncateText(row.action || row.title || row.description || `Accion sugerida ${index + 1}`, 96),
        owner: truncateText(row.owner || row.suggested_owner_role || row.responsible || row.suggested_owner || 'Responsable ISO', 44),
        due: truncateText(row.deadline || row.due_date_suggestion || row.suggested_due_days || row.due_days || '30 dias', 24),
        evidence: truncateText(row.expected_evidence || row.recommendation || row.evidence || row.acceptance_criteria?.[0] || 'Evidencia objetiva de ejecucion.', 86),
      };
    });
}

function countAlerts(rows) {
  return rows.filter((row) => {
    const raw = JSON.stringify(row).toLowerCase();
    return raw.includes('crit') || raw.includes('alta') || raw.includes('pending') || raw.includes('partial') || raw.includes('review') || raw.includes('venc');
  }).length;
}

function resolveTrace({ full, analysis }) {
  const trace = asObject(full.traceability || full.trace || analysis?.trace || analysis?.trace_json);
  const metrics = asObject(full.metrics || full.ai_metrics || trace.metrics || analysis?.metrics);
  const engine = asObject(full.engine || trace.engine || metrics.engine);
  const requestMetadata = asObject(full.request_metadata || trace.request_metadata);
  const hasTrace = Boolean(
    trace.request_id ||
    trace.model_mode ||
    trace.used_llm !== undefined ||
    engine.model ||
    engine.used_llm !== undefined ||
    metrics.used_llm !== undefined
  );
  const usedLlm = trace.used_llm ?? trace.llm_used ?? engine.used_llm ?? metrics.used_llm ?? full.used_llm;
  const aiEngineUsed = trace.ai_engine_used ?? analysis?.ai_engine_used ?? full.ai_engine_used;
  const modelName = trace.model_name || trace.selected_model || trace.model || engine.model || metrics.model_name || metrics.selected_model;
  const modelMode = trace.model_mode || full.model_mode || metrics.model_mode_used || metrics.model_mode || requestMetadata.model_mode;
  const llmProvider = trace.llm_provider || trace.provider || engine.llm_provider || metrics.llm_provider || 'ollama';
  const usedRag = trace.used_rag ?? engine.used_rag ?? metrics.used_rag;
  const usedWeb = trace.used_web ?? engine.used_web ?? metrics.used_web;
  const usedDrive = trace.used_drive ?? engine.used_drive ?? metrics.used_drive;

  return {
    hasTrace,
    request_id: cleanText(trace.request_id || full.request_id || metrics.request_id, hasTrace ? '-' : 'Trazabilidad IA no disponible en analisis antiguo'),
    history_run_id: cleanText(trace.history_run_id || full.history_run_id || analysis?.history_run_id || analysis?.id, '-'),
    source: cleanText(trace.source || full.source || 'Sistema TCDX', 'Sistema TCDX'),
    ai_engine_used: aiEngineUsed === undefined ? null : aiEngineUsed === true,
    engine_label: hasTrace
      ? (usedLlm === true ? 'LLM/Ollama' : (aiEngineUsed === true ? 'AI Engine deterministico' : 'Historico guardado'))
      : 'Historico guardado',
    llm_used: hasTrace ? boolLabel(usedLlm, '-') : 'Trazabilidad no disponible',
    model_name: hasTrace ? cleanText(modelName, usedLlm === true ? 'Modelo no informado' : 'No aplica') : 'Trazabilidad no disponible',
    model_mode: hasTrace ? displayStatus(modelMode, 'No informado') : 'Trazabilidad no disponible',
    llm_provider: hasTrace ? cleanText(llmProvider, usedLlm === true ? 'ollama' : 'No aplica') : 'Trazabilidad no disponible',
    rag_used: hasTrace ? boolLabel(usedRag, '-') : 'Trazabilidad no disponible',
    web_used: hasTrace ? boolLabel(usedWeb, '-') : 'Trazabilidad no disponible',
    drive_used: hasTrace ? boolLabel(usedDrive, '-') : 'Trazabilidad no disponible',
    duration_ms: cleanText(trace.duration_ms || metrics.duration_ms || metrics.total_ms, hasTrace ? '-' : 'Trazabilidad no disponible'),
  };
}

function normalizeReadiness(value, auditScore, confidenceScore, criticalGaps) {
  const raw = normalizeKey(value);
  if (raw.includes('not_ready') || raw.includes('no_listo') || raw.includes('crit') || raw.includes('low')) return 'not_ready';
  if (raw.includes('ready') || raw.includes('listo') || raw.includes('high')) {
    if (confidenceScore < 70 || criticalGaps) return 'partial';
    return 'ready';
  }
  if (auditScore >= 85 && confidenceScore >= 70 && !criticalGaps) return 'ready';
  if (auditScore < 65 || criticalGaps) return 'not_ready';
  return 'partial';
}

function normalizeData({ locale, tenant, analysis }) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const summary = asObject(full.summary || analysis?.summary || analysis?.summary_json);
  const coverage = asObject(full.coverage || analysis?.coverage || analysis?.coverage_json);
  const scope = asObject(full.scope || analysis?.scope);
  const gaps = normalizeGaps(analysis);
  const evidences = normalizeEvidences(analysis);
  const actions = normalizeActions(analysis);
  const criticalGaps = gaps.some((gap) => severityColor(gap.severity) === COLORS.red);
  let auditScore = clampPercent(full.audit_score ?? summary.audit_score ?? summary.score ?? analysis?.score, 0);
  const confidenceScore = clampPercent(full.confidence_score ?? summary.confidence_score ?? summary.confidence_score_pct ?? full.confidence * 100, gaps.length ? 68 : 55);
  if (auditScore >= 100 && criticalGaps) auditScore = 84;
  const readiness = normalizeReadiness(full.readiness_level || summary.readiness_level || structured.audit_readiness?.status || analysis?.readiness_level, auditScore, confidenceScore, criticalGaps);
  const trace = resolveTrace({ full, analysis });
  const executiveSummary = truncateText(
    summary.executive_summary ||
      structured.executive_summary ||
      full.executive_summary ||
      full.answer ||
      structured.diagnosis ||
      summary.executive_message ||
      'IA Auditor Senior reviso controles, evidencias, hallazgos y acciones asociadas al alcance seleccionado. La evaluacion identifica brechas que requieren tratamiento y revision humana antes de una auditoria formal.',
    560
  );

  return {
    locale,
    tenantName: truncateText(tenant?.name || tenant?.company_name || tenant?.business_name, 70, 'Tenant'),
    tenantLogoPath: resolveImagePath(tenant?.logo_url || tenant?.logo),
    tcdxLogoPath: resolveImagePath(process.env.TCDX_LOGO_PATH || process.env.REPORT_TCDX_LOGO_PATH || 'tcdx-logo.png'),
    standard: truncateText(full.standard_code || scope.standard_code || analysis?.standard_code || (Array.isArray(scope.standards) ? scope.standards.join(', ') : ''), 38, 'Multinorma'),
    version: truncateText(full.version_code || scope.version_code || analysis?.version_code, 24, ''),
    emittedAt: formatDate(),
    focus: truncateText(full.audit_focus || scope.audit_focus || analysis?.audit_focus || 'certification_readiness', 46),
    depth: displayStatus(full.depth || scope.depth || analysis?.depth || 'executive'),
    auditScore,
    confidenceScore,
    readiness,
    readinessLabel: displayStatus(readiness),
    opinion: truncateText(full.audit_opinion || summary.auditor_opinion || structured.audit_readiness?.status || (readiness === 'ready' ? 'Listo con revision final' : readiness === 'partial' ? 'Parcial con observaciones' : 'No listo'), 72),
    executiveSummary,
    auditorReading: [
      truncateText(structured.audit_readiness?.reason || summary.audit_readiness?.reason || 'La preparacion debe validarse contra evidencia objetiva vigente.', 120),
      truncateText(structured.risk_impact || summary.risk_impact || gaps[0]?.risk || 'El riesgo principal es declarar preparacion sin trazabilidad suficiente.', 120),
      truncateText(structured.limitations?.[0] || full.limitations?.[0] || 'La IA no sustituye el juicio de auditor humano.', 120),
    ],
    coverage: {
      controls_reviewed: toNumber(coverage.controls_reviewed, full.context_v2?.priority_controls?.length || 0),
      evidences_reviewed: toNumber(coverage.evidences_reviewed, full.context_v2?.recent_evidences?.length || evidences.length),
      findings_reviewed: toNumber(coverage.findings_reviewed, full.context_v2?.recent_findings?.length || 0),
      actions_reviewed: toNumber(coverage.actions_reviewed, full.context_v2?.recent_action_plans?.length || actions.length),
      controls_with_alert: toNumber(coverage.controls_with_alert, countAlerts(gaps)),
      evidences_with_alert: toNumber(coverage.evidences_with_alert, evidences.length),
    },
    gaps,
    evidences,
    actions,
    trace,
    governance: {
      human_review_required: analysis?.human_review_required !== false,
      db_write: false,
      can_create_records: false,
    },
  };
}

function layout(doc) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  return {
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    bottom: pageHeight - MARGIN_BOTTOM,
  };
}

function drawFooter(doc, data, pageNumber) {
  const { pageWidth, pageHeight } = layout(doc);
  const y = pageHeight - FOOTER_HEIGHT;
  doc.rect(MARGIN_LEFT, y - 4, pageWidth - MARGIN_LEFT - MARGIN_RIGHT, 1).fill('#E5E7EB');
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightMuted)
    .text(localeText(data.locale, 'footer'), MARGIN_LEFT, y + 6, { width: 360 });
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightMuted)
    .text(`Pagina ${pageNumber}`, pageWidth - MARGIN_RIGHT - 70, y + 6, { width: 70, align: 'right' });
}

function drawHeader(doc, data, title) {
  const { pageWidth } = layout(doc);
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT).fill(COLORS.slate);
  const drewLogo = drawImageSafe(doc, data.tcdxLogoPath, MARGIN_LEFT, 8, { fit: [68, 24] });
  if (!drewLogo) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#93C5FD')
      .text('TCDX by Tecdex', MARGIN_LEFT, 14, { width: 110 });
  }
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF')
    .text(title, 150, 10, { width: pageWidth - 300, align: 'center' });
  doc.font('Helvetica').fontSize(6.5).fillColor('#CBD5E1')
    .text(`${data.tenantName} · ${data.emittedAt}`, 150, 24, { width: pageWidth - 300, align: 'center' });
  const drewTenantLogo = drawImageSafe(doc, data.tenantLogoPath, pageWidth - MARGIN_RIGHT - 70, 8, { fit: [70, 24], align: 'right' });
  if (!drewTenantLogo) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#CBD5E1')
      .text(data.tenantName, pageWidth - MARGIN_RIGHT - 90, 14, { width: 90, align: 'right' });
  }
}

function addPageWithHeaderFooter(doc, ctx, title, first = false) {
  if (!first) {
    drawFooter(doc, ctx.data, ctx.page);
    doc.addPage();
  }
  ctx.page += 1;
  drawHeader(doc, ctx.data, title);
  ctx.y = MARGIN_TOP;
}

function ensureSpace(doc, ctx, neededHeight, title = localeText(ctx.data.locale, 'title')) {
  if (ctx.y + neededHeight <= layout(doc).bottom) return;
  addPageWithHeaderFooter(doc, ctx, title);
}

function drawSectionTitle(doc, ctx, title) {
  ensureSpace(doc, ctx, 26);
  const { contentWidth } = layout(doc);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.text)
    .text(title, MARGIN_LEFT, ctx.y, { width: contentWidth });
  ctx.y += 16;
  doc.rect(MARGIN_LEFT, ctx.y, contentWidth, 1).fill('#CBD5E1');
  ctx.y += 10;
}

function drawTextBlock(doc, ctx, text, options = {}) {
  const x = options.x ?? MARGIN_LEFT;
  const width = options.width ?? layout(doc).contentWidth;
  const size = options.size || 8.5;
  const color = options.color || COLORS.muted;
  const font = options.bold ? 'Helvetica-Bold' : 'Helvetica';
  const value = truncateText(text, options.maxChars || 500, '');
  const height = Math.min(options.maxHeight || 80, doc.heightOfString(value, { width, lineGap: 2 }) + 2);
  ensureSpace(doc, ctx, height + 4);
  const y = options.y ?? ctx.y;
  doc.font(font).fontSize(size).fillColor(color)
    .text(value, x, y, { width, height, lineGap: 2 });
  ctx.y = y + height + (options.gap ?? 8);
  return height;
}

function drawBadge(doc, x, y, label, color, width = 86) {
  doc.roundedRect(x, y, width, 18, 9).fillAndStroke(`${color}16`, `${color}66`);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(color)
    .text(truncateText(label, 24), x + 8, y + 5, { width: width - 16, align: 'center', height: 8 });
}

function drawKpiCard(doc, x, y, width, label, value, color = COLORS.blue, helper = '') {
  doc.roundedRect(x, y, width, 40, 8).fillAndStroke('#FFFFFF', COLORS.border);
  doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#6B7280')
    .text(truncateText(label, 28), x + 8, y + 7, { width: width - 16, height: 8 });
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(color)
    .text(truncateText(value, 30), x + 8, y + 20, { width: width - 16, height: 14 });
  if (helper) {
    doc.font('Helvetica').fontSize(5.6).fillColor('#6B7280')
      .text(truncateText(helper, 34), x + 8, y + 33, { width: width - 16, height: 6 });
  }
}

function drawGauge(doc, x, y, width, label, value, color) {
  const percent = clampPercent(value, 0);
  doc.roundedRect(x, y, width, 48, 10).fillAndStroke('#FFFFFF', COLORS.border);
  doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.muted)
    .text(label, x + 10, y + 8, { width: width - 20 });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(color)
    .text(`${percent}%`, x + 10, y + 20, { width: 54 });
  doc.roundedRect(x + 62, y + 25, width - 74, 8, 4).fill('#E5E7EB');
  doc.roundedRect(x + 62, y + 25, Math.max(8, (width - 74) * percent / 100), 8, 4).fill(color);
}

function drawReadinessBar(doc, x, y, width, readiness) {
  const labels = ['No listo', 'Parcial', 'Listo obs.', 'Listo'];
  const active = readiness === 'ready' ? 3 : readiness === 'partial' ? 1 : 0;
  const stepW = width / labels.length;
  doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.muted)
    .text('Estado de preparacion', x, y, { width });
  labels.forEach((label, index) => {
    const fill = index <= active ? (index === 0 ? COLORS.red : index === 1 ? COLORS.amber : COLORS.green) : '#E5E7EB';
    doc.roundedRect(x + stepW * index, y + 18, stepW - 4, 9, 4.5).fill(fill);
    doc.font('Helvetica').fontSize(5.8).fillColor(index === active ? COLORS.text : '#6B7280')
      .text(label, x + stepW * index, y + 31, { width: stepW - 4, align: 'center', height: 7 });
  });
}

function drawSeverityBar(doc, x, y, width, gaps) {
  const counts = { alta: 0, media: 0, baja: 0 };
  asArray(gaps).forEach((gap) => {
    const color = severityColor(gap.severity || gap.risk);
    if (color === COLORS.red) counts.alta += 1;
    else if (color === COLORS.green) counts.baja += 1;
    else counts.media += 1;
  });
  const total = Math.max(1, counts.alta + counts.media + counts.baja);
  const segments = [
    ['Alta', counts.alta, COLORS.red],
    ['Media', counts.media, COLORS.amber],
    ['Baja', counts.baja, COLORS.green],
  ];
  doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.muted)
    .text('Severidad de brechas', x, y, { width });
  let cursor = x;
  segments.forEach(([label, count, color]) => {
    const segmentW = Math.max(8, width * Number(count) / total);
    doc.roundedRect(cursor, y + 18, segmentW, 10, 5).fill(color);
    doc.font('Helvetica').fontSize(5.8).fillColor(COLORS.muted)
      .text(`${label}: ${count}`, cursor, y + 31, { width: Math.max(segmentW, 44), height: 7 });
    cursor += segmentW;
  });
}

function drawBulletList(doc, ctx, rows, options = {}) {
  const items = asArray(rows).slice(0, options.limit || 3);
  if (!items.length) {
    drawTextBlock(doc, ctx, localeText(ctx.data.locale, 'empty'), { size: 8, color: COLORS.lightMuted, maxHeight: 20 });
    return;
  }
  items.forEach((item) => {
    drawTextBlock(doc, ctx, `• ${truncateText(item, options.maxChars || 120)}`, {
      size: options.size || 7.8,
      maxHeight: 20,
      gap: 2,
    });
  });
}

function drawCompactTable(doc, ctx, title, rows, columns, options = {}) {
  const source = asArray(rows).slice(0, options.limit || rows.length);
  const rowHeight = options.rowHeight || 28;
  const headerHeight = 16;
  const tableHeight = headerHeight + Math.max(1, source.length) * rowHeight + 8;
  ensureSpace(doc, ctx, tableHeight + 22, title);
  drawSectionTitle(doc, ctx, title);
  const y0 = ctx.y;
  const x0 = MARGIN_LEFT;
  const width = layout(doc).contentWidth;
  doc.roundedRect(x0, y0, width, headerHeight, 6).fill(COLORS.blueSoft);
  columns.forEach((column) => {
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor(COLORS.text)
      .text(column.label, x0 + column.x + 5, y0 + 5, { width: column.width - 8, height: 7 });
  });
  let y = y0 + headerHeight + 3;
  if (!source.length) {
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightMuted)
      .text(localeText(ctx.data.locale, 'empty'), x0 + 6, y + 6, { width: width - 12, height: rowHeight - 8 });
    ctx.y = y + rowHeight + 8;
    return;
  }
  source.forEach((row, index) => {
    if (y + rowHeight > layout(doc).bottom) {
      ctx.y = y;
      addPageWithHeaderFooter(doc, ctx, title);
      y = ctx.y;
    }
    doc.roundedRect(x0, y, width, rowHeight, 5).fillAndStroke(index % 2 ? '#FFFFFF' : COLORS.bg, COLORS.border);
    columns.forEach((column) => {
      const rawValue = typeof column.value === 'function' ? column.value(row) : row[column.value];
      doc.font(column.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(column.size || 6.4).fillColor(column.color ? column.color(row) : COLORS.muted)
        .text(truncateText(rawValue, column.maxChars || 90), x0 + column.x + 5, y + 5, {
          width: column.width - 8,
          height: rowHeight - 8,
          lineGap: 1,
        });
    });
    y += rowHeight + 3;
  });
  if (asArray(rows).length > source.length) {
    doc.font('Helvetica-Oblique').fontSize(6.3).fillColor(COLORS.lightMuted)
      .text('Se muestran los principales registros. Ver trazabilidad completa en plataforma.', x0, y + 2, { width });
    y += 12;
  }
  ctx.y = y + 8;
}

function drawTwoColumnCards(doc, ctx, title, leftTitle, leftRows, rightTitle, rightRows) {
  ensureSpace(doc, ctx, 250, title);
  drawSectionTitle(doc, ctx, title);
  const startY = ctx.y;
  const colW = (layout(doc).contentWidth - 14) / 2;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + colW + 14;

  function drawColumn(x, heading, rows, type) {
    let y = startY;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text).text(heading, x, y, { width: colW });
    y += 14;
    const source = asArray(rows);
    if (!source.length) {
      doc.roundedRect(x, y, colW, 32, 8).fillAndStroke('#FFFFFF', COLORS.border);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightMuted)
        .text(localeText(ctx.data.locale, 'empty'), x + 8, y + 10, { width: colW - 16 });
      return y + 40;
    }
    source.forEach((row, index) => {
      const h = type === 'gap' ? 40 : 31;
      doc.roundedRect(x, y, colW, h, 8).fillAndStroke('#FFFFFF', COLORS.border);
      if (type === 'gap') {
        drawBadge(doc, x + 8, y + 8, row.severity, row.color, 54);
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.text)
          .text(row.title, x + 68, y + 7, { width: colW - 78, height: 9 });
        doc.font('Helvetica').fontSize(6.1).fillColor(COLORS.muted)
          .text(`${row.requirement} · ${row.risk}`, x + 68, y + 19, { width: colW - 78, height: 14 });
      } else {
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.text)
          .text(row.evidence, x + 8, y + 7, { width: colW - 84, height: 9 });
        drawBadge(doc, x + colW - 68, y + 7, row.priority, severityColor(row.priority), 58);
        doc.font('Helvetica').fontSize(6.1).fillColor(COLORS.muted)
          .text(row.reason, x + 8, y + 19, { width: colW - 16, height: 9 });
      }
      y += h + 6;
      if (index === source.length - 1 && rows.length > source.length) y += 8;
    });
    return y;
  }

  const leftEnd = drawColumn(leftX, leftTitle, leftRows, 'gap');
  const rightEnd = drawColumn(rightX, rightTitle, rightRows, 'evidence');
  ctx.y = Math.max(leftEnd, rightEnd) + 8;
}

function renderCoverPage(doc, ctx) {
  const data = ctx.data;
  addPageWithHeaderFooter(doc, ctx, 'Portada ejecutiva', true);
  const { contentWidth } = layout(doc);

  doc.roundedRect(MARGIN_LEFT, ctx.y, contentWidth, 118, 18).fillAndStroke(COLORS.night, COLORS.night);
  drawImageSafe(doc, data.tcdxLogoPath, MARGIN_LEFT + 18, ctx.y + 18, { fit: [92, 30] }) ||
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#93C5FD').text('TCDX by Tecdex', MARGIN_LEFT + 18, ctx.y + 26, { width: 120 });
  drawImageSafe(doc, data.tenantLogoPath, MARGIN_LEFT + contentWidth - 100, ctx.y + 18, { fit: [80, 30], align: 'right' });
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF')
    .text(localeText(data.locale, 'title'), MARGIN_LEFT + 18, ctx.y + 52, { width: contentWidth - 36, height: 28 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#CBD5E1')
    .text(localeText(data.locale, 'subtitle'), MARGIN_LEFT + 18, ctx.y + 83, { width: contentWidth - 36, height: 14 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
    .text(`${data.tenantName} · ${data.standard} · ${data.focus}`, MARGIN_LEFT + 18, ctx.y + 99, { width: contentWidth - 36, height: 12 });
  drawBadge(doc, MARGIN_LEFT + contentWidth - 144, ctx.y + 54, data.opinion, severityColor(data.readiness), 118);
  ctx.y += 130;

  const cardW = (contentWidth - GAP * 3) / 4;
  const row1 = [
    ['Score auditor', `${data.auditScore}%`, severityColor(data.readiness)],
    ['Confianza', `${data.confidenceScore}%`, data.confidenceScore >= 70 ? COLORS.green : COLORS.amber],
    ['Preparacion', data.readinessLabel, severityColor(data.readiness)],
    ['Motor usado', data.trace.engine_label, COLORS.blue],
  ];
  const row2 = [
    ['Modelo / modo', `${data.trace.model_mode}`, COLORS.blue],
    ['Controles', data.coverage.controls_reviewed, COLORS.green],
    ['Evidencias', data.coverage.evidences_reviewed, '#7C3AED'],
    ['Revision humana', data.governance.human_review_required ? 'Requerida' : 'Recomendada', COLORS.amber],
  ];
  const row3 = [
    ['Hallazgos', data.coverage.findings_reviewed, '#475569'],
    ['Acciones', data.coverage.actions_reviewed, '#475569'],
    ['Alertas control', data.coverage.controls_with_alert, data.coverage.controls_with_alert ? COLORS.red : COLORS.green],
    ['Escritura automatica', 'Sin cambios', COLORS.green],
  ];
  [row1, row2, row3].forEach((row) => {
    row.forEach(([label, value, color], index) => {
      drawKpiCard(doc, MARGIN_LEFT + index * (cardW + GAP), ctx.y, cardW, label, value, color);
    });
    ctx.y += 48;
  });

  const gaugeW = (contentWidth - 12) / 2;
  drawGauge(doc, MARGIN_LEFT, ctx.y, gaugeW, 'Score auditor', data.auditScore, severityColor(data.readiness));
  drawGauge(doc, MARGIN_LEFT + gaugeW + 12, ctx.y, gaugeW, 'Confianza', data.confidenceScore, data.confidenceScore >= 70 ? COLORS.green : COLORS.amber);
  ctx.y += 58;
  drawReadinessBar(doc, MARGIN_LEFT, ctx.y, gaugeW, data.readiness);
  drawSeverityBar(doc, MARGIN_LEFT + gaugeW + 12, ctx.y, gaugeW, data.gaps);
  ctx.y += 58;

  drawSectionTitle(doc, ctx, 'Resumen ejecutivo');
  drawTextBlock(doc, ctx, data.executiveSummary, { maxChars: 520, maxHeight: 78, size: 8.4 });
  drawSectionTitle(doc, ctx, 'Lectura auditora');
  drawBulletList(doc, ctx, data.auditorReading, { limit: 3, maxChars: 118 });
}

function renderAssessmentPage(doc, ctx) {
  const data = ctx.data;
  addPageWithHeaderFooter(doc, ctx, 'Brechas, evidencias y plan');

  drawTwoColumnCards(
    doc,
    ctx,
    'Brechas y evidencias prioritarias',
    'Brechas principales',
    data.gaps,
    'Evidencias requeridas',
    data.evidences
  );

  drawCompactTable(doc, ctx, 'Plan de accion sugerido', data.actions, [
    { label: 'Prioridad', x: 0, width: 58, value: 'priority', color: (row) => severityColor(row.priority), maxChars: 14, bold: true },
    { label: 'Accion', x: 58, width: 154, value: 'action', maxChars: 74, bold: true },
    { label: 'Responsable', x: 212, width: 88, value: 'owner', maxChars: 28 },
    { label: 'Plazo', x: 300, width: 52, value: 'due', maxChars: 18 },
    { label: 'Evidencia esperada', x: 352, width: layout(doc).contentWidth - 352, value: 'evidence', maxChars: 58 },
  ], { limit: 5, rowHeight: 27 });

  ensureSpace(doc, ctx, 132, 'Conclusion y trazabilidad');
  drawSectionTitle(doc, ctx, 'Conclusion auditora');
  const conclusionY = ctx.y;
  const leftW = (layout(doc).contentWidth - 12) * 0.48;
  const rightW = layout(doc).contentWidth - leftW - 12;
  doc.roundedRect(MARGIN_LEFT, conclusionY, leftW, 82, 12).fillAndStroke('#FFF7ED', '#FED7AA');
  doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#9A3412')
    .text(`${data.opinion} · ${data.readinessLabel}`, MARGIN_LEFT + 10, conclusionY + 10, { width: leftW - 20, height: 11 });
  doc.font('Helvetica').fontSize(7).fillColor('#7C2D12')
    .text('Priorizar cierre de evidencia, trazabilidad y responsables antes de declarar preparacion formal. La revision humana es obligatoria para cualquier decision auditora.', MARGIN_LEFT + 10, conclusionY + 28, { width: leftW - 20, height: 42, lineGap: 1 });

  doc.roundedRect(MARGIN_LEFT + leftW + 12, conclusionY, rightW, 82, 12).fillAndStroke('#FFFFFF', COLORS.border);
  const traceLines = data.trace.hasTrace ? [
    `ID: ${data.trace.history_run_id}`,
    `Request: ${data.trace.request_id}`,
    `Modo/modelo: ${data.trace.model_mode} · ${data.trace.model_name}`,
    `LLM/RAG/Web/Drive: ${data.trace.llm_used} / ${data.trace.rag_used} / ${data.trace.web_used} / ${data.trace.drive_used}`,
    `Proveedor: ${data.trace.llm_provider} · Duracion: ${data.trace.duration_ms}${data.trace.duration_ms !== '-' ? ' ms' : ''}`,
    `Fuente: ${data.trace.source}`,
  ] : [
    'Trazabilidad IA no disponible en analisis antiguo.',
    `ID: ${data.trace.history_run_id}`,
    'Fuente: resultado historico persistido en TCDX.',
  ];
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.text)
    .text('Trazabilidad tecnica compacta', MARGIN_LEFT + leftW + 22, conclusionY + 10, { width: rightW - 20 });
  doc.font('Helvetica').fontSize(6.2).fillColor(COLORS.muted)
    .text(traceLines.join('\n'), MARGIN_LEFT + leftW + 22, conclusionY + 24, { width: rightW - 20, height: 50, lineGap: 1 });
  ctx.y = conclusionY + 96;
}

function renderAiAuditorPremiumPdf(doc, { locale = 'es', tenant = {}, analysis = {} } = {}) {
  const data = normalizeData({ locale, tenant, analysis });
  const ctx = { page: 0, y: MARGIN_TOP, data };

  renderCoverPage(doc, ctx);
  renderAssessmentPage(doc, ctx);
  drawFooter(doc, data, ctx.page);
}

module.exports = {
  renderAiAuditorPremiumPdf,
  // Exported for the lightweight QA script; not part of public API.
  _internal: {
    normalizeData,
    truncateText,
    displayStatus,
  },
};
