
'use strict';

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeLocale(locale) {
  const raw = String(locale || '').toLowerCase();
  if (raw.startsWith('en')) return 'en';
  return 'es';
}

function normalizeText(value) {
  return stripAccents(String(value || '').trim())
    .toLowerCase()
    .replace(/[“”"]/g, '')
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksTechnical(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return true;
  if (/^https?:\/\//i.test(raw)) return true;
  if (/^[A-Z0-9_./:-]{3,}$/.test(raw) && !/\s/.test(raw)) return true;
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(raw)) return true;
  return false;
}

const EXACT_EN = new Map(Object.entries({
  'pendiente definir': 'To be defined',
  'pendiente de definir': 'To be defined',
  'sin definir': 'To be defined',
  'estado de implementacion': 'Implementation status',
  'responsable del control': 'Control owner',
  'fecha revision': 'Review date',
  'fecha de revision': 'Review date',
  'justificacion': 'Justification',
  'justificacion de aplicabilidad o exclusion': 'Applicability or exclusion justification',
  'notas': 'Notes',
  'notas complementarias': 'Additional notes',
  'crear accion': 'Create action',
  'crear accion correctiva': 'Create corrective action',
  'estado diagnostic actual': 'Current diagnostic status',
  'estado diagnostico actual': 'Current diagnostic status',
  'estado diagnostico': 'Diagnostic status',
  'alcance': 'Scope',
  'contexto de la organizacion': 'Context of the organization',
  'liderazgo': 'Leadership',
  'planificacion': 'Planning',
  'apoyo': 'Support',
  'operacion': 'Operation',
  'evaluacion del desempeno': 'Performance evaluation',
  'mejora': 'Improvement',
  'evidencias sugeridas': 'Suggested evidence',
  'evidencia sugerida': 'Suggested evidence',
  'evidencia requerida': 'Required evidence',
  'evidencia objetiva': 'Objective evidence',
  'riesgos detectados': 'Detected risks',
  'riesgo detectado': 'Detected risk',
  'proximo paso': 'Next step',
  'siguiente paso': 'Next step',
  'pasos siguientes': 'Next steps',
  'resumen central ia': 'Central AI summary',
  'resumen de salud': 'Health summary',
  'senal relevante': 'Relevant signal',
  'senales relevantes': 'Relevant signals',
  'prioridades recomendadas': 'Recommended priorities',
  'prioridad recomendada': 'Recommended priority',
  'recomendaciones': 'Recommendations',
  'recomendacion': 'Recommendation',
  'redaccion propuesta': 'Proposed wording',
  'narrativa': 'Narrative',
  'brecha': 'Gap',
  'brechas': 'Gaps',
  'ajuste sugerido': 'Suggested adjustment',
  'acciones sugeridas': 'Suggested actions',
  'accion sugerida': 'Suggested action',
  'plan de accion sugerido': 'Suggested action plan',
  'responsable sugerido': 'Suggested owner',
  'fecha objetivo': 'Target date',
  'cumple': 'Compliant',
  'no cumple': 'Non-compliant',
  'parcial': 'Partial',
  'no aplicable': 'Not applicable',
  'aplica': 'Applicable',
  'no aplica': 'Not applicable',
  'implementado': 'Implemented',
  'no implementado': 'Not implemented',
  'pendiente': 'Pending',
  'en progreso': 'In progress',
  'borrador': 'Draft',
  'abierto': 'Open',
  'cerrado': 'Closed',
  'resuelta': 'Resolved',
  'resuelto': 'Resolved',
  'critico': 'Critical',
  'critica': 'Critical',
  'alto': 'High',
  'alta': 'High',
  'medio': 'Medium',
  'media': 'Medium',
  'bajo': 'Low',
  'baja': 'Low'
}));

const FRAGMENTS_EN = [
  [/\bSe recomienda\b/gi, 'It is recommended to'],
  [/\bSe recomienda revisar\b/gi, 'It is recommended to review'],
  [/\bSe encontraron\b/gi, 'The following were found'],
  [/\bSe detectaron\b/gi, 'The following were detected'],
  [/\bSe debe\b/gi, 'The organization should'],
  [/\bDebe existir\b/gi, 'There should be'],
  [/\bDebe evidenciarse\b/gi, 'Evidence should show'],
  [/\bDebe revisarse\b/gi, 'This should be reviewed'],
  [/\bDebe actualizarse\b/gi, 'This should be updated'],
  [/\bNo se evidencia\b/gi, 'There is no evidence of'],
  [/\bNo se observan\b/gi, 'No items are observed'],
  [/\bNo se encontraron\b/gi, 'No items were found'],
  [/\bExiste evidencia\b/gi, 'Evidence exists'],
  [/\bEvidencia disponible\b/gi, 'Available evidence'],
  [/\bEvidencia pendiente\b/gi, 'Pending evidence'],
  [/\bcontrol asociado\b/gi, 'associated control'],
  [/\bcontrol vinculado\b/gi, 'linked control'],
  [/\bacción correctiva\b/gi, 'corrective action'],
  [/\baccion correctiva\b/gi, 'corrective action'],
  [/\bplan de acción\b/gi, 'action plan'],
  [/\bplan de accion\b/gi, 'action plan'],
  [/\bhallazgo\b/gi, 'finding'],
  [/\bhallazgos\b/gi, 'findings'],
  [/\bno conformidad\b/gi, 'nonconformity'],
  [/\bno conformidades\b/gi, 'nonconformities'],
  [/\bevidencia\b/gi, 'evidence'],
  [/\bevidencias\b/gi, 'evidence'],
  [/\briesgo\b/gi, 'risk'],
  [/\briesgos\b/gi, 'risks'],
  [/\bproveedores\b/gi, 'suppliers'],
  [/\bprivilegiados\b/gi, 'privileged'],
  [/\baccesos\b/gi, 'access'],
  [/\bgestión documental\b/gi, 'document management'],
  [/\bgestion documental\b/gi, 'document management'],
  [/\bgestión de riesgos\b/gi, 'risk management'],
  [/\bgestion de riesgos\b/gi, 'risk management'],
  [/\bgestión de incidentes\b/gi, 'incident management'],
  [/\bgestion de incidentes\b/gi, 'incident management'],
  [/\bseguridad de la información\b/gi, 'information security'],
  [/\bseguridad de la informacion\b/gi, 'information security'],
  [/\bsistema de gestión\b/gi, 'management system'],
  [/\bsistema de gestion\b/gi, 'management system'],
  [/\bestado diagnostic actual\b/gi, 'current diagnostic status'],
  [/\bestado diagnostico actual\b/gi, 'current diagnostic status'],
  [/\bestado de implementación\b/gi, 'implementation status'],
  [/\bestado de implementacion\b/gi, 'implementation status'],
  [/\bfecha revisión\b/gi, 'review date'],
  [/\bfecha revision\b/gi, 'review date'],
  [/\bjustificación\b/gi, 'justification'],
  [/\bjustificacion\b/gi, 'justification'],
  [/\bnotas complementarias\b/gi, 'additional notes'],
  [/\bpendiente definir\b/gi, 'to be defined'],
  [/\bpendiente de definir\b/gi, 'to be defined'],
  [/\bcrear acción\b/gi, 'create action'],
  [/\bcrear accion\b/gi, 'create action'],
  [/\bdetected risks\s*:\s*/gi, 'Detected risks: '],
  [/\bnext steps?\s*:\s*/gi, 'Next steps: '],
  [/\bsummary\s+de\s+salud\b/gi, 'Health summary'],
  [/\bredacción propuesta\b/gi, 'Proposed wording'],
  [/\bredaccion propuesta\b/gi, 'Proposed wording'],
  [/\bprioridades recomendadas\b/gi, 'Recommended priorities'],
  [/\bseñales relevantes\b/gi, 'Relevant signals'],
  [/\bsenales relevantes\b/gi, 'Relevant signals']
];

function translateAiLocaleText(value, locale = 'es') {
  const target = normalizeLocale(locale);
  const original = String(value ?? '');
  if (target !== 'en') return original;
  const trimmed = original.trim();
  if (!trimmed || looksTechnical(trimmed)) return original;

  const exact = EXACT_EN.get(normalizeText(trimmed));
  if (exact) return exact;

  let output = original;
  for (const [pattern, replacement] of FRAGMENTS_EN) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function buildAiLocaleInstruction(locale = 'es') {
  return normalizeLocale(locale) === 'en'
    ? [
        'LANGUAGE REQUIREMENT: Respond only in English.',
        'Do not mix Spanish and English.',
        'Translate system labels, recommendations, risks, evidence summaries, action-plan wording and audit narratives into English.',
        'Keep technical identifiers, ISO codes, UUIDs, URLs, emails, enum values and internal codes unchanged.'
      ].join(' ')
    : [
        'REQUISITO DE IDIOMA: Responde solo en español.',
        'No mezcles español e inglés.',
        'Mantén identificadores técnicos, códigos ISO, UUIDs, URLs, emails, enums y códigos internos sin cambios.'
      ].join(' ');
}

function shouldSkipKey(key) {
  return /(^|_)(id|uuid|token|jwt|url|email|file|path|code|key|slug|hash|password|signature|storage|deep_link|href|src)$/i.test(String(key || ''));
}

function translatePayload(value, locale = 'es', key = '') {
  if (normalizeLocale(locale) !== 'en') return value;
  if (value === null || value === undefined) return value;
  if (shouldSkipKey(key)) return value;

  if (typeof value === 'string') return translateAiLocaleText(value, locale);
  if (Array.isArray(value)) return value.map((item) => translatePayload(item, locale, key));
  if (typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = translatePayload(childValue, locale, childKey);
    }
    return output;
  }
  return value;
}

module.exports = {
  normalizeLocale,
  translateAiLocaleText,
  translatePayload,
  buildAiLocaleInstruction
};
