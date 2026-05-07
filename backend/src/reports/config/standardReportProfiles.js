'use strict';

/**
 * Perfiles ISO para informes premium TCDX.
 *
 * Objetivo:
 * - Evitar hardcodear textos ISO en templates.
 * - Permitir informes genéricos para múltiples normas.
 * - Optimizar la primera versión para:
 *   - ISO9001:2015
 *   - ISO27001:2022
 * - Mantener fallback para cualquier otra ISO activa en el sistema.
 */

function asString(value) {
  return String(value ?? '').trim();
}

function normalizeStandardCode(value) {
  return asString(value)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('ISO/IEC', 'ISO')
    .replace('ISO-', 'ISO')
    .replace(':', '');
}

function normalizeVersionCode(value) {
  return asString(value).toUpperCase().replace(/\s+/g, '');
}

function buildProfileKey(standardCode, versionCode) {
  const standard = normalizeStandardCode(standardCode);
  const version = normalizeVersionCode(versionCode);

  if (!standard && !version) return 'DEFAULT';
  if (!version) return standard || 'DEFAULT';

  return `${standard}_${version}`;
}

const DEFAULT_PROFILE = {
  key: 'DEFAULT',
  standard_code: null,
  version_code: null,

  display_name: 'Norma ISO',
  short_name: 'ISO',
  management_system: 'Sistema de Gestión',
  formal_scope_label: 'Sistema de gestión evaluado',

  executive_focus:
    'cumplimiento, control operativo, riesgos, evidencias, hallazgos, acciones y mejora continua',

  audit_focus:
    'evaluación de conformidad, trazabilidad de evidencias, eficacia de controles y cierre de brechas',

  risk_language: 'riesgos asociados al sistema de gestión',
  evidence_focus:
    'documentos, registros, controles, responsables, revisiones, evidencias objetivas y acciones de mejora',

  maturity_language: {
    level_0: 'No implementado',
    level_1: 'Inicial',
    level_2: 'Parcialmente gestionado',
    level_3: 'Gestionado',
    level_4: 'Medido',
    level_5: 'Optimizado',
  },

  report_narrative: {
    executive_title: 'Informe Ejecutivo de Estado ISO',
    diagnostic_title: 'Diagnóstico de Madurez y Brechas',
    controls_title: 'Informe de Control Health',
    risks_title: 'Informe de Riesgos ISO',
    actions_title: 'Informe de Plan de Acción',
    audit_title: 'Informe de Auditoría Interna',
    main_question: '¿Cuál es el estado del sistema de gestión y qué requiere atención prioritaria?',
    management_decision:
      'Priorizar acciones, responsables y plazos sobre los puntos con mayor exposición operativa o normativa.',
  },

  recommended_chart_priority: {
    executive: [
      'global_status',
      'compliance_by_standard',
      'control_health_distribution',
      'top_risks',
      'action_plan_status',
      'lifecycle_stage',
    ],
    diagnostic: [
      'maturity_by_clause',
      'gap_severity_distribution',
      'evaluated_vs_pending_controls',
      'evidence_coverage',
      'roadmap_30_60_90',
    ],
    controls: [
      'control_health_distribution',
      'health_score_by_standard',
      'weakest_controls',
      'evidence_status_distribution',
      'root_cause_distribution',
    ],
    risks: [
      'risk_heatmap',
      'inherent_vs_residual',
      'residual_risk_distribution',
      'top_risks',
      'treatment_strategy_distribution',
    ],
    actions: [
      'action_status_distribution',
      'action_priority_distribution',
      'overdue_actions',
      'roadmap_30_60_90',
    ],
    audit: [
      'finding_classification_distribution',
      'findings_by_clause',
      'audited_control_results',
      'evidence_review_status',
      'nonconformity_severity',
    ],
  },

  section_labels: {
    clauses: 'Cláusulas',
    controls: 'Controles',
    evidences: 'Evidencias',
    findings: 'Hallazgos',
    risks: 'Riesgos',
    actions: 'Acciones',
    nonconformities: 'No conformidades',
    applicability: 'Aplicabilidad',
  },

  executive_kpi_labels: {
    global_score: 'Score global',
    maturity_score: 'Madurez',
    readiness_score: 'Readiness',
    healthy_controls: 'Controles saludables',
    attention_controls: 'Controles en atención',
    deteriorated_controls: 'Controles deteriorados',
    open_findings: 'Hallazgos abiertos',
    open_actions: 'Acciones abiertas',
    high_risks: 'Riesgos altos',
  },

  evidence_examples: [
    'políticas aprobadas',
    'procedimientos vigentes',
    'registros operativos',
    'matrices de evaluación',
    'evidencias de revisión',
    'planes de acción',
  ],

  glossary: {
    control: 'Control',
    clause: 'Cláusula',
    risk: 'Riesgo',
    evidence: 'Evidencia',
    finding: 'Hallazgo',
    nonconformity: 'No conformidad',
  },
};

