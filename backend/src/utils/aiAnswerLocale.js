const { isEnglishLocale, normalizeLocale } = require('./locale');

const exactEn = new Map([
  ['alta', 'high'],
  ['media', 'medium'],
  ['baja', 'low'],
  ['Información interna de la empresa', 'Company internal information'],
  ['Base de conocimiento TCDX', 'TCDX Knowledge Base'],
  ['Buenas prácticas anonimizadas', 'Anonymized best practices'],
  ['Mejor esfuerzo controlado con información interna limitada', 'Controlled best effort with limited internal information'],

  ['Revisar la información interna encontrada, validar su vigencia y completar evidencia o acciones pendientes.', 'Review the internal information found, validate its currency, and complete pending evidence or actions.'],
  ['Revisar los resultados internos encontrados y confirmar si corresponden al caso consultado.', 'Review the internal results found and confirm whether they apply to the case being assessed.'],
  ['Revisar el control, evidencia y estado operacional relacionado.', 'Review the related control, evidence, and operational status.'],
  ['Si no se gestiona este punto, puede mantenerse una brecha de cumplimiento, falta de trazabilidad y exposición ante auditorías internas o externas.', 'If this point is not addressed, a compliance gap, lack of traceability, and exposure during internal or external audits may remain.'],
  ['Si no se gestiona este punto, puede mantenerse una brecha de cumplimiento, evidencia insuficiente y mayor exposición ante auditoría.', 'If this point is not addressed, a compliance gap, insufficient evidence, and greater audit exposure may remain.'],

  ['Definir escenarios de interrupción relevantes para la organización.', 'Define relevant disruption scenarios for the organization.'],
  ['Mantener procedimientos documentados de continuidad y recuperación.', 'Maintain documented continuity and recovery procedures.'],
  ['Establecer responsables, tiempos objetivo de recuperación y criterios de escalamiento.', 'Define owners, recovery time objectives, and escalation criteria.'],
  ['Probar periódicamente los planes de continuidad y recuperación.', 'Periodically test continuity and recovery plans.'],
  ['Registrar resultados, brechas detectadas, acciones de mejora y verificación posterior.', 'Record results, identified gaps, improvement actions, and follow-up verification.'],
  ['Confirmar escenarios críticos de interrupción para la empresa.', 'Confirm critical disruption scenarios for the company.'],
  ['Validar si existe plan de continuidad operacional y plan de recuperación.', 'Validate whether an operational continuity plan and recovery plan exist.'],
  ['Definir o revisar RTO/RPO cuando aplique.', 'Define or review RTO/RPO where applicable.'],
  ['Programar prueba o simulacro de continuidad y recuperación.', 'Schedule a continuity and recovery test or drill.'],
  ['Registrar brechas, responsables, fechas y acciones de mejora.', 'Record gaps, owners, dates, and improvement actions.'],

  ['Plan de continuidad operacional o continuidad del negocio.', 'Operational continuity or business continuity plan.'],
  ['Plan de recuperación ante desastres o recuperación tecnológica.', 'Disaster recovery or technology recovery plan.'],
  ['Procedimiento de respuesta ante incidentes.', 'Incident response procedure.'],
  ['Registro de pruebas de continuidad, simulacros o ejercicios.', 'Records of continuity tests, drills, or exercises.'],
  ['Definición de RTO/RPO cuando aplique.', 'RTO/RPO definition where applicable.'],
  ['Registro de lecciones aprendidas posteriores a incidentes o pruebas.', 'Lessons learned records after incidents or tests.'],
  ['Evidencia de responsables, fechas de revisión y aprobación.', 'Evidence of owners, review dates, and approval.'],
]);

