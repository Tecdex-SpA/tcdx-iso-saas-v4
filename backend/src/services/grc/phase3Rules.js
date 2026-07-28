const TRANSITIONS = Object.freeze({
  organization: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'suspended', 'retired'],
    review_required: ['under_review', 'suspended', 'retired'],
    suspended: ['active', 'retired'],
    retired: [],
  },
  process: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'suspended', 'retired'],
    review_required: ['under_review', 'suspended', 'retired'],
    suspended: ['active', 'retired'],
    retired: [],
  },
  service: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'suspended', 'retired'],
    review_required: ['under_review', 'suspended', 'retired'],
    suspended: ['active', 'retired'],
    retired: [],
  },
  bia: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['current', 'review_required'],
    current: ['review_required', 'expired', 'superseded'],
    review_required: ['under_review', 'expired', 'superseded'],
    expired: ['superseded'],
    superseded: [],
  },
  continuity_plan: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['activated', 'review_required', 'expired', 'superseded'],
    activated: ['recovery_in_progress'],
    recovery_in_progress: ['return_to_normal'],
    return_to_normal: ['closed'],
    closed: ['review_required', 'superseded'],
    review_required: ['under_review', 'expired', 'superseded'],
    expired: ['superseded'],
    superseded: [],
  },
  continuity_test: {
    planned: ['ready', 'cancelled'],
    ready: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'passed', 'passed_with_observations', 'failed'],
    completed: ['passed', 'passed_with_observations', 'failed'],
    passed: [],
    passed_with_observations: [],
    failed: [],
    cancelled: [],
  },
  crisis: {
    active: ['stabilized', 'recovery', 'closed'],
    stabilized: ['recovery', 'closed'],
    recovery: ['closed'],
    closed: [],
  },
  metric: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'retired'],
    review_required: ['under_review', 'retired'],
    retired: [],
  },
  quantitative_risk: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['current', 'review_required'],
    current: ['review_required', 'superseded'],
    review_required: ['under_review', 'superseded'],
    superseded: [],
  },
});

function assertTransition(entityType, fromStatus, toStatus) {
  const allowed = TRANSITIONS[entityType]?.[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    const error = new Error(`Transición no permitida: ${fromStatus} -> ${toStatus}.`);
    error.code = 'PHASE3_INVALID_TRANSITION';
    error.status = 409;
    throw error;
  }
}

function readiness(reasonCode, dimension, delta, explanation, severity = 'high') {
  return {
    kind: 'readiness',
    reasonCode,
    dimension,
    delta,
    explanation,
    severity,
  };
}

function alert(code, severity, title, description, metadata = {}) {
  return { kind: 'alert', code, severity, title, description, metadata };
}

function metric(code, metricType, numericValue, unit = 'count') {
  return { kind: 'metric', code, metricType, numericValue, unit };
}

function recommendation(origin, options) {
  return {
    kind: 'recommendation',
    origin,
    allowedActions: options,
    explanation: 'La decisión requiere revisión humana y conserva trazabilidad GRC.',
  };
}