const ISO9001_2015_PROFILE = {
  ...DEFAULT_PROFILE,
  key: 'ISO9001_2015',
  standard_code: 'ISO9001',
  version_code: '2015',

  display_name: 'ISO 9001:2015',
  short_name: 'ISO 9001',
  management_system: 'Sistema de Gestión de la Calidad',
  formal_scope_label: 'Sistema de Gestión de la Calidad evaluado',

  executive_focus:
    'calidad, procesos, satisfacción del cliente, objetivos de calidad, no conformidades, acciones correctivas y mejora continua',

  audit_focus:
    'conformidad del sistema de gestión de calidad, desempeño de procesos, control operacional, satisfacción del cliente, acciones correctivas y mejora continua',

  risk_language: 'riesgos y oportunidades del Sistema de Gestión de la Calidad',
  evidence_focus:
    'procedimientos, registros de calidad, objetivos, indicadores, revisión por dirección, control documental, no conformidades y acciones correctivas',

  maturity_language: {
    level_0: 'No existe práctica formal de calidad',
    level_1: 'Práctica inicial o informal',
    level_2: 'Proceso parcialmente documentado',
    level_3: 'Proceso definido y gestionado',
    level_4: 'Proceso medido con indicadores',
    level_5: 'Proceso optimizado y en mejora continua',
  },

  report_narrative: {
    executive_title: 'Informe Ejecutivo de Estado ISO 9001:2015',
    diagnostic_title: 'Diagnóstico de Madurez y Brechas ISO 9001:2015',
    controls_title: 'Informe de Control Health ISO 9001:2015',
    risks_title: 'Informe de Riesgos y Oportunidades ISO 9001:2015',
    actions_title: 'Informe de Plan de Acción ISO 9001:2015',
    audit_title: 'Informe de Auditoría Interna ISO 9001:2015',
    main_question:
      '¿El Sistema de Gestión de la Calidad está operando de forma eficaz y orientada a la satisfacción del cliente?',
    management_decision:
      'Priorizar mejoras sobre procesos críticos, objetivos de calidad, no conformidades, satisfacción del cliente y acciones correctivas vencidas.',
  },

  recommended_chart_priority: {
    executive: [
      'global_status',
      'maturity_by_clause',
      'control_health_distribution',
      'open_nonconformities',
      'action_plan_status',
      'management_objectives_progress',
    ],
    diagnostic: [
      'maturity_by_clause',
      'gap_severity_distribution',
      'process_control_coverage',
      'evidence_coverage',
      'roadmap_30_60_90',
    ],
    controls: [
      'control_health_distribution',
      'health_score_by_clause',
      'weakest_controls',
      'evidence_status_distribution',
      'root_cause_distribution',
    ],
    risks: [
      'risk_opportunity_matrix',
      'risk_heatmap',
      'inherent_vs_residual',
      'risks_by_process',
      'treatment_strategy_distribution',
    ],
    actions: [
      'corrective_action_status',
      'action_priority_distribution',
      'overdue_actions',
      'actions_by_source',
      'roadmap_30_60_90',
    ],
    audit: [
      'finding_classification_distribution',
      'findings_by_clause',
      'audited_control_results',
      'nonconformity_severity',
      'corrective_action_closure_plan',
    ],
  },

  section_labels: {
    clauses: 'Cláusulas ISO 9001',
    controls: 'Controles de calidad',
    evidences: 'Evidencias de calidad',
    findings: 'Hallazgos de calidad',
    risks: 'Riesgos y oportunidades',
    actions: 'Acciones correctivas y de mejora',
    nonconformities: 'No conformidades',
    applicability: 'Aplicabilidad del requisito',
  },

  executive_kpi_labels: {
    ...DEFAULT_PROFILE.executive_kpi_labels,
    global_score: 'Score SGC',
    maturity_score: 'Madurez del SGC',
    readiness_score: 'Preparación ISO 9001',
    healthy_controls: 'Controles de calidad saludables',
    attention_controls: 'Controles de calidad en atención',
    deteriorated_controls: 'Controles de calidad deteriorados',
    open_findings: 'Hallazgos abiertos',
    open_actions: 'Acciones correctivas abiertas',
    high_risks: 'Riesgos relevantes de calidad',
  },

  evidence_examples: [
    'política de calidad aprobada',
    'objetivos de calidad medidos',
    'mapa de procesos',
    'procedimientos operativos',
    'registros de revisión por dirección',
    'registros de no conformidades',
    'acciones correctivas cerradas',
    'indicadores de satisfacción del cliente',
    'evaluación de proveedores',
  ],

  glossary: {
    control: 'Control de calidad',
    clause: 'Cláusula ISO 9001',
    risk: 'Riesgo u oportunidad',
    evidence: 'Evidencia objetiva',
    finding: 'Hallazgo de auditoría',
    nonconformity: 'No conformidad',
  },
};

