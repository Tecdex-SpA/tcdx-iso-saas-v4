'use strict';

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
    readiness: en ? 'Readiness level' : 'Readiness level',
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
  const controls = nestedArray(
    full.reviewed_controls,
    analysis?.reviewed_controls,
    full.control_recommendations,
    analysis?.control_recommendations,
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
  const evidences = nestedArray(
    full.reviewed_evidences,
    analysis?.reviewed_evidences,
    full.evidence_requests,
    analysis?.evidence_requests,
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
  return nestedArray(
    full.gaps,
    analysis?.gaps,
    full.summary?.main_gaps,
    analysis?.summary?.main_gaps,
    full.evidence_gaps
  ).slice(0, 24).map((item, index) => ({
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
  return nestedArray(
    full.suggested_findings,
    analysis?.suggested_findings,
    full.findings_suggestions,
    analysis?.findings_suggestions,
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
  return nestedArray(
    full.suggested_actions,
    analysis?.suggested_actions,
    full.action_plan_suggestions,
    analysis?.action_plan_suggestions,
    analysis?.suggestions_json?.action_plan_suggestions,
    full.next_steps,
    analysis?.next_steps
  ).slice(0, 24).map((item, index) => {
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
  const summary = asObject(full.summary || analysis?.summary || analysis?.summary_json);
  const coverage = asObject(full.coverage || analysis?.coverage || analysis?.coverage_json);
  const trace = asObject(full.traceability || full.trace || analysis?.trace || analysis?.trace_json);
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
    standard: cleanText(full.standard_code || scope.standard_code || analysis?.standard_code || (Array.isArray(scope.standards) ? scope.standards.join(', ') : ''), 'Multinorma'),
    version: cleanText(full.version_code || scope.version_code || analysis?.version_code, ''),
    emittedAt: formatDate(),
    focus: cleanText(full.audit_focus || scope.audit_focus || trace.audit_focus || analysis?.audit_focus, 'readiness'),
    depth: cleanText(full.depth || scope.depth || trace.depth || analysis?.depth, 'deep'),
    auditScore,
    confidenceScore,
    readiness,
    opinion: cleanText(full.audit_opinion || summary.auditor_opinion, opinionFor(readiness)),
    executiveSummary: cleanText(full.executive_summary || summary.executive_summary || summary.executive_message, 'El analisis consolida senales de controles, evidencias, brechas y acciones. Requiere revision humana antes de decisiones formales.'),
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
      history_run_id: cleanText(trace.history_run_id || full.history_run_id || analysis?.history_run_id, '-'),
      user: cleanText(trace.user || full.user || analysis?.requested_by || analysis?.generated_by, '-'),
      timestamp: cleanText(trace.generated_at || full.generated_at || analysis?.created_at, formatDate()),
      source: cleanText(trace.source || full.source, 'ai-auditor'),
      provider: cleanText(trace.provider || full.provider, '-'),
      model: cleanText(trace.model || full.model, '-'),
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
  doc.rect(0, 0, doc.page.width, 28).fill('#0F172A');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#93C5FD').text('TCDX by Tecdex', 46, 10);
  doc.fillColor('#FFFFFF').text(title, doc.page.width - 302, 10, { width: 256, align: 'right' });
  doc.y = 50;
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
  doc.font('Helvetica-Bold').fontSize(16).fillColor(color).text(cleanText(value), x + 10, y + 25, { width: width - 20 });
  doc.font('Helvetica').fontSize(6.8).fillColor('#64748B').text(cleanText(helper, ''), x + 10, y + 45, { width: width - 20 });
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
  doc.roundedRect(36, 44, doc.page.width - 72, 130, 18).fillAndStroke('#0B1120', '#0B1120');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#93C5FD').text('TCDX by Tecdex', 60, 66);
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#FFFFFF').text(localeText(data.locale, 'title'), 60, 88, { width: doc.page.width - 120 });
  doc.font('Helvetica').fontSize(9).fillColor('#CBD5E1').text(localeText(data.locale, 'subtitle'), 60, 122, { width: doc.page.width - 120 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text(data.tenantName, 60, 150, { width: doc.page.width - 120 });

  drawBadge(doc, doc.page.width - 188, 62, data.opinion, severityColor(data.readiness), 128);

  const infoY = 198;
  const w2 = (doc.page.width - 112) / 2;
  kpiCard(doc, 46, infoY, w2, localeText(data.locale, 'standard'), `${data.standard}${data.version !== '-' ? ` / ${data.version}` : ''}`, localeText(data.locale, 'standard'), '#2563EB');
  kpiCard(doc, 56 + w2, infoY, w2, localeText(data.locale, 'emittedAt'), data.emittedAt, 'Trazabilidad temporal', '#0F766E');
  kpiCard(doc, 46, infoY + 70, w2, localeText(data.locale, 'focus'), data.focus, localeText(data.locale, 'focus'), '#7C3AED');
  kpiCard(doc, 56 + w2, infoY + 70, w2, localeText(data.locale, 'depth'), data.depth, localeText(data.locale, 'depth'), '#D97706');

  const kpiY = infoY + 158;
  const smallW = (doc.page.width - 122) / 4;
  kpiCard(doc, 46, kpiY, smallW, localeText(data.locale, 'auditScore'), `${data.auditScore}%`, 'Preparacion/cumplimiento', severityColor(data.readiness));
  kpiCard(doc, 56 + smallW, kpiY, smallW, localeText(data.locale, 'confidence'), `${data.confidenceScore}%`, 'Suficiencia de datos', data.confidenceScore >= 70 ? '#059669' : '#D97706');
  kpiCard(doc, 66 + smallW * 2, kpiY, smallW, localeText(data.locale, 'readiness'), data.readiness, 'Nivel auditor', severityColor(data.readiness));
  kpiCard(doc, 76 + smallW * 3, kpiY, smallW, 'AI Engine', data.governance.ai_engine_used, 'Motor analitico', '#1D4ED8');

  const kpiY2 = kpiY + 72;
  kpiCard(doc, 46, kpiY2, smallW, localeText(data.locale, 'controls'), data.coverage.controls_reviewed, 'revisados', '#0F766E');
  kpiCard(doc, 56 + smallW, kpiY2, smallW, localeText(data.locale, 'evidences'), data.coverage.evidences_reviewed, 'revisadas', '#7C3AED');
  kpiCard(doc, 66 + smallW * 2, kpiY2, smallW, localeText(data.locale, 'findings'), data.coverage.findings_reviewed, 'revisados', '#475569');
  kpiCard(doc, 76 + smallW * 3, kpiY2, smallW, localeText(data.locale, 'actions'), data.coverage.actions_reviewed, 'revisadas', '#475569');

  const alertY = kpiY2 + 72;
  kpiCard(doc, 46, alertY, smallW, localeText(data.locale, 'controlsAlert'), data.coverage.controls_with_alert, 'senales de atencion', data.coverage.controls_with_alert ? '#DC2626' : '#059669');
  kpiCard(doc, 56 + smallW, alertY, smallW, localeText(data.locale, 'evidencesAlert'), data.coverage.evidences_with_alert, 'suficiencia/vigencia', data.coverage.evidences_with_alert ? '#DC2626' : '#059669');
  kpiCard(doc, 66 + smallW * 2, alertY, smallW, 'human_review', data.governance.human_review_required, 'obligatoria', '#D97706');
  kpiCard(doc, 76 + smallW * 3, alertY, smallW, 'db_write', data.governance.db_write, 'sin escritura automatica', '#059669');

  doc.y = alertY + 82;
  sectionTitle(doc, 'Resumen ejecutivo');
  paragraph(doc, data.executiveSummary, { size: 9.2 });
}

function renderScope(doc, data, state) {
  newPage(doc, data, state, localeText(data.locale, 'scopeMethodology'));
  sectionTitle(doc, localeText(data.locale, 'objective'));
  paragraph(doc, 'Entregar una lectura auditora preliminar, formal y no destructiva sobre preparacion, brechas y prioridades, para uso de cliente, gerencia, auditor interno y equipo tecnico.');
  sectionTitle(doc, localeText(data.locale, 'scope'));
  bulletList(doc, [
    `Cliente/tenant: ${data.tenantName}`,
    `Norma/version: ${data.standard}${data.version !== '-' ? ` / ${data.version}` : ''}`,
    `Foco auditor: ${data.focus}`,
    `Profundidad: ${data.depth}`,
  ]);
  sectionTitle(doc, localeText(data.locale, 'dataSources'));
  bulletList(doc, [
    `${data.coverage.controls_reviewed} controles revisados o considerados.`,
    `${data.coverage.evidences_reviewed} evidencias revisadas o requeridas.`,
    `${data.coverage.findings_reviewed} hallazgos revisados/sugeridos.`,
    `${data.coverage.actions_reviewed} acciones revisadas/sugeridas.`,
    `ai_engine_used: ${cleanText(data.governance.ai_engine_used)}.`,
  ]);
  sectionTitle(doc, localeText(data.locale, 'criteria'));
  bulletList(doc, [
    'Estado de controles, salud operativa, evidencia objetiva y trazabilidad.',
    'Brechas declaradas, suficiencia de evidencia y riesgos asociados.',
    'Acciones abiertas, planes sugeridos y necesidad de revision humana.',
    'No se reproduce texto oficial extenso de normas ISO; se usan criterios operativos propios.',
  ]);
  sectionTitle(doc, localeText(data.locale, 'methodology'));
  paragraph(doc, 'IA Auditor contrasta senales internas, resume la muestra, calcula score auditor y confidence score por separado, identifica brechas, sugiere hallazgos y propone acciones sin crear registros ni modificar datos.');
  sectionTitle(doc, localeText(data.locale, 'limitations'));
  bulletList(doc, [
    'La conclusion depende de la completitud, vigencia y calidad de los datos disponibles.',
    'Confidence bajo limita cualquier resultado positivo, aunque el audit_score sea alto.',
    'Evidencias pendientes, controles con alerta o brechas criticas impiden mostrar cumplimiento pleno.',
  ]);
  sectionTitle(doc, localeText(data.locale, 'humanReview'));
  paragraph(doc, 'Todo resultado requiere revision humana. IA Auditor no certifica, no aprueba controles, no cierra acciones, no modifica evidencias y no crea registros criticos automaticamente.');
}

function renderSample(doc, data, state) {
  newPage(doc, data, state, localeText(data.locale, 'auditedSample'));
  sectionTitle(doc, localeText(data.locale, 'reviewedControls'));
  table(doc, data, state, localeText(data.locale, 'auditedSample'), data.controls, [
    { label: 'Clausula / criterio', width: 78, value: 'clause' },
    { label: 'Control', width: 122, value: 'control' },
    { label: 'Estado / score', width: 78, value: (row) => `${row.status}${row.score !== null && row.score !== undefined ? ` · ${row.score}` : ''}` },
    { label: 'Evidencia', width: 76, value: 'evidence' },
    { label: 'Evaluacion IA / accion sugerida', width: 158, value: (row) => `${row.observation} ${row.action}` },
  ], 8);
  sectionTitle(doc, localeText(data.locale, 'reviewedEvidences'));
  table(doc, data, state, localeText(data.locale, 'auditedSample'), data.evidences, [
    { label: 'Evidencia', width: 142, value: 'evidence' },
    { label: 'Control', width: 78, value: 'control' },
    { label: 'Estado', width: 70, value: 'status' },
    { label: 'Vigencia / suficiencia', width: 112, value: 'sufficiency' },
    { label: 'Observacion IA', width: 110, value: 'observation' },
  ], 7);
}

function renderGaps(doc, data, state) {
  newPage(doc, data, state, localeText(data.locale, 'gapsFindings'));
  sectionTitle(doc, localeText(data.locale, 'mainGaps'));
  table(doc, data, state, localeText(data.locale, 'gapsFindings'), data.gaps, [
    { label: 'Severidad', width: 68, value: 'severity', color: (row) => severityColor(row.severity) },
    { label: 'Brecha', width: 126, value: 'title' },
    { label: 'Requisito/control', width: 96, value: 'requirement' },
    { label: 'Evidencia/causa', width: 112, value: 'cause' },
    { label: 'Riesgo / recomendacion', width: 110, value: (row) => `${row.risk}. ${row.recommendation}` },
  ], 8);
  sectionTitle(doc, localeText(data.locale, 'suggestedFindings'));
  table(doc, data, state, localeText(data.locale, 'gapsFindings'), data.findings, [
    { label: 'Tipo sugerido', width: 94, value: 'type' },
    { label: 'Severidad', width: 68, value: 'severity', color: (row) => severityColor(row.severity) },
    { label: 'Requisito', width: 82, value: 'requirement' },
    { label: 'Descripcion', width: 148, value: 'description' },
    { label: 'Recomendacion', width: 120, value: 'recommendation' },
  ], 7);
}

function renderConclusion(doc, data, state) {
  newPage(doc, data, state, localeText(data.locale, 'conclusionTrace'));
  sectionTitle(doc, 'Conclusion auditora');
  paragraph(doc, `${data.opinion}. Audit score ${data.auditScore}%, confidence score ${data.confidenceScore}%, readiness ${data.readiness}. ${data.executiveSummary}`, { size: 9.2 });
  sectionTitle(doc, localeText(data.locale, 'suggestedPlan'));
  table(doc, data, state, localeText(data.locale, 'conclusionTrace'), data.actions, [
    { label: 'Prioridad', width: 68, value: 'priority', color: (row) => severityColor(row.priority) },
    { label: 'Accion', width: 158, value: 'action' },
    { label: 'Responsable', width: 92, value: 'owner' },
    { label: 'Plazo', width: 70, value: 'due' },
    { label: 'Evidencia esperada', width: 124, value: 'evidence' },
  ], 8);
  sectionTitle(doc, localeText(data.locale, 'governance'));
  bulletList(doc, [
    `human_review_required: ${cleanText(data.governance.human_review_required)}`,
    `db_write: ${cleanText(data.governance.db_write)}`,
    `critical_record_write: ${cleanText(data.governance.critical_record_write)}`,
    `can_create_records: ${cleanText(data.governance.can_create_records)}`,
    `ai_engine_used: ${cleanText(data.governance.ai_engine_used)}`,
  ]);
  sectionTitle(doc, localeText(data.locale, 'traceability'));
  bulletList(doc, [
    `history_run_id: ${data.governance.history_run_id}`,
    `usuario: ${data.governance.user}`,
    `timestamp: ${data.governance.timestamp}`,
    `source: ${data.governance.source}`,
    `provider/model: ${data.governance.provider} / ${data.governance.model}`,
  ]);
  sectionTitle(doc, 'Declaracion');
  paragraph(doc, 'IA Auditor no aprueba, no cierra, no modifica evidencias ni crea registros criticos sin validacion humana.', { bold: true, color: '#854D0E' });
}

function renderAiAuditorPremiumPdf(doc, { locale = 'es', tenant = {}, analysis = {} } = {}) {
  const data = normalizeData({ locale, tenant, analysis });
  const state = { page: 0 };

  renderCover(doc, data, state);
  renderScope(doc, data, state);
  renderSample(doc, data, state);
  renderGaps(doc, data, state);
  renderConclusion(doc, data, state);
  footer(doc, data, state.page);
}

module.exports = {
  renderAiAuditorPremiumPdf,
};
