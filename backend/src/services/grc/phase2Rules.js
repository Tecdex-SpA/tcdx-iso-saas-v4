const crypto = require('crypto');

const EVENT_NAMES = new Set([
  'privacy.processing.created',
  'privacy.processing.reviewed',
  'privacy.dpia.required',
  'privacy.request.opened',
  'privacy.request.overdue',
  'privacy.breach.opened',
  'privacy.breach.closed',
  'incident.opened',
  'incident.classified',
  'incident.severity.changed',
  'incident.containment.completed',
  'incident.recovery.completed',
  'incident.closed',
  'supplier.created',
  'supplier.criticality.changed',
  'supplier.assessment.started',
  'supplier.assessment.submitted',
  'supplier.assessment.approved',
  'supplier.assessment.expired',
  'supplier.incident.linked',
  'supplier.exit.started',
  'supplier.exit.completed',
  'connector.sync.started',
  'connector.sync.completed',
  'connector.sync.failed',
  'connector.record.normalized',
  'connector.alert.created',
  'control.assurance.changed',
  'evidence.received',
  'evidence.expired',
  'evidence.rejected',
  'risk.reassessment.required',
  'finding.created',
  'nonconformity.created',
  'action.created',
  'action.overdue',
  'action.effectiveness.verified',
  'obligation.due',
]);

const WORKFLOWS = Object.freeze({
  processing: [
    'draft', 'under_review', 'approved', 'active', 'review_required', 'suspended', 'retired',
  ],
  dpia: [
    'draft', 'screening', 'assessment', 'consultation', 'pending_approval',
    'approved', 'rejected', 'review_required', 'closed',
  ],
  privacy_request: [
    'opened', 'identity_verification', 'in_progress', 'extended',
    'pending_approval', 'responded', 'closed', 'rejected',
  ],
  privacy_breach: [
    'opened', 'assessing', 'contained', 'notification_required', 'notified', 'closed',
  ],
  incident: [
    'reported', 'triaged', 'classified', 'active', 'contained',
    'recovering', 'resolved', 'post_incident_review', 'closed',
  ],
  supplier: [
    'draft', 'due_diligence', 'under_assessment', 'remediation_required',
    'pending_approval', 'approved', 'active', 'reassessment_required',
    'suspended', 'exit_in_progress', 'exited',
  ],
  assessment: [
    'draft', 'invited', 'in_progress', 'submitted', 'under_review',
    'remediation_required', 'approved', 'rejected', 'expired',
  ],
});

const ALLOWED_TRANSITIONS = Object.freeze({
  processing: new Set([
    'draft:under_review', 'under_review:approved', 'under_review:draft',
    'approved:active', 'active:review_required', 'review_required:under_review',
    'active:suspended', 'suspended:active', 'active:retired', 'suspended:retired',
  ]),
  dpia: new Set([
    'draft:screening', 'screening:assessment', 'assessment:consultation',
    'assessment:pending_approval', 'consultation:pending_approval',
    'pending_approval:approved', 'pending_approval:rejected',
    'rejected:assessment', 'approved:review_required',
    'review_required:assessment', 'approved:closed',
  ]),
  privacy_request: new Set([
    'opened:identity_verification', 'identity_verification:in_progress',
    'in_progress:extended', 'in_progress:pending_approval',
    'extended:pending_approval', 'pending_approval:responded',
    'pending_approval:rejected', 'responded:closed',
  ]),
  privacy_breach: new Set([
    'opened:assessing', 'assessing:contained', 'assessing:notification_required',
    'contained:notification_required', 'contained:closed',
    'notification_required:notified', 'notified:closed',
  ]),
  incident: new Set([
    'reported:triaged', 'triaged:classified', 'classified:active',
    'active:contained', 'contained:recovering', 'recovering:resolved',
    'resolved:post_incident_review', 'post_incident_review:closed',
  ]),
  supplier: new Set([
    'draft:due_diligence', 'due_diligence:under_assessment',
    'under_assessment:remediation_required', 'under_assessment:pending_approval',
    'remediation_required:under_assessment', 'pending_approval:approved',
    'pending_approval:remediation_required', 'approved:active',
    'active:reassessment_required', 'reassessment_required:under_assessment',
    'active:suspended', 'suspended:active', 'active:exit_in_progress',
    'suspended:exit_in_progress', 'exit_in_progress:exited',
  ]),
  assessment: new Set([
    'draft:invited', 'invited:in_progress', 'in_progress:submitted',
    'submitted:under_review', 'under_review:remediation_required',
    'under_review:approved', 'under_review:rejected',
    'remediation_required:in_progress', 'approved:expired',
  ]),
});

