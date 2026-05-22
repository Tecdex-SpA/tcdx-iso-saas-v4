'use strict';

const pool = require('../config/db');
const aiContextBuilder = require('./aiContextBuilder.service');

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function uniq(items = [], limit = 20) {
  const seen = new Set();
  const out = [];
  for (const item of asArray(items).flat()) {
    const text = typeof item === 'string' ? item.trim() : item;
    const key = typeof text === 'string' ? lower(text) : JSON.stringify(text || {});
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function includesAny(value, terms = []) {
  const text = lower(value);
  return terms.some((term) => text.includes(lower(term)));
}

function summarizeControl(row = {}) {
  return {
    control_id: row.tenant_control_id || row.catalog_control_id || row.id || null,
    standard_code: row.iso || row.standard_code || null,
    clause: row.clause || null,
    category: row.category || null,
    description: row.control_description || row.description || row.name || 'Control sin descripción',
    health_status: row.effective_health_status || row.health_status || row.compliance_bucket || null,
    health_score: row.effective_health_score ?? row.health_score ?? null,
    evidence_count: Number(row.evidence_count || row.official_evidence_count || 0),
    open_findings_count: Number(row.open_findings_count || 0),
    open_nonconformities_count: Number(row.open_nonconformities_count || 0),
    overdue_action_plans_count: Number(row.overdue_action_plans_count || 0),
  };
}

function normalizeProfile(profile = {}) {
  const json = safeObject(profile.profile_json);
  return {
    tenant_id: profile.tenant_id || null,
    industry: profile.industry || json.industry || '',
    subindustry: profile.subindustry || json.subindustry || '',
    company_size: profile.company_size || json.company_size || json.employee_count_range || '',
    maturity_level: profile.maturity_level || json.current_maturity_level || json.maturity_level || '',
    risk_appetite: profile.risk_appetite || json.risk_appetite || '',
    active_standards: uniq(json.active_standards || json.target_standards || []),
    critical_processes: uniq(json.critical_processes || []),
    operational_scope: json.audit_scope || json.business_model || '',
    declared_objectives: uniq([
      ...(asArray(json.strategic_objectives)),
      ...(asArray(json.quality_objectives)),
      ...(asArray(json.security_objectives)),
      ...(asArray(json.compliance_objectives)),
    ], 12),
    known_weaknesses: uniq([
      ...(asArray(json.known_weaknesses)),
      ...(asArray(json.pain_points)),
      ...(asArray(json.improvement_priorities)),
    ], 12),
  };
}

function deterministicKpis(profile, context) {
  const industry = `${profile.industry} ${profile.subindustry}`;
  const standards = asArray(profile.active_standards).join(' ');
  const isTech = includesAny(industry, ['tecnolog', 'software', 'ti', 'it', 'cloud', 'servicios gestionados']);
  const has27001 = includesAny(standards, ['27001']);
  const base = [
    {
      kpi: 'Cierre de acciones correctivas en plazo',
      reason: 'Permite controlar eficacia del sistema y evitar acumulación de brechas abiertas.',
      priority: 'alta',
      source_data_needed: 'Planes de acción con fecha de vencimiento, responsable y estado.',
      target_suggestion: '>= 90% cerrado en plazo',
      frequency: 'Mensual',
    },
    {
      kpi: 'Evidencias críticas vigentes',
      reason: 'La evidencia interna vigente es requisito para sostener conclusiones de auditoría.',
      priority: 'alta',
      source_data_needed: 'Evidencias por control, fecha de aprobación y vigencia.',
      target_suggestion: '>= 95% de controles críticos con evidencia vigente',
      frequency: 'Mensual',
    },
    {
      kpi: 'Eficacia de acciones correctivas',
      reason: 'Evita cierres administrativos sin verificación real de no recurrencia.',
      priority: 'alta',
      source_data_needed: 'Acciones cerradas con verificación de eficacia.',
      target_suggestion: '>= 85% con eficacia verificada',
      frequency: 'Trimestral',
    },
  ];

  if (isTech || has27001) {
    base.push(
      {
        kpi: 'Cumplimiento de revisión de accesos',
        reason: 'Perfil tecnológico o ISO 27001 requiere control reforzado sobre accesos y privilegios.',
        priority: 'alta',
        source_data_needed: 'Registros de revisión de usuarios, perfiles privilegiados y aprobaciones.',
        target_suggestion: '100% de accesos críticos revisados',
        frequency: 'Mensual',
      },
      {
        kpi: 'Continuidad y respaldo verificados',
        reason: 'Servicios TI dependen de disponibilidad, respaldo y recuperación probada.',
        priority: 'alta',
        source_data_needed: 'Pruebas de backup/restore, incidentes y tiempos de recuperación.',
        target_suggestion: 'Prueba exitosa según criticidad del servicio',
        frequency: 'Mensual/Trimestral',
      }
    );
  }

  const belowTarget = asArray(context.kpi_context?.kpis_below_target);
  if (belowTarget.length) {
    base.unshift({
      kpi: 'Recuperación de KPIs bajo objetivo',
      reason: `Existen ${belowTarget.length} KPI(s) internos bajo objetivo; deben entrar en seguimiento ejecutivo.`,
      priority: 'alta',
      source_data_needed: 'Últimos snapshots KPI, objetivo y tendencia.',
      target_suggestion: 'Plan correctivo por KPI bajo objetivo',
      frequency: 'Mensual',
    });
  }

  return uniq(base, 10);
}

function deterministicControlWeights(profile) {
  const industry = `${profile.industry} ${profile.subindustry}`;
  const standards = asArray(profile.active_standards).join(' ');
  const maturity = lower(profile.maturity_level);
  const lowRisk = includesAny(profile.risk_appetite, ['bajo', 'low', 'conservador']);
  const small = includesAny(profile.company_size, ['pyme', 'peque', 'small', 'micro']);
  const isTech = includesAny(industry, ['tecnolog', 'software', 'ti', 'it', 'cloud', 'servicios gestionados']);
  const has27001 = includesAny(standards, ['27001']);
  const weights = {
    evidencia_y_trazabilidad: 1.2,
    acciones_correctivas: 1.15,
    control_documental: 1.1,
    revision_gerencial: 1.05,
  };

  if (isTech || has27001) {
    Object.assign(weights, {
      seguridad_accesos: 1.45,
      continuidad_respaldo: 1.4,
      gestion_cambios: 1.35,
      incidentes: 1.3,
      proveedores_tecnologicos: 1.25,
    });
  }

  if (includesAny(maturity, ['inicial', 'baja', 'ad hoc', 'initial'])) {
    Object.assign(weights, {
      alcance_sgc: 1.35,
      responsabilidades: 1.3,
      mapa_procesos: 1.25,
      evidencia_base: 1.4,
    });
  }

  if (lowRisk) {
    weights.controles_sin_evidencia = 1.5;
    weights.controles_deteriorados = 1.45;
  }

  if (small) {
    weights.roadmap_gradual = 1.2;
  }

  return weights;
}

function controlDomain(control = {}) {
  const text = lower([
    control.category,
    control.clause,
    control.control_description,
    control.description,
    control.iso,
  ].join(' '));
  if (includesAny(text, ['acceso', 'access', 'usuario', 'privilegio'])) return 'seguridad_accesos';
  if (includesAny(text, ['continuidad', 'backup', 'respaldo', 'recuperaci', 'disponibilidad'])) return 'continuidad_respaldo';
  if (includesAny(text, ['cambio', 'change'])) return 'gestion_cambios';
  if (includesAny(text, ['incidente', 'incident'])) return 'incidentes';
  if (includesAny(text, ['proveedor', 'supplier', 'tercero', 'outsourc'])) return 'proveedores_tecnologicos';
  if (includesAny(text, ['document', 'registro', 'informaci'])) return 'control_documental';
  if (includesAny(text, ['accion correctiva', 'corrective', 'no conform'])) return 'acciones_correctivas';
  if (includesAny(text, ['revision', 'direcci', 'management review'])) return 'revision_gerencial';
  if (includesAny(text, ['evidencia', 'trace', 'trazabilidad'])) return 'evidencia_y_trazabilidad';
  return 'general';
}

function priorityForControl(control, weights, profile) {
  const domain = controlDomain(control);
  const summarized = summarizeControl(control);
  let score = Number(weights[domain] || 1);
  const reasons = [];
  if (weights[domain] && weights[domain] > 1.2) {
    reasons.push(`Dominio priorizado por perfil empresa: ${domain.replace(/_/g, ' ')}.`);
  }
  if (summarized.evidence_count === 0) {
    score += Number(weights.controles_sin_evidencia || 1) - 0.7;
    reasons.push('Control activo sin evidencia interna suficiente.');
  }
  if (includesAny(summarized.health_status, ['critico', 'crítico', 'critical', 'deteriorado'])) {
    score += Number(weights.controles_deteriorados || 1) - 0.6;
    reasons.push('Salud de control deteriorada o crítica.');
  }
  if (summarized.overdue_action_plans_count > 0) {
    score += 0.25;
    reasons.push('Existen acciones vencidas relacionadas.');
  }
  if (summarized.open_findings_count > 0 || summarized.open_nonconformities_count > 0) {
    score += 0.2;
    reasons.push('Tiene hallazgos o no conformidades abiertas.');
  }

  let relevance = 'media';
  if (score >= 1.65) relevance = 'alta';
  if (score < 1.15) relevance = 'baja';

  return {
    ...summarized,
    profile_relevance: relevance,
    profile_priority_weight: Math.round(score * 100) / 100,
    profile_priority_reason: reasons.length
      ? reasons.join(' ')
      : `Relevancia base para ${profile.industry || 'el perfil declarado'}.`,
    profile_adjusted_priority: relevance,
    profile_recommended_attention: relevance === 'alta'
      ? 'Completar evidencia, responsable y criterio de cierre antes de auditoría interna.'
      : 'Mantener seguimiento conforme al ciclo normal de gestión.',
    company_profile_context_applied: true,
  };
}

function deterministicRisks(profile, context) {
  const risks = [
    {
      risk: 'Acciones correctivas sin verificación de eficacia',
      reason: 'Puede generar recurrencia de brechas y hallazgos repetidos.',
      priority: 'alta',
      source: 'Perfil empresa + planes de acción/NC internos',
    },
    {
      risk: 'Evidencia insuficiente para sostener cumplimiento',
      reason: 'Sin evidencia aprobada no debe afirmarse cumplimiento formal.',
      priority: 'alta',
      source: 'Controles sin evidencia / data quality',
    },
  ];
  const industry = `${profile.industry} ${profile.subindustry}`;
  if (includesAny(industry, ['tecnolog', 'software', 'ti', 'it', 'cloud'])) {
    risks.push(
      {
        risk: 'Indisponibilidad de sistemas o servicios críticos',
        reason: 'Perfil TI con dependencia operativa de plataformas y continuidad.',
        priority: 'alta',
        source: 'Perfil empresa',
      },
      {
        risk: 'Accesos privilegiados sin revisión suficiente',
        reason: 'Servicios TI requieren trazabilidad y revisión de accesos críticos.',
        priority: 'alta',
        source: 'Perfil empresa / ISO 27001',
      }
    );
  }
  if (asArray(context.risk_context?.high_residual_risks).length) {
    risks.unshift({
      risk: 'Riesgos residuales altos sin tratamiento suficiente',
      reason: `Se detectan ${asArray(context.risk_context.high_residual_risks).length} riesgo(s) altos en datos internos.`,
      priority: 'alta',
      source: 'Matriz de riesgo interna',
    });
  }
  return uniq(risks, 8);
}

function recommendation({
  title,
  reason,
  internalSignal,
  evidence,
  moduleCode,
  source = 'company_profile_impact',
  priority = 'media',
}) {
  return {
    title,
    reason,
    linked_internal_signal: internalSignal || 'No hay evidencia interna suficiente para sostener esta recomendación. Se propone como hipótesis de mejora basada en perfil empresa.',
    required_evidence: asArray(evidence).length ? asArray(evidence) : ['Evidencia objetiva vigente', 'Responsable', 'Criterio de cierre/eficacia'],
    target_module: moduleCode,
    source,
    priority,
  };
}

function itemTitle(item, fallback = 'Elemento priorizado') {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return fallback;
  return item.title || item.name || item.control || item.kpi || item.risk || item.description || item.objective || fallback;
}

function moduleLabel(moduleCode) {
  return {
    dashboard: 'Dashboard',
    health: 'Salud de controles',
    controls: 'Controles',
    kpis: 'KPIs',
    audits: 'Auditorías',
    'action-plans': 'Planes de acción',
    reports: 'Reportes',
  }[moduleCode] || moduleCode;
}

function normalizeModuleCode(value) {
  const code = lower(value).replace(/_/g, '-');
  const allowed = new Set(['dashboard', 'health', 'controls', 'kpis', 'audits', 'action-plans', 'reports']);
  return allowed.has(code) ? code : 'dashboard';
}

function buildImpactFromProfileAndContext(profileRow, context) {
  const profile = normalizeProfile(profileRow);
  const ai = safeObject(profileRow.ai_profile_summary_json);
  const trace = safeObject(profileRow.ai_research_trace_json);
  const weights = deterministicControlWeights(profile);
  const controls = asArray(context.tenant_controls);
  const prioritizedControls = controls
    .map((control) => priorityForControl(control, weights, profile))
    .sort((a, b) => b.profile_priority_weight - a.profile_priority_weight)
    .slice(0, 12);
  const suggestedKpis = uniq([
    ...asArray(ai.proposed_kpis),
    ...deterministicKpis(profile, context),
  ], 12);
  const suggestedControls = uniq([
    ...asArray(ai.suggested_controls),
    ...prioritizedControls
      .filter((item) => item.profile_relevance === 'alta')
      .map((item) => ({
        control: item.description,
        reason: item.profile_priority_reason,
        linked_standard: item.standard_code,
        linked_internal_gap: item.evidence_count === 0 ? 'Sin evidencia interna suficiente' : item.health_status,
        priority: item.profile_adjusted_priority,
        required_evidence: ['Responsable asignado', 'Evidencia vigente', 'Criterio de cierre/verificación'],
        implementation_hint: item.profile_recommended_attention,
      })),
  ], 12);
  const roadmap = uniq([
    ...asArray(ai.improvement_roadmap),
    {
      horizon: '30 días',
      actions: [
        'Validar alcance, procesos críticos y dueños de evidencia.',
        'Completar evidencia base para controles de alta relevancia por perfil.',
      ],
      success_criteria: ['Controles prioritarios con responsable y evidencia mínima definida.'],
      evidence_to_collect: ['Matriz alcance-proceso-control', 'Registro de responsables', 'Evidencias iniciales aprobadas'],
    },
    {
      horizon: '60 días',
      actions: ['Cerrar acciones vencidas y documentar causa raíz en NC/hallazgos abiertos.'],
      success_criteria: ['Acciones críticas cerradas o con fecha comprometida y criterio de eficacia.'],
      evidence_to_collect: ['CAPA actualizada', 'Evidencia de implementación', 'Seguimiento de eficacia'],
    },
    {
      horizon: '90 días',
      actions: ['Ejecutar revisión gerencial con KPI priorizados y riesgos por perfil empresa.'],
      success_criteria: ['Comité revisa objetivos, KPIs, riesgos y evidencias clave.'],
      evidence_to_collect: ['Acta de revisión gerencial', 'Tablero KPI', 'Plan de mejora aprobado'],
    },
  ], 8);

  const limitations = uniq([
    ...(asArray(ai.data_quality_limitations || ai.limitations)),
    ...(asArray(context.data_quality_context?.limitations)),
    'El impacto por perfil no modifica cumplimiento formal sin evidencia interna aprobada.',
    'Las referencias externas sólo calibran buenas prácticas; no son evidencia del tenant.',
  ], 12);

  return {
    tenant_id: profileRow.tenant_id,
    profile,
    industry: profile.industry,
    subindustry: profile.subindustry,
    company_size: profile.company_size,
    maturity_level: profile.maturity_level,
    risk_appetite: profile.risk_appetite,
    active_standards: uniq([...profile.active_standards, ...(context.active_standards || [])], 12),
    critical_processes: profile.critical_processes,
    operational_scope: profile.operational_scope,
    impact_profile: {
      control_domain_weights: weights,
      kpi_target_adjustments: {
        action_closure_on_time: '>= 90%',
        critical_evidence_current: '>= 95%',
        corrective_action_effectiveness: '>= 85%',
      },
      health_scoring_adjustments: {
        mode: 'read_enrichment_only',
        does_not_change_base_score: true,
        high_relevance_without_evidence: 'elevar prioridad de atención',
        low_risk_appetite: includesAny(profile.risk_appetite, ['bajo', 'low']) ? 'mayor criticidad operativa para brechas sin evidencia' : 'sin ajuste adicional',
      },
      risk_focus_areas: deterministicRisks(profile, context),
      audit_focus_areas: uniq([
        ...(asArray(ai.audit_focus_areas)),
        'Trazabilidad requisito-control-evidencia-acción.',
        'Eficacia de acciones correctivas y no recurrencia.',
        'Suficiencia de evidencia para procesos críticos declarados.',
      ], 10),
      suggested_kpis: suggestedKpis,
      suggested_controls: suggestedControls,
      suggested_evidence_baseline: uniq([
        ...(asArray(ai.evidence_baseline || ai.suggested_evidence_baseline)),
        'Alcance ISO aprobado y exclusiones justificadas.',
        'Mapa de procesos críticos y responsables.',
        'Evidencia vigente por control crítico.',
        'Registro de revisión gerencial y decisiones.',
        'CAPA con causa raíz, cierre y verificación de eficacia.',
      ], 12),
      prioritized_controls: prioritizedControls,
      profile_adjusted_controls: prioritizedControls,
      recommended_kpis_missing: suggestedKpis
        .filter((item) => typeof item === 'object')
        .map((item) => ({
          ...item,
          status: 'KPI recomendado por perfil, pendiente de activar/configurar',
        }))
        .slice(0, 8),
      improvement_roadmap: roadmap,
      management_focus: uniq([
        ...(asArray(ai.management_focus)),
        'Revisar mensualmente controles de alta relevancia por perfil empresa.',
        'Separar evidencia interna de referencias externas en comités y auditorías.',
      ], 8),
      assumptions: uniq([
        ...(asArray(ai.industry_assumptions)),
        profile.industry ? `Perfil calibrado para industria ${profile.industry}.` : 'Industria no declarada; impacto calculado con datos internos disponibles.',
      ], 8),
      limitations,
    },
    trace: {
      source: 'tenant_company_profiles',
      context_source: 'aiContextBuilder.buildCompanyProfileAiContext',
      tenant_filter_enforced: true,
      ai_enriched: trace.fallback_used !== true && Boolean(profileRow.ai_profile_summary_json),
      selected_model: trace.fallback_used === true ? null : trace.selected_model || null,
      used_web: trace.used_web === true,
      used_rag: trace.used_rag === true,
      fallback_used: trace.fallback_used === true,
      calculated_at: new Date().toISOString(),
      source_trace: context.source_trace || null,
      internal_context_counts: context.internal_context_counts || {},
    },
  };
}

async function loadProfileRow(tenantId) {
  if (!tenantId) {
    const error = new Error('Tenant no identificado');
    error.code = 'TENANT_REQUIRED';
    throw error;
  }
  const result = await pool.query(
    `
    SELECT *
    FROM tenant_company_profiles
    WHERE tenant_id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  return result.rows[0] || null;
}

async function buildCompanyProfileImpact({ tenantId, standardCodes = [] } = {}) {
  const profile = await loadProfileRow(tenantId);
  if (!profile) {
    return {
      tenant_id: tenantId,
      profile: null,
      industry: '',
      subindustry: '',
      company_size: '',
      maturity_level: '',
      risk_appetite: '',
      active_standards: [],
      critical_processes: [],
      operational_scope: '',
      impact_profile: {
        control_domain_weights: {},
        kpi_target_adjustments: {},
        health_scoring_adjustments: { mode: 'profile_missing' },
        risk_focus_areas: [],
        audit_focus_areas: [],
        suggested_kpis: [],
        suggested_controls: [],
        suggested_evidence_baseline: [],
        improvement_roadmap: [],
        management_focus: [],
        assumptions: ['Perfil empresa no registrado para este tenant.'],
        limitations: ['Sin perfil empresa no se aplica ajuste operativo por industria/madurez.'],
      },
      trace: {
        source: 'tenant_company_profiles',
        tenant_filter_enforced: true,
        ai_enriched: false,
        fallback_used: true,
        calculated_at: new Date().toISOString(),
      },
    };
  }

  const profileJson = safeObject(profile.profile_json);
  const standards = uniq([
    ...asArray(standardCodes),
    ...asArray(profileJson.active_standards),
    ...asArray(profileJson.target_standards),
  ], 12);
  const context = await aiContextBuilder.buildCompanyProfileAiContext({
    tenantId,
    standardCodes: standards,
  });
  return buildImpactFromProfileAndContext(profile, context);
}

function buildModulePayload(impact, moduleCode) {
  const code = normalizeModuleCode(moduleCode);
  const profile = impact.profile || {};
  const impactProfile = impact.impact_profile || {};
  const prioritizedControls = asArray(impactProfile.prioritized_controls || impactProfile.profile_adjusted_controls);
  const suggestedKpis = asArray(impactProfile.suggested_kpis);
  const risks = asArray(impactProfile.risk_focus_areas);
  const evidence = asArray(impactProfile.suggested_evidence_baseline);
  const roadmap = asArray(impactProfile.improvement_roadmap);
  const management = asArray(impactProfile.management_focus);
  const highControls = prioritizedControls.filter((item) => item.profile_relevance === 'alta').slice(0, 5);
  const sourceCounts = impact.trace?.internal_context_counts || {};

  const commonFocus = [
    ...management.map((item) => itemTitle(item)).filter(Boolean),
    ...risks.map((item) => itemTitle(item)).filter(Boolean),
    ...suggestedKpis.map((item) => itemTitle(item)).filter(Boolean),
  ].slice(0, 5);

  const moduleMap = {
    dashboard: {
      prioritized_items: [
        ...highControls.slice(0, 2),
        ...risks.slice(0, 2),
        ...suggestedKpis.slice(0, 2),
      ],
      business_relevance: `El dashboard prioriza ${impact.industry || 'el perfil declarado'} con foco en controles críticos, KPIs bajo atención y riesgos operativos del tenant.`,
      recommended_focus: commonFocus.slice(0, 5),
      suggested_actions: [
        recommendation({
          title: 'Revisar foco operativo semanal',
          reason: 'Conecta perfil empresa, salud de controles, KPIs y riesgos para comité ejecutivo.',
          internalSignal: `Controles analizados: ${sourceCounts.controls_analyzed || 0}; KPIs analizados: ${sourceCounts.kpis_analyzed || 0}.`,
          evidence: ['Acta de seguimiento', 'Tablero KPI actualizado', 'Backlog de acciones priorizadas'],
          moduleCode: code,
          priority: 'alta',
        }),
      ],
    },
    health: {
      prioritized_items: highControls,
      business_relevance: 'La salud mantiene su score base, pero Perfil Empresa eleva atención sobre controles con mayor impacto de negocio.',
      recommended_focus: [
        'Controles deteriorados con alta relevancia por perfil.',
        'Controles saludables pero críticos para procesos declarados.',
        'Controles sin evidencia suficiente y apetito de riesgo bajo.',
      ],
      suggested_actions: highControls.slice(0, 3).map((control) => recommendation({
        title: `Reforzar ${control.description}`,
        reason: control.profile_priority_reason,
        internalSignal: `Health=${control.health_status || 'no informado'}; evidencia=${control.evidence_count}.`,
        evidence: ['Evidencia vigente', 'Responsable asignado', 'Verificación de operación'],
        moduleCode: code,
        priority: control.profile_adjusted_priority || 'alta',
      })),
    },
    controls: {
      prioritized_items: prioritizedControls.slice(0, 8),
      business_relevance: 'Los controles se priorizan por industria, normas activas, madurez, apetito de riesgo y brechas internas.',
      recommended_focus: highControls.map((item) => item.description).slice(0, 5),
      suggested_actions: prioritizedControls.slice(0, 5).map((control) => recommendation({
        title: control.profile_recommended_attention,
        reason: control.profile_priority_reason,
        internalSignal: `${control.standard_code || 'ISO'} ${control.clause || ''} · salud=${control.health_status || 'sin dato'} · evidencias=${control.evidence_count}.`,
        evidence: ['Evidencia por control', 'Dueño del control', 'Criterio de aceptación'],
        moduleCode: code,
        priority: control.profile_adjusted_priority || 'media',
      })),
    },
    kpis: {
      prioritized_items: suggestedKpis.slice(0, 8),
      business_relevance: 'Los KPIs sugeridos no modifican snapshots; orientan configuración y lectura ejecutiva según perfil.',
      recommended_focus: suggestedKpis.map((item) => itemTitle(item)).slice(0, 5),
      suggested_actions: suggestedKpis.slice(0, 5).map((kpi) => recommendation({
        title: `Activar o revisar KPI: ${itemTitle(kpi, 'KPI recomendado')}`,
        reason: kpi.reason || 'KPI recomendado por perfil empresa y datos internos disponibles.',
        internalSignal: kpi.source_data_needed || 'Requiere fuente de datos interna antes de medir.',
        evidence: [kpi.source_data_needed || 'Definición de fuente de datos', 'Fórmula aprobada', 'Responsable KPI'],
        moduleCode: code,
        priority: kpi.priority || 'media',
      })),
      kpi_interpretation: suggestedKpis.slice(0, 5).map((kpi) => ({
        kpi: itemTitle(kpi, 'KPI recomendado'),
        why_it_matters: kpi.reason || 'Relevante por perfil empresa.',
        target_suggestion: kpi.target_suggestion || 'Definir meta con línea base interna.',
        source_data_needed: kpi.source_data_needed || 'Datos internos por configurar.',
      })),
    },
    audits: {
      prioritized_items: highControls.slice(0, 5),
      business_relevance: 'El foco auditor se ajusta a procesos críticos, controles sin evidencia, riesgos y madurez declarada.',
      recommended_focus: asArray(impactProfile.audit_focus_areas).slice(0, 5),
      suggested_actions: highControls.slice(0, 4).map((control) => recommendation({
        title: `Incluir en muestra auditora: ${control.description}`,
        reason: control.profile_priority_reason,
        internalSignal: `Evidencia=${control.evidence_count}; hallazgos=${control.open_findings_count}; NC=${control.open_nonconformities_count}.`,
        evidence: ['Muestra de auditoría', 'Evidencia de control', 'Pregunta auditora y resultado'],
        moduleCode: code,
        priority: 'alta',
      })),
      audit_focus: asArray(impactProfile.audit_focus_areas).slice(0, 8),
    },
    'action-plans': {
      prioritized_items: [
        ...highControls.slice(0, 4),
        ...risks.slice(0, 4),
      ],
      business_relevance: 'Perfil Empresa sugiere acciones proporcionales al tamaño, madurez, riesgos y brechas internas; no crea acciones automáticamente.',
      recommended_focus: [
        'Cerrar acciones vinculadas a controles de alta relevancia.',
        'Agregar criterio de eficacia antes de cierre.',
        'Conectar acción con evidencia esperada y KPI de seguimiento.',
      ],
      suggested_actions: highControls.slice(0, 5).map((control) => recommendation({
        title: `Preparar acción para ${control.description}`,
        reason: control.profile_priority_reason,
        internalSignal: `Control priorizado por perfil; salud=${control.health_status || 'sin dato'}; evidencias=${control.evidence_count}.`,
        evidence: ['Plan CAPA', 'Causa raíz', 'Evidencia de implementación', 'Verificación de eficacia'],
        moduleCode: code,
        priority: control.profile_adjusted_priority || 'alta',
      })),
    },
    reports: {
      prioritized_items: [
        ...risks.slice(0, 4),
        ...suggestedKpis.slice(0, 4),
        ...highControls.slice(0, 4),
      ],
      business_relevance: 'Los reportes premium incorporan Perfil Empresa como contexto ejecutivo y trazabilidad de interpretación.',
      recommended_focus: commonFocus.slice(0, 5),
      suggested_actions: [
        recommendation({
          title: 'Incluir lectura ejecutiva del perfil en reportes premium',
          reason: 'El perfil mejora interpretación de riesgos, KPIs, controles y hoja de ruta sin alterar datos base.',
          internalSignal: `Fuentes internas analizadas: ${Object.values(sourceCounts).reduce((acc, value) => acc + Number(value || 0), 0)} registros resumidos.`,
          evidence: ['Sección Impacto operativo del Perfil Empresa', 'Trazabilidad IA compacta', 'Limitaciones de evidencia'],
          moduleCode: code,
          priority: 'alta',
        }),
      ],
    },
  };

  const selected = moduleMap[code] || moduleMap.dashboard;
  const fallbackMessage = 'No hay datos internos suficientes para generar priorización completa; completar evidencias, controles y KPIs.';
  const prioritizedItems = asArray(selected.prioritized_items).slice(0, 8);
  const recommendedFocus = asArray(selected.recommended_focus).filter(Boolean).slice(0, 6);

  return {
    tenant_id: impact.tenant_id,
    module_code: code,
    module_label: moduleLabel(code),
    company_profile_used: Boolean(impact.profile),
    ai_profile_used: impact.trace?.ai_enriched === true,
    tenant_filter_enforced: true,
    filtered_by_tenant_id: true,
    generated_at: new Date().toISOString(),
    prioritized_items: prioritizedItems,
    business_relevance: selected.business_relevance || fallbackMessage,
    recommended_focus: recommendedFocus.length ? recommendedFocus : [fallbackMessage],
    suggested_actions: asArray(selected.suggested_actions).slice(0, 8),
    suggested_evidence: evidence.slice(0, 8),
    maturity_gap: {
      maturity_level: impact.maturity_level || 'No declarado',
      interpretation: impact.maturity_level
        ? `Roadmap calibrado para madurez ${impact.maturity_level}.`
        : 'Madurez no declarada; completar perfil para priorización más precisa.',
    },
    risk_alignment: risks.slice(0, 6),
    kpi_interpretation: selected.kpi_interpretation || suggestedKpis.slice(0, 6),
    audit_focus: selected.audit_focus || asArray(impactProfile.audit_focus_areas).slice(0, 6),
    roadmap_items: roadmap.slice(0, 6),
    trace: {
      ...(impact.trace || {}),
      source_module: `company_profile_impact_${code}`,
      tenant_filter_enforced: true,
      filtered_by_tenant_id: true,
      company_profile_used: Boolean(impact.profile),
      ai_profile_used: impact.trace?.ai_enriched === true,
    },
  };
}

async function buildCompanyProfileModuleImpact({ tenantId, moduleCode, standardCodes = [] } = {}) {
  const impact = await buildCompanyProfileImpact({ tenantId, standardCodes });
  return buildModulePayload(impact, moduleCode);
}

function enrichControlsWithProfileImpact(controls = [], impact = {}) {
  const weights = impact?.impact_profile?.control_domain_weights || {};
  const profile = {
    industry: impact.industry,
    subindustry: impact.subindustry,
    active_standards: impact.active_standards,
    company_size: impact.company_size,
    maturity_level: impact.maturity_level,
    risk_appetite: impact.risk_appetite,
  };
  return asArray(controls).map((control) => priorityForControl(control, weights, profile));
}

function enrichKpisWithProfileImpact(kpis = [], impact = {}) {
  const suggested = asArray(impact?.impact_profile?.suggested_kpis);
  return asArray(kpis).map((kpi) => {
    const name = lower(kpi.kpi_name || kpi.name || kpi.kpi || kpi.code);
    const match = suggested.find((item) => lower(item.kpi || item.title || item.name).includes(name) || name.includes(lower(item.kpi || item.title || item.name)));
    return {
      ...kpi,
      profile_kpi_relevance: match ? 'alta' : 'media',
      profile_kpi_priority: match?.priority || (match ? 'alta' : 'media'),
      profile_kpi_reason: match?.reason || 'KPI útil para seguimiento del sistema de gestión.',
      company_profile_context_applied: true,
    };
  });
}

module.exports = {
  buildCompanyProfileImpact,
  buildCompanyProfileModuleImpact,
  enrichControlsWithProfileImpact,
  enrichKpisWithProfileImpact,
};
