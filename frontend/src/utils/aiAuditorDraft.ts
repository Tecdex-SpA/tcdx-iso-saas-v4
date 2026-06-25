export type AiAuditorDraftPayload = {
  source?: string;
  source_label?: string;
  type?: string;
  title?: string;
  description?: string;
  priority?: string;
  severity?: string;
  standard_code?: string;
  iso_code?: string;
  control_ref?: string;
  tenant_control_id?: string;
  recommended_action?: string;
  reason?: string;
  human_review_required?: boolean;
  can_create_records?: boolean;
  [key: string]: unknown;
};

const MAX_DRAFT_STORAGE_BYTES = 24000;
const MAX_TEXT_FIELD_LENGTH = 3000;
const ALLOWED_DRAFT_TYPES = new Set(['finding', 'action_plan', 'evidence', 'nonconformity']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimText(value: unknown, maxLength = MAX_TEXT_FIELD_LENGTH) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeDraftPayload(payload: AiAuditorDraftPayload): AiAuditorDraftPayload {
  const normalized: AiAuditorDraftPayload = {
    ...payload,
    source: payload.source,
    source_label: trimText(payload.source_label, 120),
    type: trimText(payload.type, 80),
    title: trimText(payload.title, 240),
    description: trimText(payload.description),
    priority: trimText(payload.priority, 80),
    severity: trimText(payload.severity, 80),
    standard_code: trimText(payload.standard_code, 80),
    iso_code: trimText(payload.iso_code, 80),
    control_ref: trimText(payload.control_ref, 120),
    tenant_control_id: trimText(payload.tenant_control_id, 120),
    recommended_action: trimText(payload.recommended_action),
    reason: trimText(payload.reason),
    human_review_required: payload.human_review_required === true,
    can_create_records: false,
  };

  return normalized;
}

export function isValidAiAuditorDraft(payload: unknown): payload is AiAuditorDraftPayload {
  if (!isRecord(payload)) return false;
  if (payload.source !== 'ai_auditor_senior') return false;
  if (payload.human_review_required !== true) return false;
  if (payload.can_create_records !== false) return false;

  const type = String(payload.type || '').trim();
  if (type && !ALLOWED_DRAFT_TYPES.has(type)) return false;

  return true;
}

export function readAiAuditorDraftFromSession(draftKey?: string | null): AiAuditorDraftPayload | null {
  if (!draftKey || typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(draftKey);
    if (!raw) return null;
    if (raw.length > MAX_DRAFT_STORAGE_BYTES) return null;

    const parsed = JSON.parse(raw);
    return isValidAiAuditorDraft(parsed) ? normalizeDraftPayload(parsed) : null;
  } catch {
    return null;
  }
}

export function clearAiAuditorDraft(draftKey?: string | null) {
  if (!draftKey || typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(draftKey);
  } catch {
    // no-op
  }
}

export function formatAiAuditorDraftDescription(payload: AiAuditorDraftPayload) {
  const safe = normalizeDraftPayload(payload);

  const parts = [
    safe.description,
    safe.recommended_action ? `Acción recomendada IA: ${safe.recommended_action}` : '',
    safe.reason ? `Motivo IA: ${safe.reason}` : '',
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return parts.join('\n\n');
}

export function normalizeAiAuditorDraftPriority(value?: string | null) {
  const raw = String(value || '').toLowerCase().trim();

  if (['critical', 'critica', 'crítica', 'alta', 'high'].includes(raw)) return 'alta';
  if (['medium', 'media', 'medio'].includes(raw)) return 'media';
  if (['low', 'baja', 'bajo', 'minor'].includes(raw)) return 'baja';

  return 'media';
}

export function formatAiAuditorDraftEvidenceDescription(payload: AiAuditorDraftPayload) {
  const safe = normalizeDraftPayload(payload);

  const parts = [
    safe.title ? `Título IA: ${safe.title}` : '',
    safe.description,
    safe.recommended_action ? `Acción recomendada IA: ${safe.recommended_action}` : '',
    safe.reason ? `Motivo IA: ${safe.reason}` : '',
    'Nota: debe adjuntar archivo o evidencia antes de guardar.',
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return parts.join('\n\n');
}
