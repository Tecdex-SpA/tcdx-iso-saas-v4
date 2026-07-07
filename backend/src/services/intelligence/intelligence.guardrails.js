const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|session|refresh[_-]?token)/i;
const SECRET_VALUE_PATTERNS = [
  /bearer\s+[a-z0-9._~+/=-]{20,}/ig,
  /\b(sk-[a-z0-9_-]{20,})\b/ig,
  /\b(xox[baprs]-[a-z0-9-]{20,})\b/ig,
  /\b(eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
  /\b([a-f0-9]{32,})\b/ig,
];

const LONG_LICENSED_TEXT_LIMIT = 1200;
const MAX_KNOWLEDGE_ITEMS = 40;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function redactSecrets(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_VALUE_PATTERNS) {
    text = text.replace(pattern, '[redacted]');
  }
  return text;
}

function compactString(value, maxLength = LONG_LICENSED_TEXT_LIMIT) {
  const text = redactSecrets(String(value ?? '').replace(/\s+/g, ' ').trim());
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... [truncated]`;
}

function blockSensitiveFields(input, depth = 0) {
  if (depth > 12) return '[max_depth]';
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return compactString(input);
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => blockSensitiveFields(item, depth + 1));

  return Object.entries(input).reduce((acc, [key, value]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      acc[key] = '[redacted]';
      return acc;
    }
    acc[key] = blockSensitiveFields(value, depth + 1);
    return acc;
  }, {});
}

function sanitizePromptContext(context = {}) {
  return blockSensitiveFields(context);
}

function collectStrings(value, strings = []) {
  if (value === null || value === undefined) return strings;
  if (typeof value === 'string') {
    strings.push(value);
    return strings;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, strings));
    return strings;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
  return strings;
}

function collectKnowledgeItems(context = {}) {
  const direct = asArray(context.knowledge_context?.knowledge_items_used);
  const filtered = asArray(context.knowledge_context?.filtered_items);
  const promptItems = asArray(context.knowledge_context);
  const selected = asArray(context.knowledge_items);
  return [...direct, ...filtered, ...promptItems, ...selected].filter((item) => item && typeof item === 'object');
}

function validateNoFullKnowledgeBase(context = {}) {
  const items = collectKnowledgeItems(context);
  if (items.length > MAX_KNOWLEDGE_ITEMS) {
    const error = new Error(`Prompt bloqueado: knowledge_items_count=${items.length} excede limite ${MAX_KNOWLEDGE_ITEMS}`);
    error.code = 'FULL_KNOWLEDGE_BASE_BLOCKED';
    throw error;
  }

  const strings = collectStrings(context);
  const suspicious = strings.some((text) => (
    text.includes('base_conocimiento_iso_grc_ia_tcdx_1000_registros.md') &&
    text.length > 500
  ));
  if (suspicious) {
    const error = new Error('Prompt bloqueado: posible inclusion extensa de la Knowledge Base completa.');
    error.code = 'FULL_KNOWLEDGE_BASE_BLOCKED';
    throw error;
  }
}

function validateNoSecrets(context = {}) {
  const serialized = JSON.stringify(context);
  if (SECRET_VALUE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(serialized);
  })) {
    const error = new Error('Prompt bloqueado: contiene secreto o token no redactado.');
    error.code = 'SECRET_IN_PROMPT_BLOCKED';
    throw error;
  }
}

function validateNoLongLicensedText(context = {}) {
  const strings = collectStrings(context);
  const longIsoText = strings.find((text) => (
    text.length > LONG_LICENSED_TEXT_LIMIT + 30 &&
    /\bISO\b|\bshall\b|\bdebe\b|\brequisito\b/i.test(text)
  ));
  if (longIsoText) {
    const error = new Error('Prompt bloqueado: contiene texto normativo o licenciado demasiado extenso.');
    error.code = 'LONG_LICENSED_TEXT_BLOCKED';
    throw error;
  }
}

function validateStructuredAiOutput(output = {}) {
  const source = typeof output === 'string' ? JSON.parse(output) : output;
  const data = source?.structured_result || source?.result || source?.narrative || source;
  const requiredStrings = ['executive_summary', 'technical_summary', 'audit_summary', 'confidence'];
  const requiredArrays = ['assumptions', 'limitations', 'recommendations', 'knowledge_basis'];

  if (!data || typeof data !== 'object') {
    const error = new Error('Salida IA invalida: no es objeto JSON.');
    error.code = 'AI_INVALID_OUTPUT';
    throw error;
  }

  for (const field of requiredStrings) {
    if (typeof data[field] !== 'string') {
      const error = new Error(`Salida IA invalida: falta ${field}.`);
      error.code = 'AI_INVALID_OUTPUT';
      throw error;
    }
  }
  for (const field of requiredArrays) {
    if (!Array.isArray(data[field])) {
      const error = new Error(`Salida IA invalida: ${field} debe ser arreglo.`);
      error.code = 'AI_INVALID_OUTPUT';
      throw error;
    }
  }
  if (!['alta', 'media', 'baja'].includes(data.confidence)) {
    data.confidence = 'baja';
  }
  data.should_escalate_to_human = data.should_escalate_to_human === true;
  return sanitizePromptContext(data);
}

function ensureKnowledgeBasisOrDegrade(output = {}, context = {}) {
  const hasApplicableKnowledge = Number(context?.metadata?.knowledge_items_count || 0) > 0 ||
    asArray(context?.knowledge_context).length > 0 ||
    asArray(context?.knowledge_items).length > 0;

  if (!hasApplicableKnowledge || asArray(output.knowledge_basis).length > 0) {
    return output;
  }

  return {
    ...output,
    confidence: 'baja',
    limitations: [
      ...asArray(output.limitations),
      'La respuesta IA fue degradada porque existia fundamento KB aplicable pero no incluyo knowledge_basis.',
    ],
    should_escalate_to_human: true,
    degraded_reason: 'missing_knowledge_basis',
  };
}

function fallbackToDeterministicNarrative(context = {}, reason = 'ai_unavailable') {
  const tenant = context.tenant_summary?.name || context.tenant?.name || 'el tenant';
  const scores = context.scores || context.scoring || {};
  const findings = asArray(context.findings);
  const actions = asArray(context.next_best_actions);
  const knowledgeBasis = asArray(context.knowledge_context || context.knowledge_items).slice(0, 8);
  const limitations = asArray(context.data_quality_warnings || context.limitations);
  const topFinding = findings[0];
  const topAction = actions[0];
  const readiness = scores.audit_readiness ?? context.audit_readiness?.score ?? null;
  const summaryScore = readiness === null ? 'sin score confirmado' : `readiness ${readiness}`;

  return {
    executive_summary: `Con los datos confirmados de ${tenant}, el estado se resume como ${summaryScore}. Se priorizan hallazgos abiertos, evidencia insuficiente y acciones pendientes sin usar IA generativa.`,
    technical_summary: topFinding
      ? `La regla principal detectada es ${topFinding.rule_key || topFinding.type || 'hallazgo_prioritario'} con severidad ${topFinding.severity || 'no informada'}.`
      : 'No se detectaron hallazgos tecnicos suficientes para una conclusion avanzada; se conserva analisis deterministico.',
    audit_summary: knowledgeBasis.length
      ? `El criterio auditor se fundamenta en ${knowledgeBasis.length} referencias derivadas de la Knowledge Base filtrada y datos tenant-scoped.`
      : 'No hay knowledge_basis aplicable suficiente; se requiere revision humana antes de usar esto como criterio auditor.',
    assumptions: ['La narrativa se basa solo en datos internos tenant-scoped y reglas deterministicas disponibles.'],
    limitations: [...limitations, `Fallback deterministico activado: ${reason}`].slice(0, 10),
    recommendations: topAction
      ? [{
          title: topAction.title || topAction.action || 'Ejecutar accion prioritaria',
          action_basis: topAction.action_basis || 'Rules Engine + scoring + datos confirmados del tenant.',
        }]
      : [{
          title: 'Completar evidencia y responsables antes de emitir conclusion auditora',
          action_basis: 'Data quality warnings + ausencia de acciones priorizadas suficientes.',
        }],
    knowledge_basis: knowledgeBasis,
    confidence: knowledgeBasis.length ? 'media' : 'baja',
    should_escalate_to_human: true,
    fallback: true,
    fallback_reason: reason,
  };
}

module.exports = {
  blockSensitiveFields,
  ensureKnowledgeBasisOrDegrade,
  fallbackToDeterministicNarrative,
  sanitizePromptContext,
  validateNoFullKnowledgeBase,
  validateNoLongLicensedText,
  validateNoSecrets,
  validateStructuredAiOutput,
};
