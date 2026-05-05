export type SupportedDisplayLocale = 'es' | 'en';

type DisplayDomain =
  | 'generic'
  | 'standard'
  | 'clause'
  | 'control'
  | 'category'
  | 'status'
  | 'priority'
  | 'severity'
  | 'module'
  | 'role'
  | 'audit'
  | 'billing'
  | 'objective'
  | 'finding'
  | 'evidence'
  | 'actionPlan'
  | 'adminSaas'
  | string;

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value: string) {
  return stripAccents(String(value || '').trim())
    .toLowerCase()
    .replace(/[“”"]/g, '')
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function preserveEmpty(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function looksLikeTechnicalToken(value: string) {
  const raw = value.trim();

  if (!raw) return false;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return true;
  }

  if (/^[A-Z0-9_./:-]{3,}$/.test(raw) && !/\s/.test(raw)) {
    return true;
  }

  if (/^(tenant|module|status|api|jwt|uuid|id|url|key|code)_/i.test(raw)) {
    return true;
  }

  return false;
}

const exactMap: Record<string, string> = {
  'sin descripcion': 'No description',
  'sin datos': 'No data',
  'sin dato': 'No data',
  'sin clausula': 'No clause',
  'sin norma': 'No standard',
  'sin categoria': 'No category',
  'sin responsable': 'No owner',
  'no aplica': 'Not applicable',

  'abierto': 'Open',
  'abierta': 'Open',
  'cerrado': 'Closed',
  'cerrada': 'Closed',
  'resuelto': 'Resolved',
  'resuelta': 'Resolved',
  'pendiente': 'Pending',
  'en progreso': 'In progress',
  'en ejecucion': 'In execution',
  'atrasado': 'Overdue',
  'atrasada': 'Overdue',
  'vencido': 'Overdue',
  'vencida': 'Overdue',
  'borrador': 'Draft',
  'aprobado': 'Approved',
  'aprobada': 'Approved',
  'rechazado': 'Rejected',
  'rechazada': 'Rejected',
  'activo': 'Active',
  'activa': 'Active',
  'inactivo': 'Inactive',
  'inactiva': 'Inactive',
  'suspendido': 'Suspended',
  'suspendida': 'Suspended',
  'eliminado': 'Deleted',
  'eliminada': 'Deleted',
  'cancelado': 'Cancelled',
  'cancelada': 'Cancelled',
  'completado': 'Completed',
  'completada': 'Completed',
  'cumple': 'Compliant',
  'no cumple': 'Non-compliant',
  'parcial': 'Partial',
  'saludable': 'Healthy',
  'atencion': 'Attention',
  'deteriorado': 'Deteriorated',
  'pendiente aprobacion': 'Pending approval',

  'critico': 'Critical',
  'critica': 'Critical',
  'alta': 'High',
  'alto': 'High',
  'media': 'Medium',
  'medio': 'Medium',
  'baja': 'Low',
  'bajo': 'Low',
  'mayor': 'Major',
  'menor': 'Minor',
  'observacion': 'Observation',
  'fortaleza': 'Strength',
  'no conformidad': 'Nonconformity',
  'no resuelta': 'Unresolved',
  'bloqueado': 'Blocked',
  'bloqueada': 'Blocked',
  'conforme': 'Compliant',
  'no conforme': 'Non-compliant',
  'no conformidad mayor': 'Major nonconformity',
  'no conformidad menor': 'Minor nonconformity',
  'sin evidencia': 'No evidence',
  'oportunidad de mejora': 'Improvement opportunity',

  'gestion de calidad': 'Quality management',
  'seguridad de la informacion': 'Information security',
  'gestion ambiental': 'Environmental management',
  'seguridad y salud en el trabajo': 'Occupational health and safety',
  'sistemas de gestion antisoborno': 'Anti-bribery management systems',
  'inocuidad alimentaria': 'Food safety',
  'gestion de riesgos': 'Risk management',
  'gestion de la energia': 'Energy management',
  'continuidad del negocio': 'Business continuity',
  'responsabilidad social': 'Social responsibility',
  'gestion de servicios de ti': 'IT service management',
  'gestion de privacidad de la informacion': 'Information privacy management',
  'controles de seguridad para servicios cloud': 'Security controls for cloud services',
  'proteccion de datos personales en la nube': 'Protection of personal data in the cloud',
  'gestion de activos': 'Asset management',
  'gestion de compliance': 'Compliance management',
  'gestion de proyectos': 'Project management',

  'iso 27001 seguridad de la informacion': 'ISO 27001 Information security',
  'iso 9001 calidad': 'ISO 9001 Quality',
  'iso 9001 gestion de calidad': 'ISO 9001 Quality management',
  'iso 14001 gestion ambiental': 'ISO 14001 Environmental management',
  'iso iec 20000 1 gestion de servicios de ti': 'ISO/IEC 20000-1 IT service management',

  'clausula 1 alcance': 'Clause 1: Scope',
  'clausula 2 referencias normativas': 'Clause 2: Normative references',
  'clausula 3 terminos y definiciones': 'Clause 3: Terms and definitions',
  'clausula 4 contexto de la organizacion': 'Clause 4: Context of the organization',
  'clausula 5 liderazgo': 'Clause 5: Leadership',
  'clausula 6 planificacion': 'Clause 6: Planning',
  'clausula 7 apoyo': 'Clause 7: Support',
  'clausula 8 operacion': 'Clause 8: Operation',
  'clausula 9 evaluacion del desempeno': 'Clause 9: Performance evaluation',
  'clausula 10 mejora': 'Clause 10: Improvement',

  'general': 'General',
  'proveedores evaluados': 'Evaluated suppliers',
  'revision de accesos privilegiados': 'Privileged access review',
  'accesos privilegiados': 'Privileged access',
  'gestion de incidentes': 'Incident management',
  'gestion documental': 'Document management',
  'control de cambios': 'Change control',
  'auditoria interna': 'Internal audit',
  'mejora continua': 'Continual improvement',
  'accion correctiva': 'Corrective action',
  'evidencia consolidada': 'Consolidated evidence',
  'casa matriz': 'Headquarters',
  'toda la empresa': 'Entire company',
  'operaciones': 'Operations',
  'administracion': 'Administration',

  'existe politica de seguridad de la informacion': 'Information security policy exists',
  'se gestionan accesos de usuarios': 'User access is managed',
  'se realizan respaldos': 'Backups are performed',
  'se monitorean logs': 'Logs are monitored',
  'se gestionan incidentes': 'Incidents are managed',
  'se cifran datos': 'Data is encrypted',
  'se controlan dispositivos': 'Devices are controlled',
  'se realizan auditorias': 'Audits are performed',
  'se gestionan vulnerabilidades': 'Vulnerabilities are managed',
  'se capacita al personal': 'Personnel is trained',
  'define el alcance del sistema de gestion de seguridad de la informacion': 'Defines the scope of the information security management system',

  'contrato creado desde cotizacion aceptada': 'Contract created from accepted quotation',
  'contrato inicial automatico fase 13 gobierno saas': 'Initial automatic contract Phase 13 SaaS Governance',
  'servicio reactivado': 'Service reactivated',
  'modulo habilitado desde saas administration': 'Module enabled from SaaS Administration',
  'modulo deshabilitado desde saas administration': 'Module disabled from SaaS Administration',
  'norma contratada activada desde administracion saas': 'Standard contracted/activated from SaaS Administration',
  'tenant contract updated': 'Tenant contract updated',
  'tenant standard controls initialized': 'Tenant standard controls initialized',
  'tenant module enabled': 'Tenant module enabled',
  'tenant module disabled': 'Tenant module disabled',

  'objetivo de continuidad operacional': 'Operational continuity objective',
  'cumplimiento de objetivos': 'Objectives compliance',
  'kpi 01 cumplimiento de objetivos': 'KPI-01 Objectives compliance',
  'implementado': 'Implemented',
  'implementada': 'Implemented',
  'no implementado': 'Not implemented',
  'no implementada': 'Not implemented',
  'aplican': 'Applicable',
  'no aplican': 'Not applicable',
  'aplican controles': 'Applicable controls',
  'estado diagnostico actual': 'Current diagnostic status',
  'modo solo lectura para auditor': 'Read-only mode for auditor',
  'declaracion de aplicabilidad': 'Statement of Applicability',
  'reporte ejecutivo': 'Executive report',
  'informe de auditoria': 'Audit report',
  'informe de cumplimiento': 'Compliance report',
  'informe de riesgos': 'Risk report',
  'informe de evidencias': 'Evidence report',
  'analisis de hallazgo': 'Finding analysis',
  'plan sugerido': 'Suggested plan',
  'tarea auditor senior': 'Senior auditor task',
  'alerta riesgo senior': 'Senior risk alert',
  'brecha evidencia senior': 'Senior evidence gap',
  'insight auditor senior': 'Senior auditor insight',
  'borrador nc': 'NC draft',
  'sugerencia': 'Suggestion',
  'analisis ia': 'AI analysis',
  'plan sugerido ia': 'AI suggested plan',
  'sugerencia auditor senior': 'Senior auditor suggestion',
  'borrador ia': 'AI draft',
  'prefacturacion': 'Pre-billing',
  'prefactura': 'Pre-bill',
  'cotizacion': 'Quotation',
  'cotizador': 'Quoting tool',
  'dealer': 'Dealer',
  'administracion saas': 'SaaS Administration',
  'modulo habilitado': 'Module enabled',
  'modulo deshabilitado': 'Module disabled',
  'norma activa': 'Active standard',
  'norma contratada': 'Contracted standard',
  'contrato activo': 'Active contract',
  'contrato suspendido': 'Suspended contract',
  'facturacion mensual': 'Monthly billing',
  'total mensual': 'Monthly total',
  'valor mensual': 'Monthly value',
  'descuento': 'Discount',
  'recargo': 'Surcharge',
  'servicio base': 'Base service',
  'servicio adicional': 'Additional service',
  'cuota ia': 'AI quota',
  'cuotas ia': 'AI quotas',
  'usuarios ilimitados': 'Unlimited users',
  'empresa cliente': 'Client company',
  'empresa': 'Company',
  'cliente': 'Client',
  'plan comercial': 'Commercial plan',
  'plan mensual': 'Monthly plan',
  'plan anual': 'Annual plan',
  'kpi automatico': 'Automatic KPI',
  'kpi manual': 'Manual KPI',
  'kpi hibrido': 'Hybrid KPI',
  'cumplimiento': 'Compliance',
  'riesgo': 'Risk',
  'estrategico': 'Strategic',
  'operacional': 'Operational',
};

const standardCodeMap: Record<string, string> = {
  ISO9001: 'ISO 9001',
  ISO27001: 'ISO 27001',
  ISO14001: 'ISO 14001',
  ISO45001: 'ISO 45001',
  ISO37001: 'ISO 37001',
  ISO22000: 'ISO 22000',
  ISO31000: 'ISO 31000',
  ISO50001: 'ISO 50001',
  ISO22301: 'ISO 22301',
  ISO26000: 'ISO 26000',
  ISO28000: 'ISO 28000',
  ISO13485: 'ISO 13485',
  ISO15189: 'ISO 15189',
  ISO37301: 'ISO 37301',
  ISO21502: 'ISO 21502',
  ISO14224: 'ISO 14224',
  'ISO/IEC27701': 'ISO/IEC 27701',
  'ISO/IEC27017': 'ISO/IEC 27017',
  'ISO/IEC27018': 'ISO/IEC 27018',
  'ISO/IEC20000-1': 'ISO/IEC 20000-1',
};

function normalizeStandardCode(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function applyPatterns(original: string) {
  let output = original;

  output = output.replace(/Cláusula\s+(\d+)\s*:\s*/gi, 'Clause $1: ');
  output = output.replace(/Clausula\s+(\d+)\s*:\s*/gi, 'Clause $1: ');
  output = output.replace(/cláusula\s+(\d+)/gi, 'clause $1');
  output = output.replace(/clausula\s+(\d+)/gi, 'clause $1');

  output = output.replace(/Operación/gi, 'Operation');
  output = output.replace(/Operacion/gi, 'Operation');
  output = output.replace(/Contexto de la organización/gi, 'Context of the organization');
  output = output.replace(/Contexto de la organizacion/gi, 'Context of the organization');
  output = output.replace(/Liderazgo/gi, 'Leadership');
  output = output.replace(/Planificación/gi, 'Planning');
  output = output.replace(/Planificacion/gi, 'Planning');
  output = output.replace(/Apoyo/gi, 'Support');
  output = output.replace(/Evaluación del desempeño/gi, 'Performance evaluation');
  output = output.replace(/Evaluacion del desempeno/gi, 'Performance evaluation');
  output = output.replace(/Mejora/gi, 'Improvement');

  output = output.replace(/Contrato creado desde cotización aceptada/gi, 'Contract created from accepted quotation');
  output = output.replace(/Contrato creado desde cotizacion aceptada/gi, 'Contract created from accepted quotation');
  output = output.replace(/Servicio reactivado/gi, 'Service reactivated');
  output = output.replace(/Casa matriz/gi, 'Headquarters');
  output = output.replace(/Proveedores evaluados/gi, 'Evaluated suppliers');
  output = output.replace(/Revisión de accesos privilegiados/gi, 'Privileged access review');
  output = output.replace(/Revision de accesos privilegiados/gi, 'Privileged access review');
  output = output.replace(/Acción correctiva/gi, 'Corrective action');
  output = output.replace(/Accion correctiva/gi, 'Corrective action');
  output = output.replace(/No conformidad/gi, 'Nonconformity');
  output = output.replace(/Hallazgo/gi, 'Finding');
  output = output.replace(/Evidencia/gi, 'Evidence');
  output = output.replace(/Plan de acción/gi, 'Action plan');
  output = output.replace(/Plan de accion/gi, 'Action plan');
  output = output.replace(/Matriz de riesgo/gi, 'Risk matrix');
  output = output.replace(/Auditoría/gi, 'Audit');
  output = output.replace(/Auditoria/gi, 'Audit');
  output = output.replace(/Diagnóstico/gi, 'Diagnostic');
  output = output.replace(/Diagnostico/gi, 'Diagnostic');

  return output;
}

export function translateDisplayText(
  value: string | number | null | undefined,
  locale: string,
  domain: DisplayDomain = 'generic'
): string {
  void domain;

  const original = preserveEmpty(value).trim();

  if (!original) return '';
  if (locale !== 'en') return original;
  if (looksLikeTechnicalToken(original)) return original;

  const normalized = normalizeText(original);
  const mapped = exactMap[normalized];

  if (mapped) return mapped;

  const patterned = applyPatterns(original);
  if (patterned !== original) return patterned;

  return original;
}

export function translateSystemLabel(
  value: string | number | null | undefined,
  locale: string,
  domain: DisplayDomain = 'generic'
): string {
  return translateDisplayText(value, locale, domain);
}

export function translateStatusLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'status');
}

export function translatePriorityLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'priority');
}

export function translateSeverityLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'severity');
}

export function translateStandardLabel(value: string | null | undefined, locale: string): string {
  const original = preserveEmpty(value).trim();
  if (!original) return '';

  const code = normalizeStandardCode(original);
  const standardByCode = standardCodeMap[code] || standardCodeMap[original.toUpperCase()];

  if (standardByCode) return standardByCode;

  return translateDisplayText(original, locale, 'standard');
}

export function translateClauseLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'clause');
}

export function translateControlLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'control');
}

export function translateModuleLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'module');
}

export function translateRoleLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'role');
}

export function translateAuditEventLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'audit');
}

export function translateBillingConceptLabel(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'billing');
}

export function translateIsoText(value: string | null | undefined, locale: string): string {
  return translateDisplayText(value, locale, 'standard');
}
