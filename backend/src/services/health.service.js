'use strict';

const pool = require('../config/db');
const diagnosticService = require('./diagnostic.service');

const WEIGHTS = {
  control_coverage: 35,
  evidence: 20,
  gaps: 15,
  actions: 15,
  risks: 10,
  lifecycle_audit: 5,
};

const CLOSED_ACTIONS = new Set(['cerrado', 'cerrada', 'closed', 'completed', 'completado', 'completada', 'cancelado', 'cancelled']);
const HIGH_RISK = new Set(['alto', 'alta', 'high', 'critico', 'critica', 'critical', 'muy alto', 'muy_alto']);

const schemaCache = new Map();

function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function pct(part, total) {
  if (!total) return 0;
  return clamp((Number(part || 0) / Number(total || 1)) * 100);
}

function statusForScore(score) {
  const value = Number(score || 0);
  if (value >= 85) return { status: 'high', label: 'Salud alta', color: 'green' };
  if (value >= 70) return { status: 'acceptable', label: 'Salud aceptable', color: 'blue' };
  if (value >= 50) return { status: 'medium', label: 'Salud media', color: 'yellow' };
  if (value >= 30) return { status: 'low', label: 'Salud baja', color: 'orange' };
  return { status: 'critical', label: 'Salud crítica', color: 'red' };
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase().trim();
}

function isActionOverdue(action) {
  if (!action?.open || !action.due_date) return false;
  return new Date(action.due_date).getTime() < Date.now();
}

function highRiskCount(control) {
  return (control.risks?.existing || []).filter((risk) => {
    const residual = normalizeStatus(risk.residual_risk_level || risk.inherent_risk_level);
    const status = normalizeStatus(risk.status);
    return HIGH_RISK.has(residual) && !['cerrado', 'closed', 'tratado', 'mitigated', 'completado'].includes(status);
  }).length;
}

async function relationExists(name) {
  if (schemaCache.has(`relation:${name}`)) return schemaCache.get(`relation:${name}`);
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    UNION ALL
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [name]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(`relation:${name}`, exists);
  return exists;
}

async function columnExists(table, column) {
  const key = `column:${table}.${column}`;
  if (schemaCache.has(key)) return schemaCache.get(key);
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [table, column]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(key, exists);
  return exists;
}

