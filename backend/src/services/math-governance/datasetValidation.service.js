'use strict';
const crypto = require('crypto');
const { MathGovernanceError } = require('./statisticalEngine.service');
const { COUNT_SEMANTICS, buildPopulationCounts } = require('./countSemantics.service');

const DEFAULT_TEMPORAL_SEMANTICS = Object.freeze({
  canonical_time_field: '__event_time',
  fallback_time_fields: Object.freeze([]),
  time_meaning: 'contract_canonical_time',
  timezone_policy: 'tenant_timezone',
  period_policy: 'start_inclusive_end_exclusive',
  validity_policy: 'canonical_time_in_requested_period',
  missing_time_policy: 'exclude_when_period_requested',
  as_of_policy: 'exclude_future_canonical_time',
});

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
function normalizeTemporalSemantics(temporalSemantics = null) {
  return {
    ...DEFAULT_TEMPORAL_SEMANTICS,
    ...(temporalSemantics || {}),
    fallback_time_fields: Object.freeze(Array.isArray(temporalSemantics?.fallback_time_fields) ? temporalSemantics.fallback_time_fields : []),
    valid_from_fields: Object.freeze(Array.isArray(temporalSemantics?.valid_from_fields) ? temporalSemantics.valid_from_fields : []),
    valid_to_fields: Object.freeze(Array.isArray(temporalSemantics?.valid_to_fields) ? temporalSemantics.valid_to_fields : []),
  };
}
function fieldHasValue(row, field) {
  return field && row?.[field] !== undefined && row?.[field] !== null && row?.[field] !== '';
}
function resolveTemporalValue(row, temporalSemantics) {
  const semantic = normalizeTemporalSemantics(temporalSemantics);
  const fields = [semantic.canonical_time_field, ...semantic.fallback_time_fields].filter(Boolean);
  for (const field of fields) if (fieldHasValue(row, field)) return { field, value: row[field], semantic };
  return { field: semantic.canonical_time_field, value: null, semantic };
}
function resolveFirstTemporalField(row, fields = []) {
  for (const field of fields || []) if (fieldHasValue(row, field)) return { field, value: row[field], date: normalizeDate(row[field]) };
  return { field: fields?.[0] || null, value: null, date: null };
}
function shouldRequireTemporalValue({ periodStart, periodEnd, asOf, temporalSemantics }) {
  const policy = normalizeTemporalSemantics(temporalSemantics).missing_time_policy;
  if (policy === 'allow_missing') return false;
  if (policy === 'exclude_with_reason') return true;
  return Boolean(periodStart || periodEnd || asOf);
}
function validateDataset({ rows, tenantId, period = {}, timezone = 'UTC', unit = null, expectedUnit = null, requiredFields = [], minimumSampleSize = 1, sourceKey = 'dataset', naturalKey = null, rangeRules = {}, scaleRules = {}, allowedStates = null, referenceFields = {}, currency = null, expectedCurrency = null, temporalSemantics = null, now = new Date() } = {}) {
  if (!Array.isArray(rows)) throw new MathGovernanceError('DATASET_ROWS_REQUIRED', 'Dataset debe ser arreglo.', { sourceKey });
  if (!tenantId) throw new MathGovernanceError('DATASET_TENANT_REQUIRED', 'Dataset requiere tenant efectivo.', { sourceKey });
  const validatedTimezone = validateTimezone(timezone);
  const warnings = []; const exclusions = []; const invalidRows = []; const seen = new Set();
  const periodStart = normalizeDate(period.start); const periodEnd = normalizeDate(period.end);
  const asOf = normalizeDate(period.as_of || period.asOf);
  const temporalSemantic = normalizeTemporalSemantics(temporalSemantics);
  const temporalClassifications = [];
  const statusClassifications = [];
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
    if (row.__status_normalization) {
      const statusNormalization = row.__status_normalization;
      statusClassifications.push({
        row_index: index,
        source_record: sourceRecord(row, index),
        domain: statusNormalization.domain,
        source_status: statusNormalization.source_status,
        canonical_status: statusNormalization.canonical_status,
        mapping_version: statusNormalization.mapping_version,
        reason: statusNormalization.reason,
        mapped: statusNormalization.mapped,
        eligible: statusNormalization.eligible,
      });
      if (statusNormalization.mapped === false) {
        addIssue(issues, index, 'status', statusNormalization.reason || 'status_unmapped', 'Estado no mapeado por diccionario de dominio.', statusNormalization.source_status);
      } else if (statusNormalization.eligible === false) {
        addIssue(issues, index, 'status', statusNormalization.reason || 'status_not_eligible', 'Estado no elegible por semantica de dominio.', statusNormalization.source_status);
      }
    }
    for (const [field, allowed] of Object.entries(referenceFields || {})) {
      if (row[field] === undefined || row[field] === null || row[field] === '') continue;
      if (Array.isArray(allowed) && allowed.length && !allowed.includes(row[field])) addIssue(issues, index, field, 'reference_invalid', 'Referencia no existe en el dataset permitido.', row[field]);
    }
    const intervalMode = temporalSemantic.classification === 'validity_interval' && Boolean(periodStart || periodEnd || asOf);
    if (intervalMode) {
      const startValue = resolveFirstTemporalField(row, temporalSemantic.valid_from_fields);
      const endValue = resolveFirstTemporalField(row, temporalSemantic.valid_to_fields);
      let classification = 'in_period';
      if (!startValue.value && shouldRequireTemporalValue({ periodStart, periodEnd, asOf, temporalSemantics: temporalSemantic })) {
        addIssue(issues, index, startValue.field || temporalSemantic.canonical_time_field, 'temporal_missing_required_time', 'Fecha inicial de vigencia ausente para el periodo solicitado.', startValue.value);
        classification = 'missing_required_time';
      }
      if (startValue.value && !startValue.date) {
        addIssue(issues, index, startValue.field, 'date_invalid', 'Fecha invalida.', startValue.value);
        classification = 'missing_required_time';
      }
      if (endValue.value && !endValue.date) {
        addIssue(issues, index, endValue.field, 'date_invalid', 'Fecha invalida.', endValue.value);
        classification = 'missing_required_time';
      }
      if (startValue.date && asOf && startValue.date > asOf) {
        addIssue(issues, index, startValue.field, 'temporal_after_as_of', 'Fecha temporal posterior al as_of solicitado.', startValue.value);
        classification = 'after_period';
      }
      if (startValue.date && startValue.date > now) {
        addIssue(issues, index, startValue.field, 'date_in_future', 'Fecha futura no permitida para calculo operacional.', startValue.value);
        classification = 'after_period';
      }
      if (endValue.date && endValue.date > now) addIssue(issues, index, endValue.field, 'date_in_future', 'Fecha futura no permitida para calculo operacional.', endValue.value);
      if (endValue.date && periodStart && endValue.date <= periodStart) {
        addIssue(issues, index, endValue.field, 'date_before_period', 'Intervalo de vigencia anterior al periodo solicitado.', endValue.value);
        classification = 'before_period';
      }
      if (startValue.date && periodEnd && startValue.date >= periodEnd) {
        addIssue(issues, index, startValue.field, 'date_after_period', 'Intervalo de vigencia posterior al periodo solicitado.', startValue.value);
        classification = 'after_period';
      }
      temporalClassifications.push({ row_index: index, source_record: sourceRecord(row, index), field: startValue.field || temporalSemantic.canonical_time_field, value: startValue.value, valid_to_field: endValue.field, valid_to_value: endValue.value, classification, rule: temporalSemantic.validity_policy });
    }
    const temporalValue = intervalMode ? { value: null, field: null } : resolveTemporalValue(row, temporalSemantic);
    const requireTemporalValue = shouldRequireTemporalValue({ periodStart, periodEnd, asOf, temporalSemantics: temporalSemantic });
    if (!intervalMode && !temporalValue.value && requireTemporalValue) {
      addIssue(issues, index, temporalValue.field, 'temporal_missing_required_time', 'Fecha temporal canonica ausente para el periodo solicitado.', temporalValue.value);
      temporalClassifications.push({ row_index: index, source_record: sourceRecord(row, index), field: temporalValue.field, classification: 'missing_required_time', rule: temporalSemantic.validity_policy });
    }
    if (!intervalMode && temporalValue.value) {
      const date = normalizeDate(temporalValue.value);
      let classification = 'in_period';
      if (!date) {
        addIssue(issues, index, temporalValue.field, 'date_invalid', 'Fecha invalida.', temporalValue.value);
        classification = 'missing_required_time';
      }
      if (date && asOf && date > asOf) {
        addIssue(issues, index, temporalValue.field, 'temporal_after_as_of', 'Fecha temporal posterior al as_of solicitado.', temporalValue.value);
        classification = 'after_period';
      }
      if (date && date > now) {
        addIssue(issues, index, temporalValue.field, 'date_in_future', 'Fecha futura no permitida para calculo operacional.', temporalValue.value);
        classification = 'after_period';
      }
      if (date && periodStart && date < periodStart) {
        addIssue(issues, index, temporalValue.field, 'date_before_period', 'Fecha fuera del periodo solicitado.', temporalValue.value);
        classification = 'before_period';
      }
      if (date && periodEnd && date >= periodEnd) {
        addIssue(issues, index, temporalValue.field, 'date_after_period', 'Fecha fuera del periodo solicitado.', temporalValue.value);
        classification = 'after_period';
      }
      temporalClassifications.push({ row_index: index, source_record: sourceRecord(row, index), field: temporalValue.field, value: temporalValue.value, classification, rule: temporalSemantic.validity_policy });
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
    temporal_semantics: temporalSemantic,
    temporal_summary: {
      period_policy: temporalSemantic.period_policy,
      as_of_policy: temporalSemantic.as_of_policy,
      classifications: temporalClassifications,
    },
    status_summary: {
      classifications: statusClassifications,
    },
    timezone: validatedTimezone,
    unit,
    tenantId,
    status: rows.length === 0 ? 'empty_dataset' : (valid ? 'ready' : 'validated_with_warnings'),
  };
}
module.exports = { validateDataset, hashDataset, COUNT_SEMANTICS, buildPopulationCounts, normalizeTemporalSemantics };
