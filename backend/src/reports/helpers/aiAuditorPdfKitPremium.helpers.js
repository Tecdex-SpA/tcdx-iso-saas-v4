'use strict';

const fs = require('fs');
const path = require('path');

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

function cleanText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'object') {
    return cleanText(value.title || value.name || value.label || value.description || value.summary, fallback);
  }
  return String(value).replace(/\s+/g, ' ').trim() || fallback;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
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
    title: en ? 'Premium AI Auditor Report' : 'Informe Premium IA Auditor',
    subtitle: en
      ? 'Non-destructive audit readiness assessment with human-review governance.'
      : 'Evaluacion auditora no destructiva con gobernanza de revision humana.',
    executiveCover: en ? 'Executive cover' : 'Portada ejecutiva',
    scopeMethodology: en ? 'Scope, criteria and methodology' : 'Alcance, criterio y metodologia',
    auditedSample: en ? 'Audited sample' : 'Muestra auditada',
    gapsFindings: en ? 'Gaps and suggested findings' : 'Brechas y hallazgos sugeridos',
    conclusionTrace: en ? 'Conclusion, plan and traceability' : 'Conclusion, plan y trazabilidad',
    tenant: en ? 'Client / tenant' : 'Cliente / tenant',
    standard: en ? 'ISO standard' : 'Norma ISO',
    emittedAt: en ? 'Issued at' : 'Fecha de emision',
    focus: en ? 'Audit focus' : 'Foco auditor',
    depth: en ? 'Depth' : 'Profundidad',
    auditScore: en ? 'Audit score' : 'Score auditor',
    confidence: en ? 'Confidence score' : 'Confidence score',
    readiness: en ? 'Readiness level' : 'Estado de preparacion',
    opinion: en ? 'Executive result' : 'Resultado ejecutivo',
    controls: en ? 'Controls' : 'Controles',
    evidences: en ? 'Evidence' : 'Evidencias',
    findings: en ? 'Findings' : 'Hallazgos',
    actions: en ? 'Actions' : 'Acciones',
    controlsAlert: en ? 'Controls with alerts' : 'Controles con alerta',
    evidencesAlert: en ? 'Evidence with alerts' : 'Evidencias con alerta',
    objective: en ? 'Objective' : 'Objetivo',
    scope: en ? 'Scope' : 'Alcance',
    dataSources: en ? 'Data sources used' : 'Fuentes de datos usadas',
    criteria: en ? 'Applicable audit criteria' : 'Criterios normativos aplicables',
    methodology: en ? 'Non-destructive AI methodology' : 'Metodologia IA no destructiva',
    limitations: en ? 'Limitations' : 'Limitaciones',
    humanReview: en ? 'Mandatory human review' : 'Revision humana obligatoria',
    reviewedControls: en ? 'Reviewed controls' : 'Controles revisados',
    reviewedEvidences: en ? 'Reviewed evidence' : 'Evidencias revisadas',
    mainGaps: en ? 'Main gaps' : 'Brechas principales',
    suggestedFindings: en ? 'Suggested findings' : 'Hallazgos sugeridos',
    suggestedPlan: en ? 'Suggested plan' : 'Plan sugerido',
    governance: en ? 'Governance' : 'Gobernanza',
    traceability: en ? 'Traceability' : 'Trazabilidad',
    requiredEvidence: en ? 'Required evidence' : 'Evidencias requeridas',
    auditorReading: en ? 'Auditor reading' : 'Lectura auditora',
    executiveDecision: en ? 'Executive decision' : 'Decision ejecutiva',
    automaticWrite: en ? 'Automatic write' : 'Escritura automatica',
    analyticEngine: en ? 'Analytic engine' : 'Motor analitico',
    reviewedSample: en ? 'Priority audited sample' : 'Muestra auditada prioritaria',
    technicalTrace: en ? 'Controlled technical trace' : 'Trazabilidad tecnica controlada',
    empty: en ? 'No data available for this section.' : 'Sin datos disponibles para esta seccion.',
    footer: en
      ? 'TCDX by Tecdex · AI Auditor · Human review required'
      : 'TCDX by Tecdex · IA Auditor · Revision humana obligatoria',
  };
  return dict[key] || key;
}

function severityColor(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('not_ready') || raw.includes('no apto')) return '#DC2626';
  if (raw.includes('ready') || raw.includes('listo')) return '#059669';
  if (raw.includes('partial') || raw.includes('parcial')) return '#D97706';
  if (raw.includes('crit') || raw.includes('alta') || raw.includes('high')) return '#DC2626';
  if (raw.includes('media') || raw.includes('medium') || raw.includes('moder')) return '#D97706';
  if (raw.includes('baja') || raw.includes('low')) return '#059669';
  return '#475569';
}

