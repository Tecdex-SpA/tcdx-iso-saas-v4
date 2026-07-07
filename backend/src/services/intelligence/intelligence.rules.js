function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value) {
  return String(value || '').toLowerCase().trim();
}

function isOpen(value) {
  return !['cerrado', 'cerrada', 'closed', 'completado', 'completada', 'resolved', 'resuelta', 'cancelado', 'cancelada'].includes(lower(value));
}

function isOverdue(row) {
  if (!row?.due_date) return false;
  const due = new Date(row.due_date).getTime();
  return Number.isFinite(due) && due < Date.now() && isOpen(row.status);
}

function isHigh(value) {
  return ['critica', 'crítica', 'critical', 'alta', 'alto', 'high', 'critico', 'crítico'].includes(lower(value));
}

function ageDays(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function entityId(entity) {
  return entity?.id || entity?.item_key || entity?.control_code || entity?.name || entity?.title || null;
}

function knowledgeBasis(entity, fallback = []) {
  const matches = asArray(entity?.knowledge_matches);
  const basis = matches
    .map((match) => match.knowledge_basis || {
      item_key: match.item_key,
      source_record_id: match.source_record_id,
      standard_family: match.standard_family,
      standard_code: match.standard_code,
      clause_or_control: match.clause_or_control,
      domain: match.domain,
      license_class: match.license_class,
    })
    .filter((item) => item && item.item_key);
  return basis.length ? basis.slice(0, 3) : fallback;
}

function actionText(entity, fallback) {
  const kbAction = asArray(entity?.recommended_actions)[0];
  return kbAction?.action_text || kbAction?.recommended_action || fallback;
}

function makeFinding({
  ruleKey,
  category,
  type = 'warning',
  severity = 'media',
  title,
  description,
  impact,
  entity,
  recommendedAction,
  evidenceBasis = [],
  knowledge = null,
}) {
  return {
    id: `finding-${ruleKey}-${String(entityId(entity) || Math.random().toString(36).slice(2, 8)).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    rule_key: ruleKey,
    category,
    type,
    severity,
    title,
    description,
    impact,
    source: 'rule',
    confidence: knowledgeBasis(entity, knowledge ? [knowledge] : []).length ? 'alta' : 'media',
    related_entities: entity ? [{
      type: category,
      id: entityId(entity),
      title: entity.title || entity.name || entity.control_title || entity.description || null,
    }] : [],
    recommended_action: recommendedAction,
    evidence_basis: evidenceBasis,
    knowledge_basis: knowledgeBasis(entity, knowledge ? [knowledge] : []),
  };
}

function runRules(dataset = {}, knowledgeContext = {}, scores = {}) {
  const findings = [];
  const controls = asArray(dataset.priority_controls || dataset.controls);
  const evidences = asArray(dataset.recent_evidences || dataset.evidences);
  const soaItems = asArray(dataset.soa_items);
  const actions = asArray(dataset.recent_action_plans || dataset.action_plans);
  const auditFindings = asArray(dataset.recent_findings || dataset.findings);
  const nonconformities = asArray(dataset.recent_nonconformities || dataset.nonconformities);
  const risks = asArray(dataset.risks);
  const audits = asArray(dataset.audits);
  const aiTraces = asArray(dataset.ai_traces || dataset.ai_feedback);

  controls.forEach((control) => {
    const evidenceCount = Number(control.approved_evidence_count || control.evidence_count || 0);
    const status = lower(control.status || control.declared_status || control.effective_health_status || control.health_status);
    if (status !== 'inactivo' && evidenceCount <= 0) {
      findings.push(makeFinding({
        ruleKey: 'control_active_without_verifiable_evidence',
        category: 'evidence',
        type: 'gap',
        severity: isHigh(control.severity || control.priority || control.effective_health_status) ? 'alta' : 'media',
        title: 'Control activo sin evidencia verificable',
        description: 'El control aparece activo o evaluable, pero no tiene evidencia aprobada o asociada.',
        impact: 'Reduce madurez de evidencia y preparacion auditora.',
        entity: control,
        recommendedAction: actionText(control, 'Asociar evidencia vigente, aprobada y trazable al control.'),
      }));
    }
    if (isHigh(control.severity || control.priority || control.effective_health_status) && !control.owner && !control.owner_id && !control.responsible && !control.responsible_id) {
      findings.push(makeFinding({
        ruleKey: 'critical_control_without_owner',
        category: 'governance',
        type: 'gap',
        severity: 'alta',
        title: 'Control critico sin responsable',
        description: 'Un control de alta criticidad no tiene owner o responsable claro.',
        impact: 'Debilita accountability y seguimiento de acciones.',
        entity: control,
        recommendedAction: actionText(control, 'Asignar owner y responsable operativo del control.'),
      }));
    }
  });

  evidences.forEach((evidence) => {
    if (!evidence.tenant_control_id && !evidence.control_id && !evidence.process_id && !evidence.operation_id) {
      findings.push(makeFinding({
        ruleKey: 'evidence_without_control_or_process',
        category: 'evidence',
        type: 'warning',
        severity: 'media',
        title: 'Evidencia no asociada a control o proceso',
        description: 'La evidencia existe, pero no esta conectada con el sistema operacional auditado.',
        impact: 'Puede no ser aceptable para auditoria o scoring.',
        entity: evidence,
        recommendedAction: actionText(evidence, 'Vincular la evidencia con control, proceso, riesgo o auditoria correspondiente.'),
        evidenceBasis: [entityId(evidence)].filter(Boolean),
      }));
    }
    if (evidence.evidence_strength?.matches_expected_evidence === false) {
      findings.push(makeFinding({
        ruleKey: 'evidence_does_not_match_expected_kb',
        category: 'evidence',
        type: 'warning',
        severity: 'media',
        title: 'Evidencia no coincide con expected_evidence KB',
        description: 'La evidencia asociada no coincide con la expectativa de evidencia derivada de Knowledge Base.',
        impact: 'Reduce fuerza probatoria y confianza del control.',
        entity: evidence,
        recommendedAction: actionText(evidence, 'Revisar el contenido de la evidencia y alinearlo con la expectativa KB aplicable.'),
        evidenceBasis: [entityId(evidence)].filter(Boolean),
      }));
    }
  });

  soaItems.forEach((item) => {
    const applicable = !['no_aplica', 'not_applicable', 'excluido'].includes(lower(item.applicability || item.status));
    if (applicable && Number(item.evidence_count || item.approved_evidence_count || 0) <= 0) {
      findings.push(makeFinding({
        ruleKey: 'soa_applicable_without_evidence',
        category: 'audit',
        type: 'audit_blocker',
        severity: 'alta',
        title: 'SOA aplicable sin evidencia',
        description: 'Un item aplicable de SOA no tiene evidencia suficiente.',
        impact: 'Puede bloquear readiness de auditoria ISO 27001.',
        entity: item,
        recommendedAction: actionText(item, 'Adjuntar evidencia para justificar aplicabilidad y operacion del control SOA.'),
      }));
    }
  });

  actions.forEach((action) => {
    if (isOverdue(action)) {
      findings.push(makeFinding({
        ruleKey: 'action_plan_overdue',
        category: 'action_plan',
        type: 'warning',
        severity: isHigh(action.priority || action.severity) ? 'alta' : 'media',
        title: 'Accion vencida',
        description: 'El plan de accion esta abierto y vencido.',
        impact: 'Incrementa riesgo residual y debilita ejecucion.',
        entity: action,
        recommendedAction: actionText(action, 'Reprogramar, escalar o cerrar con evidencia verificable.'),
      }));
    }
    if (!isOpen(action.status) && Number(action.evidence_count || action.closure_evidence_count || 0) <= 0 && !action.evidence_id) {
      findings.push(makeFinding({
        ruleKey: 'closed_action_without_evidence',
        category: 'action_plan',
        type: 'gap',
        severity: 'media',
        title: 'Accion cerrada sin evidencia',
        description: 'La accion figura cerrada pero no presenta evidencia de cierre.',
        impact: 'El cierre podria no ser defendible en auditoria.',
        entity: action,
        recommendedAction: actionText(action, 'Agregar evidencia de cierre y criterio de aceptacion.'),
      }));
    }
  });

  auditFindings.forEach((finding) => {
    if (isOpen(finding.status) && !finding.action_plan_id && !finding.corrective_action_id) {
      findings.push(makeFinding({
        ruleKey: 'open_finding_without_action_plan',
        category: 'audit',
        type: 'gap',
        severity: isHigh(finding.severity) ? 'alta' : 'media',
        title: 'Hallazgo abierto sin plan de accion',
        description: 'El hallazgo sigue abierto y no tiene plan correctivo trazable.',
        impact: 'Reduce readiness y aumenta probabilidad de repeticion.',
        entity: finding,
        recommendedAction: actionText(finding, 'Crear plan de accion con responsable, fecha y evidencia esperada.'),
      }));
    }
  });

  nonconformities.forEach((nc) => {
    const days = ageDays(nc.detected_at || nc.created_at || nc.opened_at);
    if (isOpen(nc.status) && days !== null && days > 90) {
      findings.push(makeFinding({
        ruleKey: 'old_nonconformity',
        category: 'audit',
        type: 'audit_blocker',
        severity: isHigh(nc.severity) ? 'critica' : 'alta',
        title: 'No conformidad antigua abierta',
        description: 'La no conformidad permanece abierta por mas de 90 dias.',
        impact: 'Puede transformarse en bloqueo de auditoria o escalamiento.',
        entity: nc,
        recommendedAction: actionText(nc, 'Priorizar cierre de causa raiz, accion correctiva y evidencia de eficacia.'),
      }));
    }
  });

  risks.forEach((risk) => {
    if (isHigh(risk.severity || risk.level || risk.risk_level || risk.residual_risk_level) && !risk.treatment_plan_id && !risk.action_plan_id && !risk.mitigation_plan) {
      findings.push(makeFinding({
        ruleKey: 'high_risk_without_treatment',
        category: 'risk',
        type: 'risk',
        severity: 'critica',
        title: 'Riesgo alto o critico sin tratamiento',
        description: 'El riesgo tiene criticidad alta/critica y no registra tratamiento.',
        impact: 'Aumenta exposicion y presion sobre controles y auditoria.',
        entity: risk,
        recommendedAction: actionText(risk, 'Definir tratamiento, owner, plazo y evidencia esperada.'),
      }));
    }
    if (!risk.owner && !risk.owner_id && !risk.responsible && !risk.responsible_id) {
      findings.push(makeFinding({
        ruleKey: 'risk_without_owner',
        category: 'risk',
        type: 'gap',
        severity: isHigh(risk.severity || risk.level || risk.risk_level) ? 'alta' : 'media',
        title: 'Riesgo sin owner',
        description: 'El riesgo no tiene responsable asignado.',
        impact: 'Dificulta seguimiento, tratamiento y accountability.',
        entity: risk,
        recommendedAction: actionText(risk, 'Asignar owner y responsable del tratamiento.'),
      }));
    }
  });

  audits.forEach((audit) => {
    const days = audit.scheduled_at || audit.start_date ? ageDays(audit.scheduled_at || audit.start_date) : null;
    const upcoming = days !== null && days <= 30 && new Date(audit.scheduled_at || audit.start_date).getTime() >= Date.now();
    if (upcoming && Number(scores.audit_readiness || 0) < 60) {
      findings.push(makeFinding({
        ruleKey: 'upcoming_audit_low_readiness',
        category: 'audit',
        type: 'audit_blocker',
        severity: 'alta',
        title: 'Auditoria proxima con readiness bajo',
        description: 'Existe auditoria proxima y readiness inferior al umbral esperado.',
        impact: 'Aumenta probabilidad de hallazgos y no conformidades.',
        entity: audit,
        recommendedAction: actionText(audit, 'Ejecutar plan intensivo de evidencias, acciones vencidas y hallazgos abiertos.'),
      }));
    }
  });

  if (Number(scores.audit_readiness || 0) >= 80 && Number(scores.data_quality || 0) < 50) {
    findings.push(makeFinding({
      ruleKey: 'score_high_data_quality_low',
      category: 'data_quality',
      type: 'warning',
      severity: 'media',
      title: 'Score alto con data quality bajo',
      description: 'El score calculado es alto, pero la calidad/cobertura de datos no lo sostiene plenamente.',
      impact: 'La conclusion debe presentarse con confidence reducida.',
      entity: null,
      recommendedAction: 'Completar fuentes operacionales antes de comunicar score como conclusion robusta.',
      knowledge: asArray(knowledgeContext.knowledge_items_used)[0] || null,
    }));
  }

  asArray(dataset.tenant_standards).forEach((standard) => {
    const standardCode = standard.standard_code || standard.code || standard;
    const hasCoverage = asArray(knowledgeContext.standards_covered).some((covered) => lower(covered).includes(lower(standardCode).split(':')[0]));
    if (!hasCoverage && Number(knowledgeContext.total_available_items || 0) > 0) {
      findings.push(makeFinding({
        ruleKey: 'active_standard_without_kb',
        category: 'data_quality',
        type: 'warning',
        severity: 'media',
        title: 'Estandar activo sin Knowledge Base aplicable',
        description: 'El tenant tiene un estandar activo sin cobertura KB detectada.',
        impact: 'Las reglas y explicaciones deben reducir confidence.',
        entity: typeof standard === 'object' ? standard : { id: standardCode, title: standardCode },
        recommendedAction: 'Mapear el estandar activo contra Knowledge Base antes de emitir conclusiones fuertes.',
      }));
    }
  });

  aiTraces.forEach((trace) => {
    if (!trace.knowledge_basis && !asArray(trace.knowledge_basis).length) {
      findings.push(makeFinding({
        ruleKey: 'ai_response_without_knowledge_basis',
        category: 'ai_governance',
        type: 'warning',
        severity: 'media',
        title: 'Respuesta IA sin knowledge_basis',
        description: 'Una respuesta IA no declara fundamento KB.',
        impact: 'Debe degradarse confidence y requerir revision humana.',
        entity: trace,
        recommendedAction: 'Reprocesar respuesta IA con contexto KB filtrado o marcar limitacion.',
        knowledge: asArray(knowledgeContext.knowledge_items_used)[0] || null,
      }));
    }
  });

  return findings;
}

module.exports = {
  runRules,
};