const SEVERITY_WEIGHTS = Object.freeze({
  service_criticality: 20,
  process_criticality: 15,
  asset_criticality: 15,
  supplier_criticality: 10,
  privacy_impact: 15,
  regulatory_impact: 10,
  customer_impact: 5,
  duration_impact: 5,
  financial_impact: 5,
});

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function normalizedImpact(value) {
  const text = String(value || '').toLowerCase();
  if (['critical', 'critico', 'crítica', 'critica'].includes(text)) return 1;
  if (['high', 'alto', 'alta'].includes(text)) return 0.75;
  if (['medium', 'medio', 'media'].includes(text)) return 0.5;
  if (['low', 'bajo', 'baja'].includes(text)) return 0.25;
  if (value === true) return 1;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(1, numeric / 100));
  return 0;
}

function calculateIncidentSeverity(inputs = {}) {
  const normalized = {};
  const contributions = {};
  let score = 0;
  for (const [key, weight] of Object.entries(SEVERITY_WEIGHTS)) {
    normalized[key] = normalizedImpact(inputs[key]);
    contributions[key] = Number((normalized[key] * weight).toFixed(2));
    score += contributions[key];
  }
  score = Number(score.toFixed(2));
  const severity = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return {
    severity,
    score,
    normalized,
    contributions,
    weights: SEVERITY_WEIGHTS,
    formulaVersion: 'incident-severity-v1',
    inputHash: sha256(inputs),
    explanation: `Severidad ${severity} por puntaje ponderado ${score}/100.`,
  };
}

function assertTransition(domain, from, to) {
  if (!WORKFLOWS[domain]) throw Object.assign(new Error('PHASE2_WORKFLOW_UNKNOWN'), { code: 'PHASE2_WORKFLOW_UNKNOWN' });
  if (!WORKFLOWS[domain].includes(from) || !WORKFLOWS[domain].includes(to)) {
    throw Object.assign(new Error('PHASE2_STATE_INVALID'), { code: 'PHASE2_STATE_INVALID' });
  }
  if (!ALLOWED_TRANSITIONS[domain].has(`${from}:${to}`)) {
    throw Object.assign(new Error(`PHASE2_TRANSITION_INVALID:${domain}:${from}:${to}`), { code: 'PHASE2_TRANSITION_INVALID' });
  }
  return true;
}

function scoreSupplierAssessment({ questions = [], answers = [] } = {}) {
  const byQuestion = new Map(answers.map(answer => [String(answer.question_id), answer]));
  let possible = 0;
  let obtained = 0;
  const contributions = [];
  for (const question of questions) {
    const weight = Math.max(0, Number(question.weight) || 0);
    const answer = byQuestion.get(String(question.id));
    possible += weight * 100;
    const rawScore = answer && Number.isFinite(Number(answer.score))
      ? Math.max(0, Math.min(100, Number(answer.score)))
      : 0;
    obtained += weight * rawScore;
    contributions.push({
      question_id: question.id,
      weight,
      score: rawScore,
      contribution: Number((weight * rawScore).toFixed(2)),
      answered: Boolean(answer),
    });
  }
  const score = possible ? Number(((obtained / possible) * 100).toFixed(2)) : 0;
  return {
    score,
    possible,
    obtained: Number(obtained.toFixed(2)),
    contributions,
    formulaVersion: 'supplier-assessment-v1',
    limitations: [
      'El score orienta la revisión y no aprueba al proveedor.',
      'La aprobación exige decisión humana y riesgo residual aceptable.',
    ],
  };
}

function alert(code, severity, title, description, dueAt = null, metadata = {}) {
  return { kind: 'alert', code, severity, title, description, dueAt, metadata };
}

function metric(code, metricType, numericValue, unit, provenance = {}) {
  return { kind: 'metric', code, metricType, numericValue, unit, provenance };
}