function evaluatePhase3Rules(eventName, payload = {}, now = new Date()) {
  const effects = [];
  const expired = value => value && new Date(value).getTime() < now.getTime();

  if (
    ['process.created', 'process.criticality.changed'].includes(eventName)
    && payload.is_critical
    && !payload.has_current_bia
  ) {
    effects.push(
      alert(
        'CRITICAL_PROCESS_WITHOUT_BIA',
        'critical',
        'Proceso crítico sin BIA vigente',
        'El proceso requiere un BIA aprobado y vigente para sustentar continuidad y cumplimiento.'
      ),
      readiness(
        'critical_process_without_bia',
        'continuity',
        -15,
        'Un proceso crítico no dispone de BIA aprobado y vigente.',
        'critical'
      ),
      metric('critical_process_without_bia', 'kri', 1),
      recommendation('critical_process_without_bia', ['finding', 'nonconformity', 'action'])
    );
  }

  if (
    eventName === 'service.criticality.changed'
    && payload.criticality === 'critical'
    && (payload.rto_minutes === null || payload.rpo_minutes === null)
  ) {
    effects.push(
      alert(
        'CRITICAL_SERVICE_WITHOUT_RECOVERY_TARGETS', 'high',
        'Servicio crítico sin objetivos de recuperación',
        'El servicio requiere RTO y RPO para sustentar continuidad operacional.'
      ),
      readiness('critical_service_without_targets', 'continuity', -8, 'El servicio crítico no tiene RTO/RPO completos.')
    );

  }
  if (eventName === 'bia.approved') {
    effects.push(
      readiness('bia_current', 'continuity', 10, 'El BIA aprobado mejora la cobertura de continuidad.'),
      metric('critical_process_with_current_bia', 'kpi', 1)
    );
  }

  if (eventName === 'bia.expired' || (eventName === 'bia.review.required' && expired(payload.next_review_at))) {
    effects.push(
      alert('BIA_EXPIRED', 'high', 'BIA vencido', 'El análisis de impacto requiere revisión y aprobación.'),
      readiness('bia_expired', 'continuity', -12, 'El BIA dejó de aportar a readiness por vencimiento.'),
      metric('bia_expired', 'kri', 1),
      recommendation('bia_expired', ['finding', 'action'])
    );
  }

  if (eventName === 'continuity.plan.expired') {
    effects.push(
      alert('CONTINUITY_PLAN_EXPIRED', 'high', 'Plan de continuidad vencido', 'El plan requiere revisión antes de considerarse operativo.'),
      readiness('plan_expired', 'continuity', -12, 'El plan vencido reduce cobertura y assurance.'),
      metric('continuity_plan_expired', 'kri', 1),
      recommendation('plan_expired', ['finding', 'nonconformity', 'action'])
    );
    if (payload.tenant_control_id) {
      effects.push({
        kind: 'assurance',
        status: 'degraded',
        score: 45,
        reason: 'continuity_plan_expired',
      });
    }
  }

  if (eventName === 'continuity.test.failed') {
    const rtoBreached = Number(payload.observed_rto_minutes) > Number(payload.target_rto_minutes);
    const rpoBreached = Number(payload.observed_rpo_minutes) > Number(payload.target_rpo_minutes);
    effects.push(
      alert('CONTINUITY_TEST_FAILED', 'critical', 'Prueba de continuidad fallida', 'El resultado exige análisis, acción y verificación de efectividad.'),
      readiness('test_failed', 'continuity', -18, 'La prueba fallida demuestra una brecha operativa material.', 'critical'),
      metric('continuity_test_failed', 'kri', 1),
      recommendation('test_failed', ['finding', 'nonconformity', 'action', 'effectiveness_verification'])
    );
    if (rtoBreached) {
      effects.push(
        alert('RTO_BREACHED', 'critical', 'RTO incumplido', 'El tiempo observado excede el objetivo de recuperación.'),
        readiness('rto_breached', 'risks', -10, 'El incumplimiento de RTO eleva exposición y exige reevaluación.', 'critical'),
        metric('rto_breached', 'kri', 1)
      );
    }
    if (rpoBreached) {
      effects.push(
        alert('RPO_BREACHED', 'critical', 'RPO incumplido', 'La pérdida de datos observada excede el objetivo definido.'),
        readiness('rpo_breached', 'evidence', -8, 'El incumplimiento de RPO reduce la preparación verificable.', 'critical'),
        metric('rpo_breached', 'kri', 1)
      );
    }
  }

  if (eventName === 'metric.threshold.warning') {
    effects.push(
      alert('METRIC_THRESHOLD_WARNING', 'medium', 'Indicador en advertencia', 'La medición requiere seguimiento del responsable.'),
      metric('metric_warning', payload.metric_type || 'kri', 1)
    );
  }

  if (eventName === 'metric.threshold.critical') {
    effects.push(
      alert('METRIC_THRESHOLD_CRITICAL', 'critical', 'Indicador en umbral crítico', 'La medición exige revisión de riesgo, control y operación relacionada.'),
      readiness('kri_critical', payload.metric_type === 'kpi' ? 'controls' : 'risks', -10, 'Un indicador crítico reduce readiness y exige revisión.', 'critical'),
      metric('metric_critical', payload.metric_type || 'kri', 1),
      recommendation('kri_critical', ['risk_reassessment', 'finding', 'action'])
    );
    if (payload.metric_type === 'kpi' && payload.tenant_control_id) {
      effects.push({
        kind: 'assurance',
        status: 'degraded',
        score: 40,
        reason: 'critical_kpi',
      });
    }
  }

  if (eventName === 'dependency.changed' && payload.target_type === 'supplier' && payload.criticality === 'critical') {
    effects.push(
      alert(
        'CRITICAL_SUPPLIER_DEPENDENCY',
        'high',
        'Dependencia crítica de proveedor',
        'La continuidad del proceso o servicio depende de un tercero crítico.'
      ),
      readiness('critical_supplier_dependency', 'suppliers', -5, 'La dependencia requiere evaluación vigente y alternativa documentada.'),
      metric('critical_supplier_dependency', 'kri', 1)
    );
  }

  if (eventName === 'quantitative_risk.approved') {
    effects.push(
      metric('annualized_loss_exposure', 'kri', Number(payload.annualized_loss || 0), payload.currency || 'CLP'),
      readiness('quantitative_risk_current', 'risks', 3, 'La evaluación cuantitativa aprobada mejora la trazabilidad de exposición.')
    );
  }

  return effects;
}

module.exports = {
  TRANSITIONS,
  assertTransition,
  evaluatePhase3Rules,
};