function fullResult(analysis) {
  return asObject(analysis?.full_result_json || analysis);
}

function nestedArray(...values) {
  for (const value of values) {
    const rows = asArray(value);
    if (rows.length) return rows;
  }
  return [];
}

function normalizeControls(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const controls = nestedArray(
    full.reviewed_controls,
    analysis?.reviewed_controls,
    full.control_recommendations,
    analysis?.control_recommendations,
    structured.control_recommendations,
    full.critical_controls,
    full.summary?.main_risks,
    analysis?.summary?.main_risks
  );

  return controls.slice(0, 24).map((item, index) => ({
    clause: cleanText(item.clause || item.requirement || item.control_code || item.standard_code || item.control_id, `C-${index + 1}`),
    control: cleanText(item.control_name || item.name || item.title || item.control_title, 'Control revisado'),
    status: cleanText(item.status || item.health_status || item.state || item.audit_risk, 'needs_review'),
    score: item.score ?? item.health_score ?? item.risk_score ?? item.readiness_score ?? null,
    evidence: cleanText(item.evidence_status || item.evidence || item.evidence_count || item.evidence_summary, 'needs_review'),
    observation: cleanText(item.ai_observation || item.observation || item.reason || item.description, 'Requiere revision auditora.'),
    action: cleanText(item.suggested_action || item.recommended_action || item.recommendation, 'Validar evidencia, responsable y estado.'),
  }));
}

function normalizeEvidences(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const evidenceAssessment = asObject(structured.evidence_assessment || full.evidence_assessment);
  const evidences = nestedArray(
    full.reviewed_evidences,
    analysis?.reviewed_evidences,
    full.evidence_requests,
    analysis?.evidence_requests,
    structured.evidence_requests,
    evidenceAssessment.missing_evidence,
    structured.documents_to_request,
    full.documents_to_request,
    full.evidence_gaps,
    analysis?.summary?.main_gaps
  );

  return evidences.slice(0, 24).map((item, index) => ({
    evidence: cleanText(item.filename || item.file_name || item.title || item.name || item.evidence_id, `Evidencia ${index + 1}`),
    control: cleanText(item.control_id || item.control_code || item.requirement || item.standard_code, '-'),
    status: cleanText(item.status || item.evidence_status || item.priority, 'needs_review'),
    sufficiency: cleanText(item.sufficiency || item.validity || item.reason || item.due_status, 'partial'),
    observation: cleanText(item.ai_observation || item.observation || item.description || item.recommendation, 'Validar suficiencia y vigencia.'),
  }));
}

function normalizeGaps(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  return dedupeByText(nestedArray(
    full.gaps,
    structured.gaps,
    analysis?.gaps,
    full.summary?.main_gaps,
    analysis?.summary?.main_gaps,
    full.evidence_gaps
  ), (item) => cleanText(item.title || item.description || item.requirement || item)).slice(0, 24).map((item, index) => ({
    severity: cleanText(item.severity || item.priority || item.level, 'media'),
    title: cleanText(item.title || item.type || item.requirement, `Brecha ${index + 1}`),
    requirement: cleanText(item.requirement || item.control_id || item.control_code || item.standard_code, '-'),
    cause: cleanText(item.cause || item.evidence || item.description || item.detail, 'Requiere analisis de causa/evidencia.'),
    risk: cleanText(item.audit_risk || item.risk || item.impact, 'medio'),
    recommendation: cleanText(item.recommendation || item.suggested_action || item.action, 'Definir tratamiento y evidencia esperada.'),
  }));
}

function normalizeFindings(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  return nestedArray(
    full.suggested_findings,
    analysis?.suggested_findings,
    full.findings_suggestions,
    analysis?.findings_suggestions,
    structured.findings_suggestions,
    analysis?.suggestions_json?.findings_suggestions
  ).slice(0, 24).map((item, index) => ({
    type: cleanText(item.type || item.finding_type || item.category, 'Observacion'),
    severity: cleanText(item.severity || item.priority || item.level, 'media'),
    requirement: cleanText(item.requirement || item.control_id || item.control_code, '-'),
    description: cleanText(item.description || item.title || item.observation, `Hallazgo sugerido ${index + 1}`),
    recommendation: cleanText(item.recommendation || item.recommended_action || item.action, 'Validar con auditor humano.'),
  }));
}

