const {
  ALLOWED_LICENSE_CLASSES,
} = require('./knowledge.types');

const HTML_OR_SCRIPT_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|html|body|img|svg|link|meta|style)\b|on\w+\s*=|javascript:/i;

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function splitList(value) {
  return normalizeText(value)
    .split(/[\/,;|]+/)
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);
}

function normalizeStandardCode(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^ISO\/IEC\s+/, 'ISO ')
    .replace(/^ISO-/, 'ISO ');
}

function normalizeFamily(value) {
  return normalizeText(value).toUpperCase().replace(/[\s-]+/g, '_');
}

function rejectUnsafeText(value, fieldName = 'field') {
  const text = String(value ?? '');
  if (HTML_OR_SCRIPT_PATTERN.test(text)) {
    const error = new Error(`Contenido HTML/script no permitido en ${fieldName}`);
    error.code = 'KNOWLEDGE_UNSAFE_TEXT';
    throw error;
  }
  return text;
}

function assertAllowedLicense(licenseClass) {
  const normalized = normalizeText(licenseClass).toLowerCase();
  if (!ALLOWED_LICENSE_CLASSES.has(normalized)) {
    const error = new Error(`license_class no permitido: ${licenseClass}`);
    error.code = 'KNOWLEDGE_LICENSE_NOT_ALLOWED';
    throw error;
  }
  return normalized;
}

function buildSearchText(bundle) {
  return [
    bundle.item_key,
    bundle.standard_family,
    bundle.standard_code,
    bundle.clause_or_control,
    bundle.domain,
    bundle.item_type,
    bundle.title,
    bundle.intent_summary,
    bundle.evidence_expectation,
    bundle.audit_question,
    bundle.common_gap,
    bundle.recommended_action,
    bundle.rule_hint,
    ...(bundle.tags || []),
  ].map(normalizeText).filter(Boolean).join(' ');
}

function buildActionBasis(bundle) {
  const parts = [
    bundle.standard_family,
    bundle.standard_code,
    bundle.clause_or_control ? `referencia ${bundle.clause_or_control}` : '',
    bundle.domain,
    bundle.item_key,
  ].map(normalizeText).filter(Boolean);
  return `knowledge_basis: ${parts.join(' / ')}`;
}

function compactKnowledgeItem(row) {
  if (!row) return null;
  return {
    item_key: row.item_key,
    source_key: row.source_key,
    standard_family: row.standard_family,
    standard_code: row.standard_code,
    clause_or_control: row.clause_or_control,
    domain: row.domain,
    item_type: row.item_type,
    title: row.title,
    intent_summary: row.intent_summary,
    severity_default: row.severity_default,
    license_class: row.license_class,
    use_in_system: Array.isArray(row.use_in_system) ? row.use_in_system : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

module.exports = {
  assertAllowedLicense,
  buildActionBasis,
  buildSearchText,
  compactKnowledgeItem,
  normalizeFamily,
  normalizeStandardCode,
  normalizeText,
  rejectUnsafeText,
  splitList,
};
