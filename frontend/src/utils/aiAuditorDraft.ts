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
  [key: string]: any;
};

export function isValidAiAuditorDraft(payload: any): payload is AiAuditorDraftPayload {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    payload.source === 'ai_auditor_senior' &&
    payload.human_review_required === true &&
    payload.can_create_records === false
  );
}

export function readAiAuditorDraftFromSession(draftKey?: string | null): AiAuditorDraftPayload | null {
  if (!draftKey || typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(draftKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isValidAiAuditorDraft(parsed) ? parsed : null;
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
  const parts = [
    payload.description,
    payload.recommended_action ? `Acción recomendada IA: ${payload.recommended_action}` : '',
    payload.reason ? `Motivo IA: ${payload.reason}` : '',
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
  const parts = [
    payload.title ? `Título IA: ${payload.title}` : '',
    payload.description,
    payload.recommended_action ? `Acción recomendada IA: ${payload.recommended_action}` : '',
    payload.reason ? `Motivo IA: ${payload.reason}` : '',
    'Nota: debe adjuntar archivo o evidencia antes de guardar.',
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return parts.join('\n\n');
}