const ISO27001_2022_PROFILE = {
  ...DEFAULT_PROFILE,
  key: 'ISO27001_2022',
  standard_code: 'ISO27001',
  version_code: '2022',

  display_name: 'ISO/IEC 27001:2022',
  short_name: 'ISO 27001',
  management_system: 'Sistema de Gestión de Seguridad de la Información',
  formal_scope_label: 'Sistema de Gestión de Seguridad de la Información evaluado',

  executive_focus:
    'seguridad de la información, confidencialidad, integridad, disponibilidad, activos, riesgos, controles, SoA, evidencias técnicas y continuidad',

  audit_focus:
    'conformidad del SGSI, tratamiento de riesgos, controles de seguridad, declaración de aplicabilidad, activos, evidencias técnicas, incidentes y mejora continua',

  risk_language: 'riesgos de seguridad de la información',
  evidence_focus:
    'Declaración de Aplicabilidad, inventario de activos, matriz de riesgos, controles Anexo A, registros de acceso, incidentes, continuidad, proveedores y evidencias técnicas',

  maturity_language: {
    level_0: 'Sin control de seguridad formal',
    level_1: 'Control inicial o informal',
    level_2: 'Control parcialmente implementado',
    level_3: 'Control definido y gestionado',
    level_4: 'Control medido y monitoreado',
    level_5: 'Control optimizado y continuamente mejorado',
  },

  report_narrative: {
    executive_title: 'Informe Ejecutivo de Estado ISO/IEC 27001:2022',
    diagnostic_title: 'Diagnóstico de Madurez y Brechas ISO/IEC 27001:2022',
    controls_title: 'Informe de Control Health ISO/IEC 27001:2022',
    risks_title: 'Informe de Riesgos ISO/IEC 27001:2022',
    actions_title: 'Informe de Plan de Acción ISO/IEC 27001:2022',
    audit_title: 'Informe de Auditoría Interna ISO/IEC 27001:2022',
    main_question:
      '¿El SGSI controla adecuadamente los riesgos que afectan la confidencialidad, integridad y disponibilidad de la información?',
    management_decision:
      'Priorizar tratamiento de riesgos residuales altos, controles deteriorados, activos críticos, SoA, evidencias técnicas y acciones vencidas.',
  },

  recommended_chart_priority: {
    executive: [
      'global_status',
      'risk_heatmap',
      'control_health_distribution',
      'soa_applicability_status',
      'top_risks',
      'action_plan_status',
    ],
    diagnostic: [
      'maturity_by_domain',
      'gap_severity_distribution',
      'control_domain_coverage',
      'evidence_coverage',
      'soa_status',
      'roadmap_30_60_90',
    ],
    controls: [
      'control_health_distribution',
      'health_score_by_domain',
      'weakest_controls',
      'evidence_status_distribution',
      'soa_applicability_status',
      'root_cause_distribution',
    ],
    risks: [
      'risk_heatmap',
      'inherent_vs_residual',
      'residual_risk_distribution',
      'top_risks_by_asset',
      'treatment_strategy_distribution',
      'risk_control_effectiveness',
    ],
    actions: [
      'risk_treatment_action_status',
      'action_priority_distribution',
      'overdue_actions',
      'actions_by_source',
      'roadmap_30_60_90',
    ],
    audit: [
      'finding_classification_distribution',
      'findings_by_control',
      'audited_control_results',
      'evidence_review_status',
      'nonconformity_severity',
      'risk_treatment_closure_plan',
    ],
  },

  section_labels: {
    clauses: 'Cláusulas y controles ISO 27001',
    controls: 'Controles de seguridad',
    evidences: 'Evidencias técnicas',
    findings: 'Hallazgos de seguridad',
    risks: 'Riesgos de seguridad de la información',
    actions: 'Acciones de tratamiento',
    nonconformities: 'No conformidades',
    applicability: 'Declaración de Aplicabilidad',
  },

  executive_kpi_labels: {
    ...DEFAULT_PROFILE.executive_kpi_labels,
    global_score: 'Score SGSI',
    maturity_score: 'Madurez del SGSI',
    readiness_score: 'Preparación ISO 27001',
    healthy_controls: 'Controles de seguridad saludables',
    attention_controls: 'Controles de seguridad en atención',
    deteriorated_controls: 'Controles de seguridad deteriorados',
    open_findings: 'Hallazgos de seguridad abiertos',
    open_actions: 'Acciones de tratamiento abiertas',
    high_risks: 'Riesgos altos residuales',
  },

  evidence_examples: [
    'Declaración de Aplicabilidad',
    'inventario de activos',
    'matriz de riesgos de seguridad',
    'plan de tratamiento de riesgos',
    'política de seguridad de la información',
    'registro de accesos',
    'evidencia de respaldo y continuidad',
    'gestión de incidentes',
    'evaluación de proveedores',
    'registros de revisión de controles',
  ],

  glossary: {
    control: 'Control de seguridad',
    clause: 'Cláusula o control ISO 27001',
    risk: 'Riesgo de seguridad de la información',
    evidence: 'Evidencia técnica',
    finding: 'Hallazgo de seguridad',
    nonconformity: 'No conformidad',
  },
};