function normalizeActions(analysis) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  return dedupeByText(nestedArray(
    full.suggested_actions,
    analysis?.suggested_actions,
    structured.recommended_actions,
    full.action_plan_suggestions,
    analysis?.action_plan_suggestions,
    analysis?.suggestions_json?.action_plan_suggestions,
    full.next_steps,
    analysis?.next_steps,
    structured.next_steps
  ), (item) => cleanText(item.action || item.title || item.description || item)).slice(0, 24).map((item, index) => {
    const fromString = typeof item === 'string' ? item : '';
    return {
      priority: cleanText(item.priority || item.severity || item.level, index < 3 ? 'alta' : 'media'),
      action: cleanText(item.action || item.title || item.description || fromString, `Accion sugerida ${index + 1}`),
      owner: cleanText(item.owner || item.suggested_owner_role || item.responsible || item.suggested_owner, 'Responsable ISO'),
      due: cleanText(item.deadline || item.due_date_suggestion || item.suggested_due_days || item.due_days, '30 dias'),
      evidence: cleanText(item.expected_evidence || item.recommendation || item.evidence, 'Registro actualizado y evidencia objetiva.'),
    };
  });
}

function countAlerts(rows, keys) {
  return rows.filter((row) => {
    const raw = keys.map((key) => String(row[key] || '')).join(' ').toLowerCase();
    return raw.includes('alert') || raw.includes('attention') || raw.includes('deterior') ||
      raw.includes('crit') || raw.includes('alta') || raw.includes('pending') ||
      raw.includes('partial') || raw.includes('review') || raw.includes('venc');
  }).length;
}

function computeConfidence({ controls, evidences, gaps, coverage }) {
  const base = 20;
  const score = base +
    (controls.length ? 24 : 0) +
    (evidences.length ? 22 : 0) +
    (Number.isFinite(Number(coverage.controls_reviewed)) ? 8 : 0) +
    (Number.isFinite(Number(coverage.evidences_reviewed)) ? 8 : 0) +
    (gaps.length ? 8 : 0);
  return clampPercent(score, 45);
}

function normalizeReadiness(value, auditScore, confidenceScore, criticalGaps) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('not_ready') || raw.includes('no_apto') || raw.includes('crit') || raw.includes('low')) return 'not_ready';
  if (raw.includes('ready') || raw.includes('alto') || raw.includes('high')) {
    if (confidenceScore < 70 || criticalGaps) return 'partial';
    return 'ready';
  }
  if (auditScore >= 85 && confidenceScore >= 70 && !criticalGaps) return 'ready';
  if (auditScore < 65 || criticalGaps) return 'not_ready';
  return 'partial';
}

function opinionFor(readiness) {
  if (readiness === 'ready') return 'Apto con revision final';
  if (readiness === 'not_ready') return 'No apto todavia';
  return 'Apto con observaciones';
}

