type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

type StatusScope =
  | 'generic'
  | 'compliance'
  | 'health'
  | 'priority'
  | 'severity'
  | 'risk'
  | 'evidence'
  | 'finding'
  | 'actionPlan'
  | 'audit'
  | 'notification'
  | 'kpi'
  | 'category';

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeStatusKey(value: unknown) {
  const raw = String(value ?? '').trim();

  if (!raw) return '';

  return stripAccents(raw)
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const aliasByScope: Record<StatusScope, Record<string, string>> = {
  generic: {
    pendiente: 'pending',
    pending: 'pending',
    abierto: 'open',
    abierta: 'open',
    open: 'open',
    cerrado: 'closed',
    cerrada: 'closed',
    closed: 'closed',
    completado: 'completed',
    completada: 'completed',
    complete: 'completed',
    completed: 'completed',
    cancelado: 'cancelled',
    cancelada: 'cancelled',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    'en ejecucion': 'inProgress',
    en_progreso: 'inProgress',
    in_progress: 'inProgress',
    'in progress': 'inProgress',
    planificado: 'planned',
    planificada: 'planned',
    planned: 'planned',
    activo: 'active',
    activa: 'active',
    active: 'active',
    inactivo: 'inactive',
    inactiva: 'inactive',
    inactive: 'inactive',
    habilitado: 'enabled',
    habilitada: 'enabled',
    enabled: 'enabled',
    deshabilitado: 'disabled',
    deshabilitada: 'disabled',
    disabled: 'disabled',
    aprobado: 'approved',
    aprobada: 'approved',
    approved: 'approved',
    rechazado: 'rejected',
    rechazada: 'rejected',
    rejected: 'rejected',
    validado: 'validated',
    validada: 'validated',
    validated: 'validated',
    vencido: 'overdue',
    vencida: 'overdue',
    atrasado: 'delayed',
    atrasada: 'delayed',
    overdue: 'overdue',
    delayed: 'delayed',
    expirado: 'expired',
    expirada: 'expired',
    expired: 'expired',
    'sin datos': 'noData',
    sin_datos: 'noData',
    'sin dato': 'noData',
    no_data: 'noData',
    'no data': 'noData',
  },

  compliance: {
    cumple: 'compliant',
    compliant: 'compliant',
    'no cumple': 'nonCompliant',
    non_compliant: 'nonCompliant',
    'non compliant': 'nonCompliant',
    'parcialmente cumple': 'partiallyCompliant',
    parcial: 'partiallyCompliant',
    partially_compliant: 'partiallyCompliant',
    'partially compliant': 'partiallyCompliant',
    'no aplica': 'notApplicable',
    'n/a': 'notApplicable',
    na: 'notApplicable',
    not_applicable: 'notApplicable',
    'not applicable': 'notApplicable',
  },

  health: {
    saludable: 'healthy',
    healthy: 'healthy',
    atencion: 'attention',
    attention: 'attention',
    deteriorado: 'deteriorated',
    deteriorada: 'deteriorated',
    deteriorated: 'deteriorated',
    critico: 'critical',
    critica: 'critical',
    critical: 'critical',
    'sin datos': 'noData',
    sin_datos: 'noData',
    no_data: 'noData',
  },

  priority: {
    bajo: 'low',
    baja: 'low',
    low: 'low',
    medio: 'medium',
    media: 'medium',
    medium: 'medium',
    alto: 'high',
    alta: 'high',
    high: 'high',
    critico: 'critical',
    critica: 'critical',
    critical: 'critical',
  },

  severity: {
    bajo: 'low',
    baja: 'low',
    low: 'low',
    menor: 'minor',
    minor: 'minor',
    medio: 'medium',
    media: 'medium',
    medium: 'medium',
    alto: 'high',
    alta: 'high',
    high: 'high',
    mayor: 'major',
    major: 'major',
    critico: 'critical',
    critica: 'critical',
    critical: 'critical',
  },

  risk: {
    bajo: 'low',
    baja: 'low',
    low: 'low',
    medio: 'medium',
    media: 'medium',
    medium: 'medium',
    alto: 'high',
    alta: 'high',
    high: 'high',
    critico: 'critical',
    critica: 'critical',
    critical: 'critical',
  },

  evidence: {
    pendiente: 'pending',
    pending: 'pending',
    subida: 'uploaded',
    subido: 'uploaded',
    uploaded: 'uploaded',
    aprobado: 'approved',
    aprobada: 'approved',
    approved: 'approved',
    rechazado: 'rejected',
    rechazada: 'rejected',
    rejected: 'rejected',
    validado: 'validated',
    validada: 'validated',
    validated: 'validated',
    vencido: 'expired',
    vencida: 'expired',
    expired: 'expired',
    eliminado: 'deleted',
    eliminada: 'deleted',
    deleted: 'deleted',
  },

  finding: {
    abierto: 'open',
    abierta: 'open',
    open: 'open',
    cerrado: 'closed',
    cerrada: 'closed',
    closed: 'closed',
    pendiente: 'pending',
    pending: 'pending',
    'en ejecucion': 'inProgress',
    en_progreso: 'inProgress',
    in_progress: 'inProgress',
    vencido: 'overdue',
    vencida: 'overdue',
    overdue: 'overdue',
    no_requerida: 'notRequired',
    'no requerida': 'notRequired',
    not_required: 'notRequired',
    'not required': 'notRequired',
    pendiente_aprobacion: 'pendingApproval',
    'pendiente aprobacion': 'pendingApproval',
    pending_approval: 'pendingApproval',
    'pending approval': 'pendingApproval',
    aprobada: 'approved',
    aprobado: 'approved',
    approved: 'approved',
    devuelta: 'returned',
    devuelto: 'returned',
    returned: 'returned',
  },

  actionPlan: {
    bloqueado: 'blocked',
    bloqueada: 'blocked',
    blocked: 'blocked',
    abierto: 'open',
    abierta: 'open',
    open: 'open',
    'en ejecucion': 'inProgress',
    en_progreso: 'inProgress',
    in_progress: 'inProgress',
    completado: 'completed',
    completada: 'completed',
    completed: 'completed',
    cancelado: 'cancelled',
    cancelada: 'cancelled',
    cancelled: 'cancelled',
    vencido: 'overdue',
    vencida: 'overdue',
    overdue: 'overdue',
  },

  audit: {
    pendiente: 'pending',
    pending: 'pending',
    planificada: 'planned',
    planificado: 'planned',
    planned: 'planned',
    'en ejecucion': 'inProgress',
    en_progreso: 'inProgress',
    in_progress: 'inProgress',
    completada: 'completed',
    completado: 'completed',
    completed: 'completed',
    cancelada: 'cancelled',
    cancelado: 'cancelled',
    cancelled: 'cancelled',
    'con informe': 'withReport',
    with_report: 'withReport',
    'with report': 'withReport',
    'sin informe': 'withoutReport',
    without_report: 'withoutReport',
    'without report': 'withoutReport',
  },

  notification: {
    info: 'info',
    informacion: 'info',
    warning: 'warning',
    advertencia: 'warning',
    critical: 'critical',
    critico: 'critical',
    critica: 'critical',
    success: 'success',
    exito: 'success',
  },

  kpi: {
    green: 'green',
    verde: 'green',
    yellow: 'yellow',
    amarillo: 'yellow',
    red: 'red',
    rojo: 'red',
    gray: 'gray',
    grey: 'gray',
    gris: 'gray',
    'sin dato': 'noData',
    'sin datos': 'noData',
    no_data: 'noData',
  },

  category: {
    manual: 'manual',
    control: 'control',
    auditoria: 'audit',
    audit: 'audit',
    riesgo: 'risk',
    risk: 'risk',
    no_conformidad: 'nonConformity',
    'no conformidad': 'nonConformity',
    non_conformity: 'nonConformity',
    'non conformity': 'nonConformity',
    observacion: 'observation',
    observation: 'observation',
    evidencia: 'evidence',
    evidence: 'evidence',
    hallazgo: 'finding',
    finding: 'finding',
    'accion correctiva': 'correctiveAction',
    accion_correctiva: 'correctiveAction',
    corrective_action: 'correctiveAction',
    'corrective action': 'correctiveAction',
  },
};

function getScopedLabel(value: unknown, t: TranslationFn, scope: StatusScope) {
  const original = String(value ?? '').trim();
  if (!original) return original;

  const normalized = normalizeStatusKey(original);
  const mapped = aliasByScope[scope]?.[normalized] || aliasByScope.generic[normalized];

  if (!mapped) return original;

  const key = `status.${scope}.${mapped}`;
  const translated = t(key);

  return translated && translated !== key ? translated : original;
}

export function getStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'generic');
}

export function getPriorityLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'priority');
}

export function getSeverityLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'severity');
}

export function getComplianceStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'compliance');
}

export function getHealthStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'health');
}

export function getRiskLevelLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'risk');
}

export function getAuditStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'audit');
}

export function getEvidenceStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'evidence');
}

export function getFindingStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'finding');
}

export function getActionPlanStatusLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'actionPlan');
}

export function getNotificationLevelLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'notification');
}

export function getKpiColorLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'kpi');
}

export function getCategoryLabel(value: unknown, t: TranslationFn) {
  return getScopedLabel(value, t, 'category');
}