function replacePhrasesEn(value) {
  let text = String(value || '');

  const replacements = [
    ['Criterio auditor: la respuesta usa fuente Company internal information con confianza medium.', 'Auditor criterion: the answer uses source Company internal information with medium confidence.'],
    ['Criterio auditor: la respuesta usa fuente Company internal information con confianza high.', 'Auditor criterion: the answer uses source Company internal information with high confidence.'],
    ['Criterio auditor: la respuesta usa fuente Company internal information con confianza low.', 'Auditor criterion: the answer uses source Company internal information with low confidence.'],
    ['Criterio auditor: la respuesta usa fuente TCDX Knowledge Base con confianza medium.', 'Auditor criterion: the answer uses source TCDX Knowledge Base with medium confidence.'],
    ['Criterio auditor: la respuesta usa fuente TCDX Knowledge Base con confianza high.', 'Auditor criterion: the answer uses source TCDX Knowledge Base with high confidence.'],
    ['Criterio auditor: la respuesta usa fuente TCDX Knowledge Base con confianza low.', 'Auditor criterion: the answer uses source TCDX Knowledge Base with low confidence.'],
    ['No se observan brechas criticas con la informacion disponible.', 'No critical gaps are observed with the available information.'],
    [' con confianza medium.', ' with medium confidence.'],
    [' con confianza high.', ' with high confidence.'],
    [' con confianza low.', ' with low confidence.'],
    ['Se encontraron ', 'Found '],
    [' coincidencias internas relacionadas con la consulta.', ' internal matches related to the query.'],
    ['La respuesta se basa primero en información propia de la empresa.', 'The answer is based first on the company’s own information.'],
    ['La información interna de la empresa no fue suficiente para responder con seguridad completa.', 'The company’s internal information was not sufficient to respond with full confidence.'],
    ['Se complementó la respuesta con la Base de Conocimiento TCDX.', 'The answer was complemented with the TCDX Knowledge Base.'],
    ['Criterio auditor: la respuesta usa fuente ', 'Auditor criterion: the answer uses source '],
    [' con confianza alta.', ' with high confidence.'],
    [' con confianza media.', ' with medium confidence.'],
    [' con confianza baja.', ' with low confidence.'],
    ['No se observan brechas críticas con la información disponible.', 'No critical gaps are observed with the available information.'],
    ['Brechas principales:', 'Main gaps:'],
    ['Resultados internos más relevantes:', 'Most relevant internal results:'],
    ['Referencias TCDX más relevantes:', 'Most relevant TCDX references:'],
    ['Estado: abierto.', 'Status: open.'],
    ['Estado: cumple.', 'Status: compliant.'],
    ['Estado: completada.', 'Status: completed.'],
    ['Evidencia relacionada con:', 'Evidence related to:'],
    ['Regularizar evidencia del control:', 'Regularize control evidence:'],
    ['Gestión de vulnerabilidades', 'Vulnerability management'],
    ['Mejora continua', 'Continual improvement'],
    ['Controles según SoA', 'Controls according to SoA'],
    ['Se identifican interfaces con terceros', 'Interfaces with third parties are identified'],
    ['Confirmar que la evidencia tenga fecha, responsable, alcance, resultado y aprobación.', 'Confirm that the evidence has date, owner, scope, result, and approval.'],
    ['Verificar que la evidencia esté vinculada al control/cláusula correcta y al periodo auditado.', 'Verify that the evidence is linked to the correct control/clause and audited period.'],
    ['Validar RTO/RPO, escenarios de interrupción, prueba de continuidad y lecciones aprendidas.', 'Validate RTO/RPO, disruption scenarios, continuity test, and lessons learned.'],
    ['matriz de competencias', 'competency matrix'],
    ['plan de formación', 'training plan'],
    ['procedimientos', 'procedures'],
    ['registros', 'records'],
    ['control documental', 'document control'],
    ['Apoyo', 'Support'],
    ['Operación', 'Operation'],
    ['Evaluación del riesgo de seguridad', 'Security risk assessment'],
    ['Controles tecnológicos', 'Technological controls'],
    ['Mejora', 'Improvement'],
  ];

  for (const [source, target] of replacements) {
    text = text.split(source).join(target);
  }

  return text;
}

function polishEnglishAiText(value) {
  return String(value || '')
    .replace(
      /Criterio auditor: la respuesta usa fuente ([^.]+?) con confianza (alta|media|baja|high|medium|low)\./g,
      (_, source, confidence) => {
        const confidenceMap = {
          alta: 'high',
          media: 'medium',
          baja: 'low',
          high: 'high',
          medium: 'medium',
          low: 'low',
        };

        return `Auditor criterion: the answer uses source ${source} with ${confidenceMap[confidence] || confidence} confidence.`;
      }
    )
    .replace(
      /No se observan brechas cr[ií]ticas con la informaci[oó]n disponible\./g,
      'No critical gaps are observed with the available information.'
    );
}

function localizeString(value, locale) {
  if (!isEnglishLocale(locale)) return value;

  const raw = String(value || '');
  if (exactEn.has(raw)) return exactEn.get(raw);

  return polishEnglishAiText(replacePhrasesEn(raw));
}

function shouldLocalizeKey(key) {
  return [
    'executive_summary',
    'analysis',
    'recommendation',
    'suggested_evidence',
    'next_steps',
    'risk_if_not_addressed',
    'confidence',
    'source_label',
    'summary',
    'recommended_action',
    'reason',
    'title',
    'observation',
    'limitations',
    'guardrails',
  ].includes(String(key || ''));
}

function localizeAiAnswerValue(value, locale, key = '') {
  const normalized = normalizeLocale(locale);

  if (!isEnglishLocale(normalized)) return value;

  if (typeof value === 'string') {
    return shouldLocalizeKey(key) ? localizeString(value, normalized) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => localizeAiAnswerValue(item, normalized, key));
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      // Preserve raw customer/database search result payloads.
      if (
        ['top_internal_results', 'top_knowledge_results', 'top_benchmark_results', 'top_external_results'].includes(childKey)
      ) {
        out[childKey] = childValue;
        continue;
      }

      out[childKey] = localizeAiAnswerValue(childValue, normalized, childKey);
    }

    if (value.locale !== undefined) out.locale = normalized;
    if (value.response_language !== undefined) {
      out.response_language = isEnglishLocale(normalized) ? 'English' : 'Spanish';
    }

    return out;
  }

  return value;
}

function localizeAiAnswerPayload(payload, locale) {
  const normalized = normalizeLocale(locale);

  if (!isEnglishLocale(normalized)) return payload;

  const out = localizeAiAnswerValue(payload, normalized);

  if (out && typeof out === 'object') {
    out.locale = normalized;
    out.response_language = 'English';
  }

  return out;
}

module.exports = {
  localizeAiAnswerPayload,
};