function normalizeData({ locale, tenant, analysis }) {
  const full = fullResult(analysis);
  const structured = asObject(full.structured_result || analysis?.structured_result);
  const summary = asObject(full.summary || analysis?.summary || analysis?.summary_json);
  const coverage = asObject(full.coverage || analysis?.coverage || analysis?.coverage_json);
  const trace = asObject(full.traceability || full.trace || analysis?.trace || analysis?.trace_json);
  const metrics = asObject(full.metrics || full.ai_metrics || trace.metrics || analysis?.metrics);
  const governance = asObject(full.governance || analysis?.governance);
  const scope = asObject(full.scope || analysis?.scope);
  const controls = normalizeControls(analysis);
  const evidences = normalizeEvidences(analysis);
  const gaps = normalizeGaps(analysis);
  const findings = normalizeFindings(analysis);
  const actions = normalizeActions(analysis);
  const controlAlerts = toNumber(coverage.controls_with_alert, countAlerts(controls, ['status', 'observation', 'action']));
  const evidenceAlerts = toNumber(coverage.evidences_with_alert, countAlerts(evidences, ['status', 'sufficiency', 'observation']));
  const criticalGaps = gaps.some((gap) => {
    const raw = `${gap.severity} ${gap.risk}`.toLowerCase();
    return raw.includes('crit') || raw.includes('alta') || raw.includes('high');
  });
  let auditScore = clampPercent(full.audit_score ?? summary.audit_score ?? summary.score ?? analysis?.score, 0);
  const computedConfidence = computeConfidence({ controls, evidences, gaps, coverage });
  const confidenceScore = clampPercent(full.confidence_score ?? summary.confidence_score ?? summary.confidence_score_pct, computedConfidence);

  if (auditScore >= 100 && (controlAlerts || evidenceAlerts || criticalGaps)) auditScore = 84;
  if (auditScore >= 100 && confidenceScore < 70) auditScore = 82;

  const readiness = normalizeReadiness(full.readiness_level || summary.readiness_level, auditScore, confidenceScore, criticalGaps);

  return {
    locale,
    tenantName: cleanText(tenant?.name || tenant?.company_name || tenant?.business_name, 'Tenant'),
    tenantLogoPath: resolveImagePath(tenant?.logo_url || tenant?.logo),
    tcdxLogoPath: resolveImagePath(process.env.TCDX_LOGO_PATH || process.env.REPORT_TCDX_LOGO_PATH || 'tcdx-logo.png'),
    standard: cleanText(full.standard_code || scope.standard_code || analysis?.standard_code || (Array.isArray(scope.standards) ? scope.standards.join(', ') : ''), 'Multinorma'),
    version: cleanText(full.version_code || scope.version_code || analysis?.version_code, ''),
    emittedAt: formatDate(),
    focus: cleanText(full.audit_focus || scope.audit_focus || trace.audit_focus || analysis?.audit_focus, 'readiness'),
    depth: cleanText(full.depth || scope.depth || trace.depth || analysis?.depth, 'deep'),
    auditScore,
    confidenceScore,
    readiness,
    readinessLabel: displayStatus(readiness),
    opinion: cleanText(full.audit_opinion || summary.auditor_opinion || structured.audit_readiness?.status, opinionFor(readiness)),
    executiveSummary: cleanText(
      summary.executive_summary ||
      structured.executive_summary ||
      full.executive_summary ||
      full.answer ||
      structured.diagnosis ||
      summary.executive_message,
      'IA Auditor Senior reviso controles, evidencias, hallazgos y acciones asociadas al alcance seleccionado. La evaluacion identifica brechas que requieren tratamiento y revision humana antes de una auditoria formal.'
    ),
    auditorReading: [
      cleanText(structured.audit_readiness?.reason || summary.audit_readiness?.reason || 'La preparacion debe validarse contra evidencia objetiva vigente.'),
      cleanText(structured.risk_impact || summary.risk_impact || 'El riesgo principal es declarar preparacion sin trazabilidad suficiente.'),
      cleanText(structured.limitations?.[0] || full.limitations?.[0] || 'La IA no sustituye el juicio de auditor humano.'),
    ],
    coverage: {
      controls_reviewed: toNumber(coverage.controls_reviewed, controls.length),
      evidences_reviewed: toNumber(coverage.evidences_reviewed, evidences.length),
      findings_reviewed: toNumber(coverage.findings_reviewed, findings.length),
      actions_reviewed: toNumber(coverage.actions_reviewed, actions.length),
      controls_with_alert: controlAlerts,
      evidences_with_alert: evidenceAlerts,
    },
    controls,
    evidences,
    gaps,
    findings,
    actions,
    governance: {
      human_review_required: governance.human_review_required !== false && analysis?.human_review_required !== false,
      db_write: governance.db_write === true || trace.db_write === true,
      critical_record_write: governance.critical_record_write === true || trace.critical_record_write === true,
      can_create_records: governance.can_create_records === true && analysis?.can_create_records === true,
      ai_engine_used: governance.ai_engine_used === true || trace.ai_engine_used === true || analysis?.ai_engine_used === true,
      history_run_id: cleanText(trace.history_run_id || full.history_run_id || analysis?.history_run_id || analysis?.id, '-'),
      request_id: cleanText(trace.request_id || full.request_id || metrics.request_id, '-'),
      user: cleanText(trace.user || full.user || analysis?.requested_by || analysis?.generated_by, '-'),
      timestamp: cleanText(trace.generated_at || full.generated_at || analysis?.created_at, formatDate()),
      source: cleanText(trace.source || full.source, 'Sistema TCDX'),
      provider: cleanText(trace.provider || full.provider || metrics.llm_provider, '-'),
      model: cleanText(trace.model || full.model || metrics.model_name || metrics.selected_model, '-'),
      model_mode: displayStatus(trace.model_mode || full.model_mode || metrics.model_mode_used || metrics.model_mode, '-'),
      llm_used: boolLabel(trace.used_llm ?? full.used_llm ?? metrics.used_llm, '-'),
      rag_used: boolLabel(trace.used_rag ?? full.used_rag ?? metrics.used_rag, '-'),
      web_used: boolLabel(trace.used_web ?? full.used_web ?? metrics.used_web, '-'),
      drive_used: boolLabel(trace.used_drive ?? full.used_drive ?? metrics.used_drive, '-'),
      duration_ms: cleanText(trace.duration_ms || full.duration_ms || metrics.duration_ms, '-'),
    },
  };
}

function footer(doc, data, pageNumber) {
  const y = doc.page.height - 34;
  doc.font('Helvetica').fontSize(7).fillColor('#64748B');
  doc.text(localeText(data.locale, 'footer'), 46, y, { width: 360 });
  doc.text(`Pagina ${pageNumber}`, doc.page.width - 110, y, { width: 64, align: 'right' });
}