const STANDARD_REPORT_PROFILES = {
  ISO9001_2015: ISO9001_2015_PROFILE,
  ISO27001_2022: ISO27001_2022_PROFILE,
};

function getStandardReportProfile(standardCode, versionCode) {
  const key = buildProfileKey(standardCode, versionCode);
  const profile = STANDARD_REPORT_PROFILES[key];

  if (profile) {
    return {
      ...profile,
      requested_key: key,
      is_default_profile: false,
    };
  }

  return {
    ...DEFAULT_PROFILE,
    requested_key: key,
    standard_code: normalizeStandardCode(standardCode) || null,
    version_code: normalizeVersionCode(versionCode) || null,
    display_name:
      normalizeStandardCode(standardCode) && normalizeVersionCode(versionCode)
        ? `${normalizeStandardCode(standardCode)}:${normalizeVersionCode(versionCode)}`
        : DEFAULT_PROFILE.display_name,
    short_name: normalizeStandardCode(standardCode) || DEFAULT_PROFILE.short_name,
    is_default_profile: true,
  };
}

function getReportTitleForProfile(profile, reportTypeCode) {
  const safeProfile = profile || DEFAULT_PROFILE;
  const code = asString(reportTypeCode);

  if (code === 'executive_iso_status' || code === 'executive_summary') {
    return safeProfile.report_narrative.executive_title;
  }

  if (code === 'maturity_gap_diagnostic') {
    return safeProfile.report_narrative.diagnostic_title;
  }

  if (code === 'control_health_report' || code === 'control_status') {
    return safeProfile.report_narrative.controls_title;
  }

  if (code === 'iso_risk_report') {
    return safeProfile.report_narrative.risks_title;
  }

  if (code === 'action_plan_report') {
    return safeProfile.report_narrative.actions_title;
  }

  if (code === 'internal_audit_report' || code === 'audit_report') {
    return safeProfile.report_narrative.audit_title;
  }

  return safeProfile.report_narrative.executive_title;
}

