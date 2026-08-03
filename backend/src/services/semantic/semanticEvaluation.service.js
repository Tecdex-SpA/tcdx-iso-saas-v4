'use strict';

const crypto = require('crypto');

function stableHash(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') return Object.keys(item).sort().reduce((out, key) => {
      out[key] = normalize(item[key]);
      return out;
    }, {});
    return item;
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}

function evaluateQuality(rows, requiredFields = []) {
  const invalidRows = [];
  let present = 0;
  const expected = Math.max(1, rows.length * requiredFields.length);
  rows.forEach((row, index) => {
    const missing = requiredFields.filter((field) => row[field] === null || row[field] === undefined || row[field] === '');
    present += requiredFields.length - missing.length;
    if (missing.length) invalidRows.push({ row: index + 1, code: 'REQUIRED_FIELD_MISSING', fields: missing });
  });
  const completeness = requiredFields.length ? present / expected : 1;
  return {
    status: invalidRows.length ? (rows.length === invalidRows.length ? 'failed' : 'attention') : 'valid',
    score: Number((completeness * 100).toFixed(2)),
    completeness,
    invalid_rows: invalidRows,
  };
}

function evaluateFreshness(observedAt, maximumAgeSeconds, now = new Date()) {
  if (!observedAt) return { status: 'unknown', age_seconds: null, warning: 'SOURCE_TIMESTAMP_MISSING' };
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return { status: 'unknown', age_seconds: null, warning: 'SOURCE_TIMESTAMP_INVALID' };
  const age = Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 1000));
  if (!maximumAgeSeconds) return { status: 'fresh', age_seconds: age, warning: null };
  if (age > maximumAgeSeconds) return { status: 'stale', age_seconds: age, warning: 'SOURCE_STALE' };
  if (age > maximumAgeSeconds * 0.8) return { status: 'attention', age_seconds: age, warning: 'SOURCE_APPROACHING_STALE' };
  return { status: 'fresh', age_seconds: age, warning: null };
}

function evaluateSufficiency({ rows, requiredInputs = [], minimumSampleSize = 1, minimumCoverage = 0, quality, freshness, allowedUnits = [], unit = null }) {
  const usable = rows.filter((row) => requiredInputs.every((field) => row[field] !== null && row[field] !== undefined && row[field] !== ''));
  const coverage = rows.length ? usable.length / rows.length : 0;
  const warnings = [];
  let status = 'sufficient';
  if (!rows.length || usable.length < minimumSampleSize || coverage < minimumCoverage) status = 'insufficient_data';
  else if (quality?.status === 'failed') status = 'quality_failed';
  else if (freshness?.status === 'stale') status = 'stale_source';
  else if (allowedUnits.length && (!unit || !allowedUnits.includes(unit))) status = 'unit_incompatible';
  if (coverage < minimumCoverage) warnings.push('COVERAGE_INSUFFICIENT');
  if (usable.length < minimumSampleSize) warnings.push('SAMPLE_INSUFFICIENT');
  return { status, sufficient: status === 'sufficient', usable_rows: usable.length, sample_size: rows.length, coverage, warnings };
}

module.exports = { stableHash, evaluateQuality, evaluateFreshness, evaluateSufficiency };