function header(doc, data, title) {
  doc.rect(0, 0, doc.page.width, 42).fill('#0F172A');
  const drewLogo = drawImageSafe(doc, data.tcdxLogoPath, 46, 8, { fit: [66, 24] });
  if (!drewLogo) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#93C5FD').text('TCDX by Tecdex', 46, 14);
  }
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text(title, 142, 10, { width: doc.page.width - 284, align: 'center' });
  doc.font('Helvetica').fontSize(6.5).fillColor('#CBD5E1').text(`${data.tenantName} · ${data.emittedAt}`, 142, 24, { width: doc.page.width - 284, align: 'center' });
  const drewTenantLogo = drawImageSafe(doc, data.tenantLogoPath, doc.page.width - 112, 8, { fit: [66, 24], align: 'right' });
  if (!drewTenantLogo) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#CBD5E1').text(data.tenantName, doc.page.width - 126, 14, { width: 80, align: 'right' });
  }
  doc.y = 58;
}

function newPage(doc, data, state, title, first = false) {
  if (!first) {
    footer(doc, data, state.page);
    doc.addPage();
  }
  state.page += 1;
  header(doc, data, title);
}

function sectionTitle(doc, title) {
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A').text(title);
  doc.moveTo(46, doc.y + 4).lineTo(doc.page.width - 46, doc.y + 4).strokeColor('#CBD5E1').lineWidth(1).stroke();
  doc.moveDown(0.75);
}

function paragraph(doc, value, options = {}) {
  doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 9)
    .fillColor(options.color || '#334155')
    .text(cleanText(value, ''), { width: options.width || doc.page.width - 92, lineGap: 3 });
}

function drawBadge(doc, x, y, value, color = '#2563EB', width = 118) {
  doc.roundedRect(x, y, width, 22, 11).fillAndStroke(`${color}18`, `${color}55`);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(color)
    .text(cleanText(value), x + 10, y + 7, { width: width - 20, align: 'center' });
}

