#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  assertAllowedLicense,
  buildActionBasis,
  buildSearchText,
  normalizeFamily,
  normalizeStandardCode,
  normalizeText,
  rejectUnsafeText,
  splitList,
} = require('../src/services/knowledge-base/knowledge.guardrails');
const {
  KNOWLEDGE_SEED_VERSION,
  KNOWLEDGE_SOURCE_FILE,
} = require('../src/services/knowledge-base/knowledge.types');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_INPUT = path.join(REPO_ROOT, 'database/seeds/knowledge', KNOWLEDGE_SOURCE_FILE);
const DEFAULT_JSONL_OUTPUT = path.join(REPO_ROOT, 'database/seeds/knowledge/knowledge_base_seed_v2.jsonl');
const DEFAULT_SUMMARY_OUTPUT = path.join(REPO_ROOT, 'database/seeds/knowledge/knowledge_base_seed_v2.summary.json');

const REQUIRED_FIELDS = [
  'item_key',
  'intent_summary',
  'evidence_expectation',
  'audit_question',
  'common_gap',
  'recommended_action',
  'use_in_system',
];

function splitMarkdownRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const cells = [];
  let current = '';
  let escaped = false;
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const char = trimmed[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(String(cell || '').trim()));
}

function parseMarkdownTable(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const cells = splitMarkdownRow(line).map((cell) => cell.toLowerCase());
    return cells.includes('item_key') && cells.includes('intent_summary') && cells.includes('recommended_action');
  });

  if (headerIndex < 0) {
    const error = new Error('No se encontro tabla Markdown con encabezado item_key/intent_summary');
    error.code = 'KNOWLEDGE_TABLE_NOT_FOUND';
    throw error;
  }

  const headers = splitMarkdownRow(lines[headerIndex]).map((cell) => normalizeText(cell));
  const rows = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const cells = splitMarkdownRow(lines[index]);
    if (!cells.length) {
      if (rows.length > 0) break;
      continue;
    }
    if (isSeparatorRow(cells)) continue;
    if (cells.length !== headers.length) {
      const error = new Error(`Fila Markdown invalida en linea ${index + 1}: ${cells.length} columnas, esperado ${headers.length}`);
      error.code = 'KNOWLEDGE_ROW_COLUMN_MISMATCH';
      throw error;
    }
    rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])));
  }
  return rows;
}

function validateRequiredFields(row) {
  for (const field of REQUIRED_FIELDS) {
    if (!normalizeText(row[field])) {
      const error = new Error(`Registro sin campo obligatorio ${field}`);
      error.code = 'KNOWLEDGE_REQUIRED_FIELD_MISSING';
      error.field = field;
      error.item_key = row.item_key || null;
      throw error;
    }
  }
}

function rowToBundle(row) {
  validateRequiredFields(row);
  Object.entries(row).forEach(([field, value]) => rejectUnsafeText(value, field));

  const licenseClass = assertAllowedLicense(row.license_class);
  const itemKey = normalizeText(row.item_key);
  const tags = Array.from(new Set([
    ...splitList(row.domain),
    ...splitList(row.item_type),
    ...splitList(row.standard_family),
    ...splitList(row.severity_default),
  ]));

  const bundle = {
    schema: 'knowledge_item_bundle',
    seed_version: KNOWLEDGE_SEED_VERSION,
    source_file: KNOWLEDGE_SOURCE_FILE,
    source_record_id: normalizeText(row.id),
    item_key: itemKey,
    source_key: normalizeText(row.source_key),
    standard_family: normalizeFamily(row.standard_family),
    standard_code: normalizeStandardCode(row.standard_code),
    clause_or_control: normalizeText(row.clause_or_control),
    domain: normalizeText(row.domain),
    item_type: normalizeText(row.item_type),
    title: normalizeText(`${row.domain} - ${row.item_type}`),
    intent_summary: normalizeText(row.intent_summary),
    evidence_expectation: normalizeText(row.evidence_expectation),
    audit_question: normalizeText(row.audit_question),
    common_gap: normalizeText(row.common_gap),
    recommended_action: normalizeText(row.recommended_action),
    rule_hint: normalizeText(row.rule_hint),
    severity_default: normalizeText(row.severity_default).toLowerCase(),
    license_class: licenseClass,
    use_in_system: splitList(row.use_in_system),
    tags,
    raw: row,
  };

  bundle.search_text = buildSearchText(bundle);
  bundle.action_basis = buildActionBasis(bundle);
  bundle.sha256 = crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
  return bundle;
}

function increment(summary, section, key) {
  const safeKey = normalizeText(key) || 'sin_clasificar';
  summary[section][safeKey] = (summary[section][safeKey] || 0) + 1;
}

function buildSummary({ bundles, warnings, inputFile }) {
  const summary = {
    seed_version: KNOWLEDGE_SEED_VERSION,
    source_file: path.basename(inputFile),
    generated_at: new Date().toISOString(),
    total_records: bundles.length,
    warnings,
    by_family: {},
    by_standard: {},
    by_severity: {},
    by_license: {},
    source_sha256: crypto.createHash('sha256').update(fs.readFileSync(inputFile)).digest('hex'),
  };
  for (const bundle of bundles) {
    increment(summary, 'by_family', bundle.standard_family);
    increment(summary, 'by_standard', bundle.standard_code);
    increment(summary, 'by_severity', bundle.severity_default);
    increment(summary, 'by_license', bundle.license_class);
  }
  return summary;
}

function convertKnowledgeMarkdown({
  inputFile = DEFAULT_INPUT,
  jsonlOutput = DEFAULT_JSONL_OUTPUT,
  summaryOutput = DEFAULT_SUMMARY_OUTPUT,
  writeFiles = true,
} = {}) {
  const markdown = fs.readFileSync(inputFile, 'utf8');
  const rows = parseMarkdownTable(markdown);
  const bundles = rows.map(rowToBundle);
  const warnings = [];

  if (bundles.length < 950) {
    const error = new Error(`Registros validos insuficientes: ${bundles.length}. Minimo requerido: 950`);
    error.code = 'KNOWLEDGE_MIN_RECORDS_FAILED';
    throw error;
  }
  if (bundles.length !== 1000) {
    warnings.push(`Registros validos ${bundles.length}; esperado 1000.`);
  }

  const summary = buildSummary({ bundles, warnings, inputFile });

  if (writeFiles) {
    fs.mkdirSync(path.dirname(jsonlOutput), { recursive: true });
    fs.writeFileSync(jsonlOutput, `${bundles.map((bundle) => JSON.stringify(bundle)).join('\n')}\n`);
    fs.writeFileSync(summaryOutput, `${JSON.stringify(summary, null, 2)}\n`);
  }

  return {
    bundles,
    summary,
    jsonlOutput,
    summaryOutput,
  };
}

if (require.main === module) {
  try {
    const result = convertKnowledgeMarkdown();
    console.log(JSON.stringify({
      ok: true,
      records: result.bundles.length,
      jsonl: path.relative(REPO_ROOT, result.jsonlOutput),
      summary: path.relative(REPO_ROOT, result.summaryOutput),
      warnings: result.summary.warnings,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: error.code || 'KNOWLEDGE_CONVERSION_FAILED',
      error: error.message,
      item_key: error.item_key || null,
      field: error.field || null,
    }, null, 2));
    process.exitCode = 1;
  }
}

module.exports = {
  convertKnowledgeMarkdown,
  parseMarkdownTable,
  rowToBundle,
};
