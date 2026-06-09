'use strict';

const TEMPLATE_DEFINITIONS = [
  {
    code: 'executive_compliance',
    name: 'Reporte Ejecutivo de Cumplimiento',
    description: 'Resumen ejecutivo de health, brechas, riesgos, acciones y evidencias faltantes.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'ejecutivo_cliente'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf', 'zip'],
    default_sections: ['summary', 'health', 'kpis', 'gaps', 'actions', 'risks', 'evidence'],
  },
  {
    code: 'system_health',
    name: 'Reporte de Salud del Sistema',
    description: 'Health global, fórmula, dimensiones, drivers, KPIs y procesos críticos.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'ejecutivo_cliente'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf'],
    default_sections: ['summary', 'health', 'kpis', 'actions'],
  },
  {
    code: 'gaps_report',
    name: 'Reporte de Brechas',
    description: 'Brechas abiertas, críticas, evidencia faltante y acciones relacionadas.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'responsable_area'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf'],
    default_sections: ['summary', 'gaps', 'actions', 'evidence'],
  },
  {
    code: 'controls_report',
    name: 'Reporte de Controles',
    description: 'Controles aplicables, cobertura, evidencia asociada y diagnóstico relacionado.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'responsable_area'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf'],
    default_sections: ['summary', 'controls', 'evidence', 'gaps', 'actions'],
  },
  {
    code: 'evidence_report',
    name: 'Reporte de Evidencias',
    description: 'Evidencias activas, faltantes, excluidas, sugeridas y asociaciones evidencia-control.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'responsable_area'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf', 'zip'],
    default_sections: ['summary', 'evidence', 'controls'],
  },
  {
    code: 'risks_report',
    name: 'Reporte de Riesgos',
    description: 'Riesgos por norma/proceso, criticidad, tratamiento, residual y acciones pendientes.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'responsable_area'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf'],
    default_sections: ['summary', 'risks', 'actions', 'controls'],
  },
  {
    code: 'audit_report',
    name: 'Reporte de Auditoría',
    description: 'Auditorías, hallazgos, no conformidades, evidencias revisadas y estado de cierre.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf'],
    default_sections: ['summary', 'audit', 'gaps', 'actions', 'evidence'],
  },
  {
    code: 'iso_lifecycle_report',
    name: 'Reporte de Ciclo ISO',
    description: 'Etapas, avance, historial, aprobaciones, responsables, comentarios y fechas.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf'],
    default_sections: ['summary', 'lifecycle', 'audit', 'actions'],
  },
  {
    code: 'document_preparation_report',
    name: 'Reporte de Preparación Documental',
    description: 'Documentos requeridos/sugeridos, encontrados, faltantes y fuentes documentales.',
    allowed_roles: ['admin_cumplimiento', 'admin', 'tenant_admin', 'auditor', 'responsable_area'],
    supports_standard_filter: true,
    supports_process_filter: true,
    supports_period_filter: true,
    requires_human_review: true,
    output_modes: ['preview_json'],
    planned_output_modes: ['pdf', 'zip'],
    default_sections: ['summary', 'evidence', 'controls', 'lifecycle'],
  },
];

const ROLE_ALIASES = {
  tenant_admin: 'admin',
  admin_cliente: 'admin',
  cliente_admin: 'admin',
  compliance_admin: 'admin_cumplimiento',
  compliance: 'admin_cumplimiento',
  encargado_cumplimiento: 'admin_cumplimiento',
  responsable_cumplimiento: 'admin_cumplimiento',
  viewer: 'ejecutivo_cliente',
  cliente: 'ejecutivo_cliente',
  client: 'ejecutivo_cliente',
  read_only: 'ejecutivo_cliente',
  readonly: 'ejecutivo_cliente',
  solo_lectura: 'ejecutivo_cliente',
  ejecutivo: 'ejecutivo_cliente',
  operativo: 'responsable_area',
  area_owner: 'responsable_area',
  partner: 'partner',
  dealer: 'partner',
  reseller: 'partner',
};

function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[raw] || raw;
}

function roleCanUseTemplate(role, template) {
  const normalized = normalizeRole(role);
  if (!normalized || normalized === 'partner') return false;
  if (['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(normalized)) {
    return true;
  }
  return template.allowed_roles.includes(normalized);
}

function publicTemplate(template) {
  return {
    code: template.code,
    name: template.name,
    description: template.description,
    allowed_roles: template.allowed_roles,
    supports_standard_filter: template.supports_standard_filter,
    supports_process_filter: template.supports_process_filter,
    supports_period_filter: template.supports_period_filter,
    requires_human_review: template.requires_human_review,
    output_modes: template.output_modes,
    planned_output_modes: template.planned_output_modes,
  };
}

function listTemplatesForRole(role) {
  return TEMPLATE_DEFINITIONS
    .filter((template) => roleCanUseTemplate(role, template))
    .map(publicTemplate);
}

function getTemplate(templateCode, role = null) {
  const code = String(templateCode || '').trim();
  const template = TEMPLATE_DEFINITIONS.find((item) => item.code === code);
  if (!template) return null;
  if (role && !roleCanUseTemplate(role, template)) return null;
  return { ...template };
}

module.exports = {
  TEMPLATE_DEFINITIONS,
  normalizeRole,
  listTemplatesForRole,
  getTemplate,
  roleCanUseTemplate,
};
