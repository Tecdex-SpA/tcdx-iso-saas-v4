'use strict';

const DATA_TRUST_MODEL_VERSION = 'data-trust-model-v1';

const DATA_TRUST_STATES = Object.freeze({
  TRUSTED: 'TRUSTED',
  TRUSTED_WITH_WARNINGS: 'TRUSTED_WITH_WARNINGS',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  UNTRUSTED: 'UNTRUSTED',
  UNMEASURED: 'UNMEASURED',
});

const DATA_TRUST_DIMENSION_STATUS = Object.freeze({
  PASS: 'pass',
  WARNING: 'warning',
  FAIL: 'fail',
  NOT_APPLICABLE: 'not_applicable',
});

const DATA_TRUST_REASONS = Object.freeze({
  SOURCE_UNAVAILABLE: 'source_unavailable',
  SOURCE_INCOMPATIBLE: 'source_incompatible',
  SOURCE_CONTRACT_INVALID: 'source_contract_invalid',
  NO_RECEIVED_ROWS: 'no_received_rows',
  INSUFFICIENT_POPULATION: 'insufficient_population',
  HIGH_EXCLUSION_RATIO: 'high_exclusion_ratio',
  VALIDATION_WARNINGS: 'validation_warnings',
  FALLBACK_USED: 'fallback_used',
  STATUS_UNMAPPED: 'status_unmapped',
  STATUS_NOT_ELIGIBLE: 'status_not_eligible',
  TEMPORAL_INVALID: 'temporal_invalid',
  SCALE_UNIT_INVALID: 'scale_unit_invalid',
  MISSING_REQUIRED_FIELDS: 'missing_required_fields',
  PROVENANCE_INCOMPLETE: 'provenance_incomplete',
  CONSISTENCY_ISSUES: 'consistency_issues',
});

const DATA_TRUST_MODEL_THRESHOLDS = Object.freeze({
  high_exclusion_ratio: 0.5,
});

const STATE_PRIORITY = Object.freeze({
  [DATA_TRUST_STATES.TRUSTED]: 0,
  [DATA_TRUST_STATES.TRUSTED_WITH_WARNINGS]: 1,
  [DATA_TRUST_STATES.UNMEASURED]: 2,
  [DATA_TRUST_STATES.LOW_CONFIDENCE]: 3,
  [DATA_TRUST_STATES.INSUFFICIENT_DATA]: 4,
  [DATA_TRUST_STATES.UNTRUSTED]: 5,
});

function asCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function issueCodes(exclusions = []) {
  return unique((exclusions || []).map((item) => item?.code || item?.reason || item?.field || null));
}

function hasAnyCode(codes, candidates = []) {
  return candidates.some((candidate) => codes.includes(candidate) || codes.some((code) => code.startsWith(`${candidate}_`)));
}

function dimension(status, reasons = [], evidence = {}) {
  return Object.freeze({ status, reasons: unique(reasons), evidence });
}

function worseState(current, next) {
  return STATE_PRIORITY[next] > STATE_PRIORITY[current] ? next : current;
}