function getChartPriorityForReport(profile, reportTypeCode) {
  const safeProfile = profile || DEFAULT_PROFILE;
  const code = asString(reportTypeCode);

  if (code === 'executive_iso_status' || code === 'executive_summary') {
    return safeProfile.recommended_chart_priority.executive || [];
  }

  if (code === 'maturity_gap_diagnostic') {
    return safeProfile.recommended_chart_priority.diagnostic || [];
  }

  if (code === 'control_health_report' || code === 'control_status') {
    return safeProfile.recommended_chart_priority.controls || [];
  }

  if (code === 'iso_risk_report') {
    return safeProfile.recommended_chart_priority.risks || [];
  }

  if (code === 'action_plan_report') {
    return safeProfile.recommended_chart_priority.actions || [];
  }

  if (code === 'internal_audit_report' || code === 'audit_report') {
    return safeProfile.recommended_chart_priority.audit || [];
  }

  return safeProfile.recommended_chart_priority.executive || [];
}

function getProfileEvidenceExamples(profile, limit = 6) {
  const safeProfile = profile || DEFAULT_PROFILE;
  const max = Number.isFinite(Number(limit)) ? Number(limit) : 6;
  return (safeProfile.evidence_examples || []).slice(0, max);
}

function buildProfileContextForReport({ standardCode, versionCode, reportTypeCode }) {
  const profile = getStandardReportProfile(standardCode, versionCode);

  return {
    profile,
    profile_key: profile.key,
    requested_key: profile.requested_key,
    is_default_profile: profile.is_default_profile,
    display_name: profile.display_name,
    short_name: profile.short_name,
    management_system: profile.management_system,
    formal_scope_label: profile.formal_scope_label,
    executive_focus: profile.executive_focus,
    audit_focus: profile.audit_focus,
    risk_language: profile.risk_language,
    evidence_focus: profile.evidence_focus,
    report_title: getReportTitleForProfile(profile, reportTypeCode),
    main_question: profile.report_narrative.main_question,
    management_decision: profile.report_narrative.management_decision,
    chart_priority: getChartPriorityForReport(profile, reportTypeCode),
    section_labels: profile.section_labels,
    executive_kpi_labels: profile.executive_kpi_labels,
    evidence_examples: getProfileEvidenceExamples(profile, 8),
    glossary: profile.glossary,
  };
}

module.exports = {
  DEFAULT_PROFILE,
  STANDARD_REPORT_PROFILES,
  normalizeStandardCode,
  normalizeVersionCode,
  buildProfileKey,
  getStandardReportProfile,
  getReportTitleForProfile,
  getChartPriorityForReport,
  getProfileEvidenceExamples,
  buildProfileContextForReport,
};