function kpiCard(doc, x, y, width, label, value, helper, color = '#1D4ED8') {
  doc.roundedRect(x, y, width, 58, 10).fillAndStroke('#F8FAFC', '#E2E8F0');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text(label, x + 10, y + 9, { width: width - 20 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(color).text(displayStatus(value), x + 10, y + 25, { width: width - 20 });
  doc.font('Helvetica').fontSize(6.8).fillColor('#64748B').text(cleanText(helper, ''), x + 10, y + 45, { width: width - 20 });
}

function compactKpiCard(doc, x, y, width, label, value, color = '#1D4ED8') {
  doc.roundedRect(x, y, width, 40, 8).fillAndStroke('#FFFFFF', '#E5E7EB');
  doc.font('Helvetica-Bold').fontSize(6.4).fillColor('#6B7280').text(label, x + 8, y + 7, { width: width - 16, height: 8 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(color).text(displayStatus(value), x + 8, y + 20, { width: width - 16, height: 16 });
}

function drawGauge(doc, x, y, width, label, value, color) {
  const percent = clampPercent(value, 0);
  const barY = y + 34;
  doc.roundedRect(x, y, width, 62, 12).fillAndStroke('#FFFFFF', '#E5E7EB');
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#4B5563').text(label, x + 12, y + 10, { width: width - 24 });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(color).text(`${percent}%`, x + 12, y + 21, { width: width - 24 });
  doc.roundedRect(x + 12, barY + 12, width - 24, 8, 4).fill('#E5E7EB');
  doc.roundedRect(x + 12, barY + 12, Math.max(8, (width - 24) * percent / 100), 8, 4).fill(color);
}

function drawReadinessBar(doc, x, y, width, readiness) {
  const labels = ['No listo', 'Parcial', 'Listo obs.', 'Listo'];
  const active = readiness === 'ready' ? 3 : readiness === 'partial' ? 1 : 0;
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#4B5563').text('Barra de preparacion auditora', x, y);
  const stepW = width / labels.length;
  labels.forEach((label, index) => {
    const fill = index <= active ? (index === 0 ? '#EF4444' : index === 1 ? '#F59E0B' : '#16A34A') : '#E5E7EB';
    doc.roundedRect(x + stepW * index, y + 18, stepW - 4, 10, 5).fill(fill);
    doc.font('Helvetica').fontSize(6).fillColor(index === active ? '#111827' : '#6B7280')
      .text(label, x + stepW * index, y + 32, { width: stepW - 4, align: 'center' });
  });
}

function drawSeverityBar(doc, x, y, width, gaps) {
  const counts = { alta: 0, media: 0, baja: 0 };
  asArray(gaps).forEach((gap) => {
    const raw = normalizeKey(gap.severity || gap.priority || gap.risk);
    if (raw.includes('alta') || raw.includes('high') || raw.includes('crit')) counts.alta += 1;
    else if (raw.includes('baja') || raw.includes('low')) counts.baja += 1;
    else counts.media += 1;
  });
  const total = Math.max(1, counts.alta + counts.media + counts.baja);
  const segments = [
    ['Alta', counts.alta, '#EF4444'],
    ['Media', counts.media, '#F59E0B'],
    ['Baja', counts.baja, '#16A34A'],
  ];
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#4B5563').text('Distribucion de severidad', x, y);
  let cursor = x;
  segments.forEach(([label, count, color]) => {
    const segmentW = Math.max(10, width * Number(count) / total);
    doc.roundedRect(cursor, y + 18, segmentW, 12, 6).fill(color);
    doc.font('Helvetica').fontSize(6).fillColor('#374151').text(`${label}: ${count}`, cursor, y + 34, { width: segmentW + 12 });
    cursor += segmentW;
  });
}

function bulletList(doc, rows, mapper = (item) => cleanText(item), limit = 9) {
  const items = asArray(rows).slice(0, limit);
  if (!items.length) {
    paragraph(doc, 'Sin datos disponibles para esta seccion.', { color: '#64748B' });
    return;
  }

  items.forEach((item) => {
    doc.font('Helvetica').fontSize(8.2).fillColor('#334155')
      .text(`• ${mapper(item)}`, { width: doc.page.width - 96, lineGap: 2 });
  });
}

function ensureSpace(doc, data, state, title, height) {
  if (doc.y + height <= doc.page.height - 58) return;
  newPage(doc, data, state, title);
}

function table(doc, data, state, title, rows, columns, limit = 8) {
  const source = asArray(rows).slice(0, limit);
  const usableWidth = doc.page.width - 92;
  const startX = 46;

  if (!source.length) {
    paragraph(doc, localeText(data.locale, 'empty'), { color: '#64748B' });
    return;
  }

  ensureSpace(doc, data, state, title, 26 + source.length * 50);
  let y = doc.y;
  doc.roundedRect(startX, y, usableWidth, 20, 6).fill('#DBEAFE');
  columns.forEach((column, index) => {
    const x = startX + columns.slice(0, index).reduce((sum, item) => sum + item.width, 0);
    doc.font('Helvetica-Bold').fontSize(6.7).fillColor('#0F172A')
      .text(column.label, x + 5, y + 6, { width: column.width - 8, height: 9 });
  });
  y += 22;

  source.forEach((row, rowIndex) => {
    const height = 44;
    if (y + height > doc.page.height - 58) {
      doc.y = y;
      newPage(doc, data, state, title);
      y = doc.y;
    }
    doc.roundedRect(startX, y, usableWidth, height, 5).fillAndStroke(rowIndex % 2 ? '#FFFFFF' : '#F8FAFC', '#E2E8F0');
    columns.forEach((column, index) => {
      const x = startX + columns.slice(0, index).reduce((sum, item) => sum + item.width, 0);
      const value = typeof column.value === 'function' ? column.value(row) : row[column.value];
      doc.font('Helvetica').fontSize(6.8).fillColor(column.color ? column.color(row) : '#334155')
        .text(cleanText(value), x + 5, y + 6, { width: column.width - 8, height: height - 10, lineGap: 1 });
    });
    y += height + 4;
  });

  if (asArray(rows).length > limit) {
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748B')
      .text(`Se muestran ${limit} de ${asArray(rows).length} registros para mantener legibilidad.`, startX, y + 2);
    y += 12;
  }
  doc.y = y + 6;
}

function renderCover(doc, data, state) {
  newPage(doc, data, state, localeText(data.locale, 'executiveCover'), true);
  doc.roundedRect(36, 56, doc.page.width - 72, 150, 18).fillAndStroke('#071B3A', '#071B3A');
  drawImageSafe(doc, data.tcdxLogoPath, 60, 75, { fit: [88, 32] }) ||
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#93C5FD').text('TCDX by Tecdex', 60, 82);
  drawImageSafe(doc, data.tenantLogoPath, doc.page.width - 142, 75, { fit: [82, 32], align: 'right' });
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#FFFFFF').text(localeText(data.locale, 'title'), 60, 112, { width: doc.page.width - 120 });
  doc.font('Helvetica').fontSize(9).fillColor('#CBD5E1').text(localeText(data.locale, 'subtitle'), 60, 146, { width: doc.page.width - 120 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text(`${data.tenantName} · ${data.standard} · ${displayStatus(data.depth)}`, 60, 174, { width: doc.page.width - 120 });

  drawBadge(doc, doc.page.width - 188, 80, data.opinion, severityColor(data.readiness), 128);

  const metaY = 218;
  const metaW = (doc.page.width - 122) / 4;
  compactKpiCard(doc, 46, metaY, metaW, localeText(data.locale, 'standard'), data.standard, '#2563EB');
  compactKpiCard(doc, 56 + metaW, metaY, metaW, localeText(data.locale, 'focus'), data.focus, '#7C3AED');
  compactKpiCard(doc, 66 + metaW * 2, metaY, metaW, localeText(data.locale, 'depth'), data.depth, '#D97706');
  compactKpiCard(doc, 76 + metaW * 3, metaY, metaW, localeText(data.locale, 'emittedAt'), data.emittedAt, '#0F766E');

  const kpiY = metaY + 50;
  compactKpiCard(doc, 46, kpiY, metaW, localeText(data.locale, 'auditScore'), `${data.auditScore}%`, severityColor(data.readiness));
  compactKpiCard(doc, 56 + metaW, kpiY, metaW, localeText(data.locale, 'confidence'), `${data.confidenceScore}%`, data.confidenceScore >= 70 ? '#059669' : '#D97706');
  compactKpiCard(doc, 66 + metaW * 2, kpiY, metaW, localeText(data.locale, 'readiness'), data.readinessLabel, severityColor(data.readiness));
  compactKpiCard(doc, 76 + metaW * 3, kpiY, metaW, localeText(data.locale, 'analyticEngine'), data.governance.ai_engine_used ? 'IA Engine' : 'Deterministico', '#1D4ED8');

  const kpiY2 = kpiY + 50;
  compactKpiCard(doc, 46, kpiY2, metaW, localeText(data.locale, 'controls'), data.coverage.controls_reviewed, '#0F766E');
  compactKpiCard(doc, 56 + metaW, kpiY2, metaW, localeText(data.locale, 'evidences'), data.coverage.evidences_reviewed, '#7C3AED');
  compactKpiCard(doc, 66 + metaW * 2, kpiY2, metaW, localeText(data.locale, 'findings'), data.coverage.findings_reviewed, '#475569');
  compactKpiCard(doc, 76 + metaW * 3, kpiY2, metaW, localeText(data.locale, 'actions'), data.coverage.actions_reviewed, '#475569');

  const kpiY3 = kpiY2 + 50;
  compactKpiCard(doc, 46, kpiY3, metaW, localeText(data.locale, 'controlsAlert'), data.coverage.controls_with_alert, data.coverage.controls_with_alert ? '#DC2626' : '#059669');
  compactKpiCard(doc, 56 + metaW, kpiY3, metaW, localeText(data.locale, 'evidencesAlert'), data.coverage.evidences_with_alert, data.coverage.evidences_with_alert ? '#DC2626' : '#059669');
  compactKpiCard(doc, 66 + metaW * 2, kpiY3, metaW, localeText(data.locale, 'humanReview'), boolLabel(data.governance.human_review_required), '#D97706');
  compactKpiCard(doc, 76 + metaW * 3, kpiY3, metaW, localeText(data.locale, 'automaticWrite'), boolLabel(data.governance.db_write), '#059669');

  doc.y = kpiY3 + 52;
  const gaugeY = doc.y;
  const gaugeW = (doc.page.width - 112) / 2;
  drawGauge(doc, 46, gaugeY, gaugeW, localeText(data.locale, 'auditScore'), data.auditScore, severityColor(data.readiness));
  drawGauge(doc, 56 + gaugeW, gaugeY, gaugeW, localeText(data.locale, 'confidence'), data.confidenceScore, data.confidenceScore >= 70 ? '#16A34A' : '#F59E0B');
  drawReadinessBar(doc, 46, gaugeY + 78, gaugeW, data.readiness);
  drawSeverityBar(doc, 56 + gaugeW, gaugeY + 78, gaugeW, data.gaps);
  doc.y = gaugeY + 128;

  sectionTitle(doc, 'Resumen ejecutivo');
  paragraph(doc, data.executiveSummary, { size: 9.2 });
  sectionTitle(doc, localeText(data.locale, 'auditorReading'));
  bulletList(doc, data.auditorReading, (item) => cleanText(item), 4);
}

function renderFinalAssessment(doc, data, state) {
  newPage(doc, data, state, 'Brechas, evidencia y plan');

  sectionTitle(doc, localeText(data.locale, 'mainGaps'));
  table(doc, data, state, 'Brechas, evidencia y plan', data.gaps, [
    { label: 'Severidad', width: 64, value: (row) => displayStatus(row.severity), color: (row) => severityColor(row.severity) },
    { label: 'Brecha', width: 118, value: 'title' },
    { label: 'Control / requisito', width: 88, value: 'requirement' },
    { label: 'Evidencia o causa', width: 116, value: 'cause' },
    { label: 'Riesgo y recomendacion', width: 126, value: (row) => `${displayStatus(row.risk)}. ${row.recommendation}` },
  ], 5);

  sectionTitle(doc, localeText(data.locale, 'requiredEvidence'));
  table(doc, data, state, 'Brechas, evidencia y plan', data.evidences, [
    { label: 'Evidencia solicitada', width: 150, value: 'evidence' },
    { label: 'Control / modulo', width: 88, value: 'control' },
    { label: 'Prioridad', width: 70, value: (row) => displayStatus(row.status), color: (row) => severityColor(row.status) },
    { label: 'Razon auditora', width: 204, value: (row) => `${displayStatus(row.sufficiency)}. ${row.observation}` },
  ], 6);

  sectionTitle(doc, localeText(data.locale, 'suggestedPlan'));
  table(doc, data, state, 'Brechas, evidencia y plan', data.actions, [
    { label: 'Prioridad', width: 62, value: (row) => displayStatus(row.priority), color: (row) => severityColor(row.priority) },
    { label: 'Accion sugerida', width: 170, value: 'action' },
    { label: 'Responsable', width: 92, value: 'owner' },
    { label: 'Plazo', width: 58, value: 'due' },
    { label: 'Evidencia esperada', width: 130, value: 'evidence' },
  ], 6);

  ensureSpace(doc, data, state, 'Brechas, evidencia y plan', 92);
  sectionTitle(doc, 'Conclusion auditora');
  const conclusionY = doc.y;
  doc.roundedRect(46, conclusionY, doc.page.width - 92, 76, 12).fillAndStroke('#FFF7ED', '#FED7AA');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#9A3412')
    .text(`${data.opinion} · ${data.readinessLabel}`, 60, conclusionY + 12, { width: doc.page.width - 120 });
  doc.font('Helvetica').fontSize(8).fillColor('#7C2D12')
    .text(`La decision ejecutiva debe priorizar el cierre de brechas de evidencia, trazabilidad y acciones vencidas antes de declarar preparacion formal. ${data.governance.human_review_required ? 'La revision humana es obligatoria.' : 'Se recomienda revision humana antes de uso formal.'}`, 60, conclusionY + 32, { width: doc.page.width - 120, lineGap: 2 });
  doc.y = conclusionY + 88;

  ensureSpace(doc, data, state, 'Brechas, evidencia y plan', 100);
  sectionTitle(doc, localeText(data.locale, 'technicalTrace'));
  const traceRows = [
    ['ID analisis', data.governance.history_run_id],
    ['Request ID', data.governance.request_id],
    ['Tenant', data.tenantName],
    ['Norma', `${data.standard}${data.version !== '-' ? ` / ${data.version}` : ''}`],
    ['Profundidad', displayStatus(data.depth)],
    ['Modo modelo', data.governance.model_mode],
    ['LLM usado', data.governance.llm_used],
    ['RAG / Web / Drive', `${data.governance.rag_used} / ${data.governance.web_used} / ${data.governance.drive_used}`],
    ['Duracion', data.governance.duration_ms !== '-' ? `${data.governance.duration_ms} ms` : '-'],
    ['Fuente de datos', 'Sistema TCDX'],
  ];
  const left = 46;
  const width = doc.page.width - 92;
  traceRows.forEach(([label, value], index) => {
    const y = doc.y;
    if (y + 20 > doc.page.height - 58) {
      newPage(doc, data, state, localeText(data.locale, 'technicalTrace'));
    }
    doc.roundedRect(left, doc.y, width, 18, 4).fillAndStroke(index % 2 ? '#FFFFFF' : '#F8FAFC', '#E5E7EB');
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#475569').text(label, left + 8, doc.y + 5, { width: 120 });
    doc.font('Helvetica').fontSize(6.8).fillColor('#111827').text(cleanText(value), left + 134, doc.y + 5, { width: width - 146 });
    doc.y += 20;
  });

  ensureSpace(doc, data, state, 'Declaracion', 44);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#854D0E')
    .text('IA Auditor no aprueba, no cierra, no modifica evidencias ni crea registros criticos sin validacion humana.', 46, doc.y + 6, { width: doc.page.width - 92 });
}

function renderAiAuditorPremiumPdf(doc, { locale = 'es', tenant = {}, analysis = {} } = {}) {
  const data = normalizeData({ locale, tenant, analysis });
  const state = { page: 0 };

  renderCover(doc, data, state);
  renderFinalAssessment(doc, data, state);
  footer(doc, data, state.page);
}

module.exports = {
  renderAiAuditorPremiumPdf,
};