function evaluateRules(eventName, payload = {}, now = new Date()) {
  if (!EVENT_NAMES.has(eventName)) {
    throw Object.assign(new Error(`PHASE2_EVENT_UNKNOWN:${eventName}`), { code: 'PHASE2_EVENT_UNKNOWN' });
  }
  const effects = [];

  if (eventName === 'evidence.expired') {
    effects.push(alert('EVIDENCE_EXPIRED_ASSURANCE', 'high', 'Evidencia vencida', 'La evidencia vencida degrada el aseguramiento del control.'));
    effects.push({ kind: 'assurance', status: 'degraded', score: 25, reason: 'evidence_expired' });
  }
  if (eventName === 'evidence.rejected') {
    effects.push(alert('EVIDENCE_REJECTED_CLOSURE_BLOCK', 'high', 'Evidencia rechazada', 'El cierre asociado permanece bloqueado hasta contar con evidencia aceptada.'));
    effects.push({ kind: 'assurance', status: 'ineffective', score: 0, reason: 'evidence_rejected' });
  }
  if (['incident.classified', 'incident.severity.changed'].includes(eventName)
      && ['high', 'critical'].includes(payload.severity)) {
    effects.push(alert('SEVERE_INCIDENT_REASSESSMENT', payload.severity, 'Reevaluación de riesgo requerida', 'La severidad confirmada exige reevaluar riesgos y controles.'));
    effects.push({ kind: 'event', eventName: 'risk.reassessment.required' });
  }
  if (eventName === 'incident.opened' && Number(payload.recurrence_count || 0) > 1) {
    effects.push(metric('incident_recurrence_count', 'kri', Number(payload.recurrence_count), 'incidents', { source: 'incident_recurrence' }));
    effects.push(alert('REPEATED_INCIDENT', 'high', 'Incidente repetido', 'La recurrencia incrementa el KRI y exige análisis causal.'));
  }
  if (['supplier.created', 'supplier.criticality.changed'].includes(eventName)
      && payload.criticality === 'critical' && !payload.current_assessment) {
    effects.push(alert('CRITICAL_SUPPLIER_WITHOUT_ASSESSMENT', 'critical', 'Proveedor crítico sin evaluación vigente', 'La brecha impide considerar el proveedor plenamente aprobado.'));
  }
  if (eventName === 'supplier.incident.linked') {
    effects.push(alert('SUPPLIER_INCIDENT_REASSESSMENT', 'high', 'Reevaluación de proveedor requerida', 'El incidente vinculado invalida la vigencia de la evaluación anterior.'));
  }
  if (eventName === 'supplier.exit.started') {
    effects.push(alert('SUPPLIER_EXIT_EVIDENCE_REQUIRED', 'high', 'Evidencia de salida requerida', 'La salida exige revocación de acceso, devolución y eliminación verificables.'));
  }
  if (eventName === 'privacy.processing.created' && payload.sensitive_data && !payload.dpia_approved) {
    effects.push(alert('SENSITIVE_PROCESSING_WITHOUT_DPIA', 'critical', 'Tratamiento sensible sin DPIA', 'Debe completarse una DPIA antes de activar el tratamiento.'));
    effects.push({ kind: 'event', eventName: 'privacy.dpia.required' });
  }
  if (eventName === 'privacy.processing.created' && !payload.retention_period) {
    effects.push(alert('PROCESSING_RETENTION_MISSING', 'high', 'Retención no definida', 'La actividad de tratamiento requiere plazo y base de retención.'));
  }
  if (eventName === 'privacy.processing.reviewed' && payload.processor_without_current_tprm) {
    effects.push(alert('PROCESSOR_TPRM_GAP', 'high', 'Encargado sin TPRM vigente', 'El encargado debe contar con evaluación de tercero vigente.'));
  }
  if (eventName === 'privacy.breach.opened') {
    effects.push(alert('PRIVACY_BREACH_IMPACT', payload.severity || 'high', 'Brecha de privacidad activa', 'Revisar obligaciones, controles, riesgos y plazos de notificación.', payload.notification_due_at));
  }
  if (eventName === 'action.overdue') {
    effects.push(alert('ACTION_OVERDUE', payload.severity === 'critical' ? 'critical' : 'high', 'Remedial vencido', 'El remedial pendiente mantiene el cierre bloqueado.'));
  }
  if (eventName === 'obligation.due') {
    const dueAt = payload.due_at ? new Date(payload.due_at) : now;
    const hours = Math.max(0, (dueAt.getTime() - now.getTime()) / 3600000);
    effects.push(alert('OBLIGATION_DUE', hours <= 24 ? 'critical' : 'high', 'Obligación próxima a vencer', 'El plazo normativo requiere escalamiento.', payload.due_at));
  }
  if (eventName === 'connector.record.normalized') {
    effects.push(metric('connector_records_normalized', 'operational', 1, 'records', payload.provenance || { source: 'connector' }));
    if (payload.alert) {
      effects.push(alert(payload.alert.code || 'CONNECTOR_ALERT', payload.alert.severity || 'medium', payload.alert.title || 'Alerta de conector', payload.alert.description || 'El registro externo disparó una regla GRC.'));
    }
  }
  if (eventName === 'connector.sync.failed') {
    effects.push(alert('CONNECTOR_SYNC_FAILED', 'high', 'Sincronización fallida', 'El conector requiere retry o intervención según su política.'));
  }
  if (eventName === 'action.effectiveness.verified') {
    effects.push(metric('action_effectiveness', 'assurance', payload.outcome === 'effective' ? 100 : payload.outcome === 'partially_effective' ? 50 : 0, 'percent', { source: 'effectiveness_verification' }));
  }

  return effects.map((effect, index) => ({
    ...effect,
    ruleCode: `phase2.${eventName}.${index + 1}`,
    ruleVersion: 1,
    explanation: effect.description || effect.reason || `Efecto determinista para ${eventName}.`,
  }));
}

module.exports = {
  ALLOWED_TRANSITIONS,
  EVENT_NAMES,
  SEVERITY_WEIGHTS,
  WORKFLOWS,
  assertTransition,
  calculateIncidentSeverity,
  evaluateRules,
  scoreSupplierAssessment,
  sha256,
  stableStringify,
};