function assessDataTrust({
  sourceStatus = null,
  contract = null,
  formula = null,
  counts = {},
  warnings = [],
  exclusions = [],
  validation = null,
  fallbackSummary = null,
  physicalSources = [],
  sourceSnapshot = null,
  provenance = {},
} = {}) {
  const received = asCount(counts?.received);
  const eligible = asCount(counts?.eligible);
  const usable = asCount(counts?.usable);
  const excluded = asCount(counts?.excluded);
  const requiredPopulation = asCount(formula?.minimum_sample_size ?? provenance.required_population ?? 1) ?? 1;
  const codes = issueCodes(exclusions);
  const warningCodes = issueCodes(warnings);
  const reasons = [];
  const addReason = (reason) => { if (reason) reasons.push(reason); };
  let state = DATA_TRUST_STATES.TRUSTED;

  const sourceFailure = sourceStatus === 'source_unavailable' || sourceStatus === 'source_incompatible' || contract?.availability === 'source_unavailable';
  const contractMissing = provenance.contract_resolved === false || provenance.contract_invalid === true || (!contract && !provenance.source_code);
  if (sourceFailure) {
    state = worseState(state, DATA_TRUST_STATES.UNTRUSTED);
    addReason(sourceStatus === 'source_incompatible' ? DATA_TRUST_REASONS.SOURCE_INCOMPATIBLE : DATA_TRUST_REASONS.SOURCE_UNAVAILABLE);
  }
  if (contractMissing) {
    state = worseState(state, DATA_TRUST_STATES.UNTRUSTED);
    addReason(DATA_TRUST_REASONS.SOURCE_CONTRACT_INVALID);
  }

  if (received === 0 && !sourceFailure) {
    state = worseState(state, DATA_TRUST_STATES.UNMEASURED);
    addReason(DATA_TRUST_REASONS.NO_RECEIVED_ROWS);
  }
  if (usable !== null && usable < requiredPopulation && !sourceFailure) {
    state = worseState(state, DATA_TRUST_STATES.INSUFFICIENT_DATA);
    addReason(DATA_TRUST_REASONS.INSUFFICIENT_POPULATION);
  }

  const exclusionRatio = received && excluded !== null ? excluded / received : null;
  if (exclusionRatio !== null && exclusionRatio >= DATA_TRUST_MODEL_THRESHOLDS.high_exclusion_ratio && usable >= requiredPopulation) {
    state = worseState(state, DATA_TRUST_STATES.LOW_CONFIDENCE);
    addReason(DATA_TRUST_REASONS.HIGH_EXCLUSION_RATIO);
  } else if (excluded !== null && excluded > 0) {
    state = worseState(state, DATA_TRUST_STATES.TRUSTED_WITH_WARNINGS);
    addReason(DATA_TRUST_REASONS.VALIDATION_WARNINGS);
  }

  if (fallbackSummary?.fallback_used === true) {
    state = worseState(state, DATA_TRUST_STATES.TRUSTED_WITH_WARNINGS);
    addReason(DATA_TRUST_REASONS.FALLBACK_USED);
  }
  if (hasAnyCode(codes, ['status_unmapped'])) addReason(DATA_TRUST_REASONS.STATUS_UNMAPPED);
  if (hasAnyCode(codes, ['status_not_eligible'])) addReason(DATA_TRUST_REASONS.STATUS_NOT_ELIGIBLE);
  if (hasAnyCode(codes, ['temporal', 'date_before_period', 'date_after_period', 'date_in_future', 'date_invalid'])) addReason(DATA_TRUST_REASONS.TEMPORAL_INVALID);
  if (hasAnyCode(codes, ['scale', 'range', 'risk_axis_invalid', 'maturity_level_scale_invalid'])) addReason(DATA_TRUST_REASONS.SCALE_UNIT_INVALID);
  if (hasAnyCode(codes, ['required_missing'])) addReason(DATA_TRUST_REASONS.MISSING_REQUIRED_FIELDS);
  if (hasAnyCode(codes, ['duplicate_natural_key', 'reference_invalid'])) addReason(DATA_TRUST_REASONS.CONSISTENCY_ISSUES);

  const provenanceMissing = [
    provenance.source_code || sourceSnapshot?.source_code || contract?.source_code,
    provenance.formula_code || sourceSnapshot?.formula_code || formula?.formula_code,
    provenance.contract_checksum || sourceSnapshot?.contract_checksum || contract?.checksum,
    counts && received !== null && usable !== null,
  ].some((value) => !value);
  const hasPhysicalDataWithoutSource = received !== null && received > 0 && !(physicalSources?.length || sourceSnapshot?.physical_sources?.length);
  if (provenanceMissing || hasPhysicalDataWithoutSource) {
    state = worseState(state, sourceFailure ? DATA_TRUST_STATES.UNTRUSTED : DATA_TRUST_STATES.LOW_CONFIDENCE);
    addReason(DATA_TRUST_REASONS.PROVENANCE_INCOMPLETE);
  }

  const sourceValidityReasons = [];
  if (sourceFailure) sourceValidityReasons.push(sourceStatus === 'source_incompatible' ? DATA_TRUST_REASONS.SOURCE_INCOMPATIBLE : DATA_TRUST_REASONS.SOURCE_UNAVAILABLE);
  if (contractMissing) sourceValidityReasons.push(DATA_TRUST_REASONS.SOURCE_CONTRACT_INVALID);
  const validationReasonSet = unique(reasons);
  const temporalClassifications = validation?.temporal_summary?.classifications || sourceSnapshot?.temporal_summary?.classifications || null;
  const statusClassifications = validation?.status_summary?.classifications || sourceSnapshot?.status_summary?.classifications || null;
  const dimensions = {
    source_validity: dimension(sourceValidityReasons.length ? DATA_TRUST_DIMENSION_STATUS.FAIL : DATA_TRUST_DIMENSION_STATUS.PASS, sourceValidityReasons, { source_status: sourceStatus, source_code: contract?.source_code || provenance.source_code || null }),
    completeness: dimension(received === 0 ? DATA_TRUST_DIMENSION_STATUS.NOT_APPLICABLE : (excluded !== null && excluded > 0 ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS), hasAnyCode(codes, ['required_missing']) ? [DATA_TRUST_REASONS.MISSING_REQUIRED_FIELDS] : [], { received, usable, excluded }),
    population_sufficiency: dimension(usable !== null && usable >= requiredPopulation ? DATA_TRUST_DIMENSION_STATUS.PASS : DATA_TRUST_DIMENSION_STATUS.FAIL, usable !== null && usable >= requiredPopulation ? [] : [DATA_TRUST_REASONS.INSUFFICIENT_POPULATION], { required_population: requiredPopulation, usable }),
    field_validity: dimension(hasAnyCode(codes, ['required_missing', 'range', 'scale', 'risk_axis_invalid', 'maturity_level_scale_invalid']) ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS, validationReasonSet.filter((reason) => [DATA_TRUST_REASONS.MISSING_REQUIRED_FIELDS, DATA_TRUST_REASONS.SCALE_UNIT_INVALID].includes(reason)), { issue_codes: codes }),
    temporal_validity: dimension(hasAnyCode(codes, ['temporal', 'date_before_period', 'date_after_period', 'date_in_future', 'date_invalid']) ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS, validationReasonSet.filter((reason) => reason === DATA_TRUST_REASONS.TEMPORAL_INVALID), { classifications: Array.isArray(temporalClassifications) ? temporalClassifications.length : null }),
    status_validity: dimension(hasAnyCode(codes, ['status_unmapped', 'status_not_eligible']) ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS, validationReasonSet.filter((reason) => [DATA_TRUST_REASONS.STATUS_UNMAPPED, DATA_TRUST_REASONS.STATUS_NOT_ELIGIBLE].includes(reason)), { classifications: Array.isArray(statusClassifications) ? statusClassifications.length : null }),
    scale_unit_validity: dimension(hasAnyCode(codes, ['scale', 'range', 'risk_axis_invalid', 'maturity_level_scale_invalid']) || hasAnyCode(warningCodes, ['unit_mismatch', 'currency_mismatch']) ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS, validationReasonSet.filter((reason) => reason === DATA_TRUST_REASONS.SCALE_UNIT_INVALID), { issue_codes: codes, warning_codes: warningCodes }),
    consistency: dimension(hasAnyCode(codes, ['duplicate_natural_key', 'reference_invalid']) ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS, validationReasonSet.filter((reason) => reason === DATA_TRUST_REASONS.CONSISTENCY_ISSUES), { issue_codes: codes }),
    fallback_dependency: dimension(fallbackSummary?.fallback_used === true ? DATA_TRUST_DIMENSION_STATUS.WARNING : DATA_TRUST_DIMENSION_STATUS.PASS, fallbackSummary?.fallback_used === true ? [DATA_TRUST_REASONS.FALLBACK_USED] : [], fallbackSummary || {}),
    provenance_completeness: dimension(provenanceMissing || hasPhysicalDataWithoutSource ? DATA_TRUST_DIMENSION_STATUS.FAIL : DATA_TRUST_DIMENSION_STATUS.PASS, provenanceMissing || hasPhysicalDataWithoutSource ? [DATA_TRUST_REASONS.PROVENANCE_INCOMPLETE] : [], { has_snapshot_payload: Boolean(sourceSnapshot), physical_sources: physicalSources || sourceSnapshot?.physical_sources || [] }),
  };

  return Object.freeze({
    model_version: DATA_TRUST_MODEL_VERSION,
    state,
    reasons: unique(reasons),
    thresholds: DATA_TRUST_MODEL_THRESHOLDS,
    dimensions,
    evidence: {
      source_status: sourceStatus,
      counts: { received, eligible, usable, excluded, population_size: asCount(counts?.population_size) },
      exclusion_ratio: exclusionRatio,
      fallback_used: fallbackSummary?.fallback_used === true,
      fallback_reason: fallbackSummary?.fallback_reason || null,
      primary_state: fallbackSummary?.primary_state || null,
      issue_codes: codes,
      warning_codes: warningCodes,
    },
  });
}

module.exports = {
  DATA_TRUST_MODEL_VERSION,
  DATA_TRUST_STATES,
  DATA_TRUST_DIMENSION_STATUS,
  DATA_TRUST_REASONS,
  DATA_TRUST_MODEL_THRESHOLDS,
  assessDataTrust,
};
