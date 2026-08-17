'use strict';
const crypto = require('crypto');
const { MathGovernanceError } = require('./statisticalEngine.service');
const { COUNT_SEMANTICS, buildPopulationCounts } = require('./countSemantics.service');

const LEGACY_TIMESTAMP_FIELDS = Object.freeze([
  'created_at', 'updated_at', 'measured_at', 'assessed_at', 'event_date', 'submitted_at', 'executed_at', 'tested_at',
]);

function canonical(value) { return JSON.stringify(value, Object.keys(value).sort()); }
function hashDataset(rows) { return crypto.createHash('sha256').update(canonical(rows || [])).digest('hex'); }
function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function addIssue(collection, rowIndex, field, code, message, value = null) { collection.push({ row_index: rowIndex, field, code, message, value }); }
function sourceRecord(row, index) { return row?.id || row?.source_record || row?.source_entity_id || `row-${index}`; }
function enrichIssues(issues, row, index) {
  return issues.map((issue) => ({
    ...issue,
    reason: issue.reason || issue.message,
    source_record: sourceRecord(row, index),
    physical_source: row?.__physical_source || null,
  }));
}
function validateTimezone(timezone) {
  if (!timezone) return 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); return timezone; }
  catch (error) { throw new MathGovernanceError('DATASET_TIMEZONE_INVALID', 'Timezone invalido para dataset operacional.', { timezone }); }
}
function timestampFieldsForRow(row) {
  if (row && row.__event_time !== undefined && row.__event_time !== null && row.__event_time !== '') return ['__event_time'];
  return LEGACY_TIMESTAMP_FIELDS.filter((field) => row?.[field] !== undefined && row?.[field] !== null && row?.[field] !== '');
}
function validateDataset({ rows, tenantId, period = {}, timezone = 'UTC', unit = null, expectedUnit = null, requiredFields = [], minimumSampleSize = 1, sourceKey = 'dataset', naturalKey = null, rangeRules = {}, scaleRules = {}, allowedStates = null, referenceFields = {}, currency = null, expectedCurrency = null, now = new Date() } = {}) {
  if (!Array.isArray(rows)) throw new MathGovernanceError('DATASET_ROWS_REQUIRED', 'Dataset debe ser arreglo.', { sourceKey });
  if (!tenantId) throw new MathGovernanceError('DATASET_TENANT_REQUIRED', 'Dataset requiere tenant efectivo.', { sourceKey });
  const validatedTimezone = validateTimezone(timezone);
  const warnings = []; const exclusions = []; const invalidRows = []; const seen = new Set();
  const periodStart = normalizeDate(period.start); const periodEnd = normalizeDate(period.end);
  if (periodStart && periodEnd && periodEnd < periodStart) throw new MathGovernanceError('DATASET_PERIOD_INVALID', 'Periodo de dataset invalido.', { sourceKey });
  if (expectedUnit && unit && expectedUnit !== unit) warnings.push({ code: 'unit_mismatch', expected: expectedUnit, received: unit });
  if (expectedCurrency && currency && expectedCurrency !== currency) warnings.push({ code: 'currency_mismatch', expected: expectedCurrency, received: currency });
  rows.forEach((row, index) => {
    const issues = [];
    if (row.tenant_id && String(row.tenant_id) !== String(tenantId)) addIssue(issues, index, 'tenant_id', 'tenant_mismatch', 'Fila pertenece a otro tenant.', row.tenant_id);
    for (const field of requiredFields) if (row[field] === undefined || row[field] === null || row[field] === '') addIssue(issues, index, field, 'required_missing', 'Campo obligatorio ausente.', row[field]);
    if (naturalKey) {
      const key = Array.isArray(naturalKey) ? naturalKey.map((field) => row[field] ?? '').join('|') : row[naturalKey];
      if (key) { if (seen.has(String(key))) addIssue(issues, index, Array.isArray(naturalKey) ? naturalKey.join(',') : naturalKey, 'duplicate_natural_key', 'Clave natural duplicada.', key); seen.add(String(key)); }
    }
    for (const [field, rule] of Object.entries(rangeRules || {})) {
      if (row[field] === undefined || row[field] === null || row[field] === '') continue;
      const value = Number(row[field]);
      if (!Number.isFinite(value)) addIssue(issues, index, field, 'range_not_numeric', 'Valor no numerico para regla de rango.', row[field]);
      if (Number.isFinite(value) && rule.min !== undefined && value < rule.min) addIssue(issues, index, field, 'range_below_min', 'Valor bajo el minimo permitido.', row[field]);
      if (Number.isFinite(value) && rule.max !== undefined && value > rule.max) addIssue(issues, index, field, 'range_above_max', 'Valor sobre el maximo permitido.', row[field]);
    }
    for (const [field, rule] of Object.entries(scaleRules || {})) {
      if (row[field] === undefined || row[field] === null || row[field] === '') continue;
      const value = Number(row[field]);
      if (Number.isFinite(value) && rule.decimals !== undefined) { const decimals = String(row[field]).split('.')[1]?.length || 0; if (decimals > rule.decimals) addIssue(issues, index, field, 'scale_exceeded', 'Escala decimal excedida.', row[field]); }
    }
    if (allowedStates && row.status && !allowedStates.includes(row.status)) addIssue(issues, index, 'status', 'state_invalid', 'Estado no permitido por contrato.', row.status);
    for (const [field, allowed] of Object.entries(referenceFields || {})) {
      if (row[field] === undefined || row[field] === null || row[field] === '') continue;
      if (Array.isArray(allowed) && allowed.length && !allowed.includes(row[field])) addIssue(issues, index, field, 'reference_invalid', 'Referencia no existe en el dataset permitido.', row[field]);
    }
    for (const field of timestampFieldsForRow(row)) {
      const date = normalizeDate(row[field]);
      if (!date) addIssue(issues, index, field, 'date_invalid', 'Fecha invalida.', row[field]);
      if (date && date > now) addIssue(issues, index, field, 'date_in_future', 'Fecha futura no permitida para calculo operacional.', row[field]);
      if (date && periodStart && date < periodStart) addIssue(issues, index, field, 'date_before_period', 'Fecha fuera del periodo solicitado.', row[field]);
      if (date && periodEnd && date > periodEnd) addIssue(issues, index, field, 'date_after_period', 'Fecha fuera del periodo solicitado.', row[field]);
    }
    if (issues.length) {
      const enrichedIssues = enrichIssues(issues, row, index);
      invalidRows.push({ row_index: index, source_record: sourceRecord(row, index), physical_source: row?.__physical_source || null, issues: enrichedIssues });
      exclusions.push(...enrichedIssues);
    }
  });
  const invalid = new Set(invalidRows.map((item) => item.row_index));
  const usableRows = rows.filter((_, index) => !invalid.has(index));
  const coverage = rows.length === 0 ? 0 : usableRows.length / rows.length;
  const sampleSize = usableRows.length;
  const valid = sampleSize >= minimumSampleSize && invalidRows.length === 0;
  if (sampleSize < minimumSampleSize) warnings.push({ code: 'minimum_sample_size_not_met', minimumSampleSize, sampleSize });
  const counts = buildPopulationCounts({ received: rows.length, eligible: usableRows.length, usable: usableRows.length, exclusions });
  return {
    sourceKey,
    valid,
    warnings,
    exclusions,
    invalid_rows: invalidRows,
    usable_rows: usableRows,
    sample_size: sampleSize,
    coverage,
    hash: hashDataset(usableRows),
    inputHash: hashDataset(usableRows),
    rowCount: counts.usable,
    receivedCount: counts.received,
    eligibleCount: counts.eligible,
    usableCount: counts.usable,
    excludedCount: counts.excluded,
    exclusionIssueCount: counts.exclusionIssueCount,
    exclusionIssueInstanceCount: counts.exclusionIssueInstanceCount,
    population_size: counts.population_size,
    counts,
    count_semantics: COUNT_SEMANTICS,
    timezone: validatedTimezone,
    unit,
    tenantId,
    status: rows.length === 0 ? 'empty_dataset' : (valid ? 'ready' : 'validated_with_warnings'),
  };
}
module.exports = { validateDataset, hashDataset, COUNT_SEMANTICS, buildPopulationCounts };