async function loadDocumentStats(tenantId) {
  if (!(await relationExists('document_index'))) {
    return {
      total: 0,
      useful: 0,
      excluded: 0,
      processed: 0,
      warning: 'No hay índice documental disponible para madurez documental.',
    };
  }

  const hasStatus = await columnExists('document_index', 'status');
  const hasProcessing = await columnExists('document_index', 'processing_status');
  const hasAnalysis = await columnExists('document_index', 'analysis_status');
  const statusExpr = hasStatus ? 'LOWER(COALESCE(status, \'\'))' : '\'\'';
  const processedExpr = hasProcessing
    ? 'LOWER(COALESCE(processing_status, \'\'))'
    : hasAnalysis
      ? 'LOWER(COALESCE(analysis_status, \'\'))'
      : '\'\'';

  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN ${statusExpr} NOT IN ('deleted', 'ignored', 'missing', 'excluded', 'error') THEN 1 ELSE 0 END)::int AS useful,
      SUM(CASE WHEN ${statusExpr} IN ('ignored', 'excluded') THEN 1 ELSE 0 END)::int AS excluded,
      SUM(CASE WHEN ${processedExpr} IN ('processed', 'completed', 'indexed', 'done', 'ok') THEN 1 ELSE 0 END)::int AS processed
    FROM document_index
    WHERE tenant_id = $1::uuid
    `,
    [tenantId]
  ).catch(() => ({ rows: [] }));

  const row = result.rows[0] || {};
  return {
    total: Number(row.total || 0),
    useful: Number(row.useful || 0),
    excluded: Number(row.excluded || 0),
    processed: Number(row.processed || 0),
    warning: null,
  };
}

function aggregateControls(controls) {
  const applicableControls = controls.filter((control) => control.status !== 'not_applicable');
  const applicable = applicableControls.length;
  const covered = applicableControls.filter((control) => control.status === 'covered').length;
  const partial = applicableControls.filter((control) => control.status === 'partially_covered').length;
  const needsReview = applicableControls.filter((control) => control.status === 'needs_review').length;
  const missing = applicableControls.filter((control) => control.status === 'missing_evidence').length;
  const evidencesExisting = applicableControls.reduce((sum, control) => sum + Number(control.evidence?.active_count || 0), 0);
  const evidencesCandidate = applicableControls.reduce((sum, control) => sum + Number(control.evidence?.candidate_count || 0), 0);
  const openGaps = applicableControls.reduce((sum, control) => sum + Number(control.gaps?.open_count || 0), 0);
  const existingGaps = applicableControls.reduce((sum, control) => sum + Number(control.gaps?.existing_count || 0), 0);
  const openActions = applicableControls.reduce((sum, control) => sum + Number(control.actions?.open_count || 0), 0);
  const overdueActions = applicableControls.reduce(
    (sum, control) => sum + (control.actions?.existing || []).filter(isActionOverdue).length,
    0
  );
  const highRisks = applicableControls.reduce((sum, control) => sum + highRiskCount(control), 0);
  const recommendationsPending = applicableControls.reduce(
    (sum, control) => sum + Number(control.evidence?.recommended?.length || 0) + Number(control.gaps?.suggested_count || 0) + Number(control.actions?.suggested_count || 0),
    0
  );
  const openNonconformities = applicableControls.reduce((sum, control) => sum + (control.gaps?.nonconformities || []).filter((item) => item.open).length, 0);
  const openFindings = applicableControls.reduce((sum, control) => sum + (control.gaps?.findings || []).filter((item) => item.open).length, 0);

  const weightedCoverage = covered + partial * 0.55 + needsReview * 0.35;
  const controlCoverageScore = pct(weightedCoverage, applicable);
  const evidenceScore = applicable
    ? clamp(100 - (missing / applicable) * 75 - Math.max(0, applicable - evidencesExisting - evidencesCandidate * 0.5) * (10 / applicable))
    : 0;
  const gapsScore = applicable ? clamp(100 - (openGaps / applicable) * 45 - (openNonconformities / applicable) * 25) : 0;
  const actionsScore = applicable ? clamp(100 - (overdueActions / applicable) * 55 - (openActions / applicable) * 18) : 0;
  const risksScore = applicable ? clamp(100 - (highRisks / applicable) * 50) : 0;

  return {
    controls_applicable: applicable,
    controls_evaluated: controls.length,
    controls_covered: covered,
    controls_partially_covered: partial,
    controls_needs_review: needsReview,
    controls_without_evidence: missing,
    evidences_existing: evidencesExisting,
    evidences_candidate: evidencesCandidate,
    gaps_open: openGaps,
    gaps_existing: existingGaps,
    open_findings: openFindings,
    open_nonconformities: openNonconformities,
    actions_open: openActions,
    actions_overdue: overdueActions,
    high_risks: highRisks,
    recommendations_pending: recommendationsPending,
    scores: {
      control_coverage: controlCoverageScore,
      evidence: evidenceScore,
      gaps: gapsScore,
      actions: actionsScore,
      risks: risksScore,
    },
  };
}

function lifecycleScore(standard = {}) {
  const status = normalizeStatus(standard.lifecycle_status);
  if (['certified', 'certificado', 'active', 'activo', 'implemented', 'implementado'].includes(status)) return 90;
  if (['in_progress', 'en_progreso', 'in progress', 'implementacion', 'implementación'].includes(status)) return 70;
  if (['draft', 'planned', 'planificado'].includes(status)) return 55;
  return 75;
}

function weightedScore(scores) {
  const value =
    scores.control_coverage * (WEIGHTS.control_coverage / 100) +
    scores.evidence * (WEIGHTS.evidence / 100) +
    scores.gaps * (WEIGHTS.gaps / 100) +
    scores.actions * (WEIGHTS.actions / 100) +
    scores.risks * (WEIGHTS.risks / 100) +
    scores.lifecycle_audit * (WEIGHTS.lifecycle_audit / 100);
  return clamp(value);
}

function dimensions(scores) {
  return {
    control_coverage: { score: clamp(scores.control_coverage), weight: WEIGHTS.control_coverage },
    evidence: { score: clamp(scores.evidence), weight: WEIGHTS.evidence },
    gaps: { score: clamp(scores.gaps), weight: WEIGHTS.gaps },
    actions: { score: clamp(scores.actions), weight: WEIGHTS.actions },
    risks: { score: clamp(scores.risks), weight: WEIGHTS.risks },
    lifecycle_audit: { score: clamp(scores.lifecycle_audit), weight: WEIGHTS.lifecycle_audit },
  };
}

function buildDrivers(metrics) {
  const drivers = [];
  if (metrics.controls_without_evidence > 0) drivers.push(`${metrics.controls_without_evidence} controles sin evidencia`);
  if (metrics.actions_overdue > 0) drivers.push(`${metrics.actions_overdue} acciones vencidas`);
  if (metrics.open_nonconformities > 0) drivers.push(`${metrics.open_nonconformities} no conformidades abiertas`);
  if (metrics.gaps_open > 0) drivers.push(`${metrics.gaps_open} brechas/hallazgos abiertos`);
  if (metrics.high_risks > 0) drivers.push(`${metrics.high_risks} riesgos altos o críticos pendientes`);
  if (metrics.recommendations_pending > 0) drivers.push(`${metrics.recommendations_pending} recomendaciones pendientes de revisión`);
  if (drivers.length === 0 && metrics.controls_applicable > 0) drivers.push('sin factores críticos destacados en el alcance evaluado');
  return drivers.slice(0, 6);
}

function explanation(metrics) {
  const drivers = buildDrivers(metrics).filter((driver) => !driver.startsWith('sin factores'));
  if (drivers.length === 0) {
    return 'La salud se mantiene estable porque no se observan brechas críticas, acciones vencidas ni evidencia faltante relevante en el alcance evaluado.';
  }
  return `La salud bajó principalmente por ${drivers.slice(0, 3).join(', ')}.`;
}

function healthFromControls({ diagnostic, controls, process = null }) {
  const metrics = aggregateControls(controls);
  const scores = {
    ...metrics.scores,
    lifecycle_audit: lifecycleScore(diagnostic.standard),
  };
  const score = weightedScore(scores);
  const status = statusForScore(score);

  return {
    score,
    status: status.status,
    label: status.label,
    color: status.color,
    dimensions: dimensions(scores),
    drivers: buildDrivers(metrics),
    explanation: explanation(metrics),
    metrics,
    process,
  };
}

function processKey(control) {
  if (control.process?.id) return `process:${control.process.id}`;
  if (control.operation?.id) return `operation:${control.operation.id}`;
  return 'general';
}

function processLabel(control) {
  return {
    id: control.process?.id || control.operation?.id || null,
    process_id: control.process?.id || null,
    operation_id: control.operation?.id || null,
    name: control.process?.name || control.operation?.name || 'Sin proceso',
    area: control.process?.area || null,
    criticality: control.process?.criticality || control.priority || null,
  };
}

function groupControlsByProcess(controls) {
  const groups = new Map();
  for (const control of controls) {
    const key = processKey(control);
    if (!groups.has(key)) {
      groups.set(key, { process: processLabel(control), controls: [] });
    }
    groups.get(key).controls.push(control);
  }
  return Array.from(groups.values());
}

async function buildDiagnosticsForStandards({ user, standardId = null, standardCode = null, processId = null, operationId = null } = {}) {
  const standards = standardId || standardCode
    ? [{ standard_id: standardId || standardCode, standard_code: standardCode || null }]
    : await diagnosticService.listActiveStandards({ user });

  const diagnostics = [];
  const warnings = [];

  for (const standard of standards) {
    try {
      diagnostics.push(await diagnosticService.buildDiagnostic({
        user,
        standardId: standard.standard_id || standard.id || standard.standard_code,
        standardCode: standard.standard_code,
        filters: {
          process_id: processId || null,
          operation_id: operationId || null,
        },
      }));
    } catch (error) {
      warnings.push(error.message || 'No fue posible calcular health para una norma activa.');
    }
  }

  return { diagnostics, warnings };
}

function combineStandardHealth(standards) {
  const totalWeight = standards.reduce((sum, item) => sum + Math.max(1, Number(item.controls_evaluated || 0)), 0);
  if (!totalWeight) return 0;
  const weighted = standards.reduce((sum, item) => sum + item.score * Math.max(1, Number(item.controls_evaluated || 0)), 0);
  return clamp(weighted / totalWeight);
}

function standardPayload(diagnostic) {
  const health = healthFromControls({ diagnostic, controls: diagnostic.controls });
  return {
    id: diagnostic.standard.id,
    standard_id: diagnostic.standard.id,
    standard_code: diagnostic.standard.standard_code,
    name: diagnostic.standard.standard_code,
    score: health.score,
    status: health.status,
    label: health.label,
    color: health.color,
    controls_evaluated: health.metrics.controls_evaluated,
    controls_applicable: health.metrics.controls_applicable,
    controls_covered: health.metrics.controls_covered,
    controls_partially_covered: health.metrics.controls_partially_covered,
    controls_without_evidence: health.metrics.controls_without_evidence,
    gaps_open: health.metrics.gaps_open,
    actions_overdue: health.metrics.actions_overdue,
    missing_evidence: health.metrics.controls_without_evidence,
    open_findings: health.metrics.open_findings,
    open_nonconformities: health.metrics.open_nonconformities,
    recommendations_pending: health.metrics.recommendations_pending,
    dimensions: health.dimensions,
    drivers: health.drivers,
    explanation: health.explanation,
  };
}

async function getStandardsHealth({ user, standardId = null, standardCode = null } = {}) {
  const { diagnostics, warnings } = await buildDiagnosticsForStandards({ user, standardId, standardCode });
  const standards = diagnostics.map(standardPayload);
  return {
    standards,
    data_quality_warnings: [
      ...warnings,
      ...(standards.length === 0 ? ['No existen normas activas con controles evaluables.'] : []),
    ],
  };
}

async function getProcessesHealth({ user, standardId = null, standardCode = null, processId = null, operationId = null } = {}) {
  const { diagnostics, warnings } = await buildDiagnosticsForStandards({ user, standardId, standardCode, processId, operationId });
  const processes = [];

  for (const diagnostic of diagnostics) {
    for (const group of groupControlsByProcess(diagnostic.controls)) {
      const health = healthFromControls({ diagnostic, controls: group.controls, process: group.process });
      processes.push({
        id: group.process.id,
        process_id: group.process.process_id,
        operation_id: group.process.operation_id,
        name: group.process.name,
        area: group.process.area,
        criticality: group.process.criticality,
        standard_id: diagnostic.standard.id,
        standard_code: diagnostic.standard.standard_code,
        score: health.score,
        status: health.status,
        label: health.label,
        color: health.color,
        controls_applicable: health.metrics.controls_applicable,
        controls_evaluated: health.metrics.controls_evaluated,
        coverage: health.dimensions.control_coverage.score,
        gaps_open: health.metrics.gaps_open,
        actions_overdue: health.metrics.actions_overdue,
        risks_high: health.metrics.high_risks,
        missing_evidence: health.metrics.controls_without_evidence,
        main_issue: health.drivers[0] || 'sin deterioro principal',
        drivers: health.drivers,
        explanation: health.explanation,
      });
    }
  }

  return {
    processes: processes.sort((a, b) => a.score - b.score),
    data_quality_warnings: [
      ...warnings,
      ...(processes.length === 0 ? ['No existen procesos u operaciones con controles evaluables.'] : []),
    ],
  };
}

async function getSummary({ user, standardId = null, standardCode = null } = {}) {
  const { standards, data_quality_warnings: standardWarnings } = await getStandardsHealth({ user, standardId, standardCode });
  const documentStats = await loadDocumentStats(
    standards[0]?.tenant_id || user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId
  );

  const globalScore = combineStandardHealth(standards);
  const status = statusForScore(globalScore);
  const totals = standards.reduce((acc, item) => {
    acc.controls_evaluated += item.controls_evaluated || 0;
    acc.controls_without_evidence += item.controls_without_evidence || 0;
    acc.gaps_open += item.gaps_open || 0;
    acc.actions_overdue += item.actions_overdue || 0;
    acc.recommendations_pending += item.recommendations_pending || 0;
    return acc;
  }, {
    controls_evaluated: 0,
    controls_without_evidence: 0,
    gaps_open: 0,
    actions_overdue: 0,
    recommendations_pending: 0,
  });
  const combinedDimensions = ['control_coverage', 'evidence', 'gaps', 'actions', 'risks', 'lifecycle_audit'].reduce((acc, key) => {
    const totalWeight = standards.reduce((sum, item) => sum + Math.max(1, item.controls_evaluated || 0), 0);
    const weighted = standards.reduce((sum, item) => sum + (item.dimensions?.[key]?.score || 0) * Math.max(1, item.controls_evaluated || 0), 0);
    acc[key] = { score: totalWeight ? clamp(weighted / totalWeight) : 0, weight: WEIGHTS[key] };
    return acc;
  }, {});

  const drivers = [];
  if (totals.controls_without_evidence > 0) drivers.push(`${totals.controls_without_evidence} controles sin evidencia`);
  if (totals.actions_overdue > 0) drivers.push(`${totals.actions_overdue} acciones vencidas`);
  if (totals.gaps_open > 0) drivers.push(`${totals.gaps_open} brechas/hallazgos abiertos`);
  if (totals.recommendations_pending > 0) drivers.push(`${totals.recommendations_pending} recomendaciones pendientes de revisión`);
  if (documentStats.excluded > 0) drivers.push(`${documentStats.excluded} documentos excluidos no cuentan como cobertura activa`);
  if (drivers.length === 0 && standards.length > 0) drivers.push('sin factores críticos destacados en el alcance evaluado');

  return {
    global_score: globalScore,
    status: status.status,
    label: status.label,
    color: status.color,
    updated_at: new Date().toISOString(),
    drivers: drivers.slice(0, 6),
    explanation: drivers[0]?.startsWith('sin factores')
      ? 'La salud se mantiene estable porque no se observan deterioros principales en el alcance evaluado.'
      : `La salud bajó principalmente por ${drivers.slice(0, 3).join(', ')}.`,
    dimensions: combinedDimensions,
    totals,
    document_maturity: {
      total_documents: documentStats.total,
      useful_documents: documentStats.useful,
      processed_documents: documentStats.processed,
      excluded_documents: documentStats.excluded,
      score: documentStats.total ? pct(documentStats.useful, documentStats.total) : 0,
    },
    data_quality_warnings: [
      ...standardWarnings,
      ...(documentStats.warning ? [documentStats.warning] : []),
    ],
  };
}

async function getDashboard({ user } = {}) {
  const [summary, standardsResult, processesResult] = await Promise.all([
    getSummary({ user }),
    getStandardsHealth({ user }),
    getProcessesHealth({ user }),
  ]);

  return {
    global_score: summary.global_score,
    label: summary.label,
    status: summary.status,
    color: summary.color,
    explanation: summary.explanation,
    standards: standardsResult.standards.slice(0, 5).map((item) => ({
      id: item.id,
      name: item.name,
      score: item.score,
      status: item.status,
      label: item.label,
    })),
    critical_processes: processesResult.processes.slice(0, 3).map((item) => ({
      id: item.id,
      process_id: item.process_id,
      operation_id: item.operation_id,
      name: item.name,
      standard_code: item.standard_code,
      score: item.score,
      status: item.status,
      main_issue: item.main_issue,
    })),
    alerts: {
      critical_gaps: summary.totals.gaps_open,
      overdue_actions: summary.totals.actions_overdue,
      missing_evidence: summary.totals.controls_without_evidence,
    },
    data_quality_warnings: [
      ...summary.data_quality_warnings,
      ...processesResult.data_quality_warnings,
    ].slice(0, 6),
  };
}

async function getKpis({ user } = {}) {
  const [summary, standardsResult, processesResult] = await Promise.all([
    getSummary({ user }),
    getStandardsHealth({ user }),
    getProcessesHealth({ user }),
  ]);
  const weakestStandard = [...standardsResult.standards].sort((a, b) => a.score - b.score)[0];
  const weakestProcess = processesResult.processes[0];
  const doc = summary.document_maturity;

  const items = [
    { code: 'HLT-01', name: 'Salud global ISO', value: summary.global_score, unit: '%', status: summary.status, description: 'Puntaje global reproducible del sistema de gestión.' },
    { code: 'HLT-02', name: 'Salud por norma', value: weakestStandard?.score || 0, unit: '%', status: weakestStandard?.status || 'critical', description: `Norma más débil: ${weakestStandard?.name || 'sin datos'}.` },
    { code: 'HLT-03', name: 'Salud por proceso', value: weakestProcess?.score || 0, unit: '%', status: weakestProcess?.status || 'critical', description: `Proceso más crítico: ${weakestProcess?.name || 'sin datos'}.` },
    { code: 'KPI-01', name: 'Cobertura de controles', value: summary.dimensions.control_coverage.score, unit: '%', status: statusForScore(summary.dimensions.control_coverage.score).status, description: 'Porcentaje ponderado de controles con evidencia suficiente o parcial.' },
    { code: 'KPI-02', name: 'Evidencias faltantes', value: summary.totals.controls_without_evidence, unit: 'controles', status: summary.totals.controls_without_evidence > 0 ? 'medium' : 'high', description: 'Controles aplicables sin evidencia activa suficiente.' },
    { code: 'KPI-03', name: 'Brechas abiertas', value: summary.totals.gaps_open, unit: 'brechas', status: summary.totals.gaps_open > 0 ? 'medium' : 'high', description: 'Brechas, hallazgos o no conformidades abiertos.' },
    { code: 'KPI-04', name: 'Acciones vencidas', value: summary.totals.actions_overdue, unit: 'acciones', status: summary.totals.actions_overdue > 0 ? 'low' : 'high', description: 'Planes vencidos o sin cierre.' },
    { code: 'KPI-05', name: 'Riesgo residual alto', value: Math.round(100 - summary.dimensions.risks.score), unit: 'impacto', status: statusForScore(summary.dimensions.risks.score).status, description: 'Impacto de riesgos altos/críticos pendientes en controles evaluados.' },
    { code: 'KPI-06', name: 'Evidencias excluidas', value: doc.excluded_documents, unit: 'documentos', status: doc.excluded_documents > 0 ? 'medium' : 'high', description: 'Documentos excluidos que no cuentan como cobertura activa.' },
    { code: 'KPI-07', name: 'Diagnósticos pendientes', value: summary.totals.recommendations_pending, unit: 'sugerencias', status: summary.totals.recommendations_pending > 0 ? 'medium' : 'high', description: 'Recomendaciones determinísticas/IA pendientes de revisión humana.' },
    { code: 'KPI-08', name: 'No conformidades abiertas', value: standardsResult.standards.reduce((sum, item) => sum + Number(item.open_nonconformities || 0), 0), unit: 'NC', status: summary.totals.gaps_open > 0 ? 'medium' : 'high', description: 'No conformidades abiertas asociadas a controles evaluados.' },
    { code: 'KPI-09', name: 'Madurez documental', value: doc.score, unit: '%', status: statusForScore(doc.score).status, description: 'Documentos útiles/procesados frente al total indexado.' },
    { code: 'KPI-10', name: 'Avance ciclo ISO', value: summary.dimensions.lifecycle_audit.score, unit: '%', status: statusForScore(summary.dimensions.lifecycle_audit.score).status, description: 'Señal base del estado de ciclo/auditoría disponible por norma.' },
  ];

  return items;
}

async function getProcessDetail({ user, standardId, standardCode, processId, operationId } = {}) {
  const { diagnostics, warnings } = await buildDiagnosticsForStandards({ user, standardId, standardCode, processId, operationId });
  const diagnostic = diagnostics[0];
  if (!diagnostic) {
    return {
      standard: null,
      process: null,
      health: null,
      controls: [],
      data_quality_warnings: warnings.length ? warnings : ['No hay diagnóstico disponible para el filtro solicitado.'],
    };
  }
  const health = healthFromControls({ diagnostic, controls: diagnostic.controls });
  return {
    standard: diagnostic.standard,
    process: diagnostic.controls[0] ? processLabel(diagnostic.controls[0]) : null,
    health: {
      score: health.score,
      status: health.status,
      label: health.label,
      dimensions: health.dimensions,
      drivers: health.drivers,
      explanation: health.explanation,
      metrics: health.metrics,
    },
    controls: diagnostic.controls.map((control) => ({
      control_id: control.tenant_control_id,
      catalog_control_id: control.catalog_control_id,
      code: control.clause || control.category,
      name: control.category || control.description,
      status: control.status,
      evidence: control.evidence,
      gaps: control.gaps,
      actions: control.actions,
      traceability: control.traceability,
    })),
    data_quality_warnings: warnings,
  };
}

module.exports = {
  getSummary,
  getDashboard,
  getStandardsHealth,
  getProcessesHealth,
  getProcessDetail,
  getKpis,
  statusForScore,
  WEIGHTS,
};
