import type { RecommendedAction } from './types';

export function label(value?: string | null) {
  return String(value || 'sin dato')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function priorityClass(priority?: string | null) {
  const value = String(priority || '').toLowerCase();
  if (['critica', 'critico', 'critical'].includes(value)) return 'bg-red-600 text-white';
  if (['alta', 'alto', 'high'].includes(value)) return 'bg-orange-500 text-white';
  if (['media', 'medio', 'medium'].includes(value)) return 'bg-amber-100 text-amber-900';
  return 'bg-emerald-100 text-emerald-800';
}

export function statusClass(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (['applied', 'approved', 'converted', 'accepted'].includes(value)) return 'bg-emerald-100 text-emerald-800';
  if (['pending', 'suggested', 'needs_review'].includes(value)) return 'bg-blue-100 text-blue-800';
  if (['rejected', 'dismissed', 'archived'].includes(value)) return 'bg-gray-200 text-gray-700';
  if (['blocked', 'error'].includes(value)) return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

export function sourceLabel(source?: string | null) {
  const value = String(source || '');
  const map: Record<string, string> = {
    iso_express_diagnostic: 'Diagnostico express',
    iso_risk_matrix: 'Matriz de riesgos',
    iso_document_generator: 'Documento ISO',
    control_health: 'Salud de control',
    evidence: 'Evidencia',
    findings: 'Hallazgo',
    nonconformities: 'No conformidad',
    asset_risks: 'Riesgo de activo',
  };
  return map[value] || label(value);
}

export function targetLabel(target?: string | null) {
  const map: Record<string, string> = {
    action_plan: 'Plan de accion',
    finding: 'Hallazgo',
    nonconformity: 'No conformidad',
    evidence_request: 'Solicitud de evidencia',
  };
  return map[String(target || '')] || label(target);
}

export function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function relatedLinks(action: RecommendedAction) {
  const payload = action.payload_json || {};
  const trace = action.source_trace_json || {};
  const links: Array<{ label: string; href: string }> = [];
  const idValue = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
    return '';
  };

  if (action.tenant_control_id) {
    links.push({ label: 'Ver control', href: `/controles?id=${encodeURIComponent(action.tenant_control_id)}` });
  }

  const evidenceId = idValue(payload.evidence_id || trace.evidence_id);
  if (evidenceId) {
    links.push({ label: 'Ver evidencia', href: `/evidencias?id=${encodeURIComponent(evidenceId)}` });
  }

  const riskId = idValue(payload.risk_item_id || trace.risk_item_id || payload.asset_id);
  if (riskId) {
    links.push({ label: 'Ver riesgo', href: `/matriz-riesgo?id=${encodeURIComponent(riskId)}` });
  }

  const documentId = idValue(payload.document_id || trace.document_id || (
    action.source_entity_type === 'iso_generated_document' ? action.source_entity_id : null
  ));
  if (documentId) {
    links.push({ label: 'Ver documento', href: `/documentos?id=${encodeURIComponent(documentId)}` });
  }

  const findingId = idValue(payload.finding_id || (
    action.source_entity_type === 'finding' ? action.source_entity_id : null
  ));
  if (findingId) {
    links.push({ label: 'Ver hallazgo', href: `/hallazgos?id=${encodeURIComponent(findingId)}` });
  }

  const actionPlanId = idValue(action.created_record_type === 'action_plan'
    ? action.created_record_id
    : payload.action_plan_id);
  if (actionPlanId) {
    links.push({ label: 'Ver plan', href: `/plan-accion?id=${encodeURIComponent(actionPlanId)}` });
  }

  return links;
}

export function canMutate(role?: string | null) {
  const value = String(role || '').toLowerCase();
  return ![
    'viewer',
    'cliente',
    'client',
    'read_only',
    'readonly',
    'solo_lectura',
    'ejecutivo',
  ].includes(value);
}
