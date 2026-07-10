'use strict';

const CANONICAL_IMPLEMENTATION_STATUSES = ['pendiente', 'parcial', 'implementado', 'no aplica'];

const STATUS_ALIASES = new Map([
  ['pendiente', 'pendiente'],
  ['pending', 'pendiente'],
  ['no implementado', 'pendiente'],
  ['no_implementado', 'pendiente'],
  ['not implemented', 'pendiente'],
  ['parcial', 'parcial'],
  ['partial', 'parcial'],
  ['implementado', 'implementado'],
  ['implemented', 'implementado'],
  ['cumple', 'implementado'],
  ['no aplica', 'no aplica'],
  ['no_aplica', 'no aplica'],
  ['not applicable', 'no aplica'],
  ['n/a', 'no aplica'],
  ['na', 'no aplica'],
]);

function normalizeImplementationStatus(value, fallback = 'pendiente') {
  const normalized = String(value || '').trim().toLowerCase();
  return STATUS_ALIASES.get(normalized) || fallback;
}

function normalizeApplicable(value, fallback = null) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'aplica', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no', 'no aplica', 'n/a', 'na'].includes(normalized)) return false;
  return fallback;
}

function normalizeSoAPayload(input = {}, current = {}) {
  const applicable = Object.prototype.hasOwnProperty.call(input, 'applicable')
    ? normalizeApplicable(input.applicable, null)
    : normalizeApplicable(current.applicable, null);

  let implementationStatus = Object.prototype.hasOwnProperty.call(input, 'implementation_status')
    ? normalizeImplementationStatus(input.implementation_status)
    : normalizeImplementationStatus(current.implementation_status);

  const justification = Object.prototype.hasOwnProperty.call(input, 'justification')
    ? nullableText(input.justification)
    : nullableText(current.justification);
  const notes = Object.prototype.hasOwnProperty.call(input, 'notes')
    ? nullableText(input.notes)
    : nullableText(current.notes);
  const owner = Object.prototype.hasOwnProperty.call(input, 'owner')
    ? nullableText(input.owner)
    : nullableText(current.owner);
  const reviewDate = Object.prototype.hasOwnProperty.call(input, 'review_date')
    ? nullableDate(input.review_date)
    : nullableDate(current.review_date);

  if (applicable === false) {
    implementationStatus = 'no aplica';
  }

  if (applicable === true && implementationStatus === 'no aplica') {
    implementationStatus = 'pendiente';
  }

  return {
    applicable,
    implementation_status: implementationStatus,
    justification,
    notes,
    owner,
    review_date: reviewDate,
  };
}

function nullableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function validateSoAState(state) {
  const errors = [];
  const applicable = normalizeApplicable(state.applicable, null);
  const implementationStatus = normalizeImplementationStatus(state.implementation_status);
  const justification = String(state.justification || '').trim();

  if (!CANONICAL_IMPLEMENTATION_STATUSES.includes(implementationStatus)) {
    errors.push('implementation_status invalido');
  }

  if (applicable === false && !justification) {
    errors.push('applicable=false exige justificacion');
  }

  if (applicable === false && implementationStatus !== 'no aplica') {
    errors.push('applicable=false exige implementation_status=no aplica');
  }

  if (applicable === true && implementationStatus === 'no aplica') {
    errors.push('applicable=true no permite implementation_status=no aplica');
  }

  if (applicable === true && !CANONICAL_IMPLEMENTATION_STATUSES.includes(implementationStatus)) {
    errors.push('applicable=true exige estado valido');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function isValidEvidenceSignal(row) {
  return Number(row.valid_evidence_count || 0) > 0;
}

function buildSoAInconsistencies(row, today = new Date().toISOString().slice(0, 10)) {
  const issues = [];
  const applicable = normalizeApplicable(row.applicable, null);
  const implementationStatus = normalizeImplementationStatus(row.implementation_status);
  const justification = String(row.justification || '').trim();
  const hasValidEvidence = isValidEvidenceSignal(row);
  const rejectedEvidence = Number(row.rejected_evidence_count || 0);
  const expiredEvidence = Number(row.expired_evidence_count || 0);
  const highRisk = Number(row.high_or_critical_risk_count || 0);
  const openFindings = Number(row.open_findings_count || 0);
  const openNc = Number(row.open_nonconformities_count || 0);
  const overdueActions = Number(row.overdue_actions_count || 0);
  const owner = String(row.owner || '').trim();
  const reviewDate = row.review_date ? String(row.review_date).slice(0, 10) : '';

  if (applicable === false && !justification) issues.push('NOT_APPLICABLE_WITHOUT_JUSTIFICATION');
  if (applicable === false && ['implementado', 'parcial'].includes(implementationStatus)) issues.push('NOT_APPLICABLE_IMPLEMENTED');
  if (applicable === true && implementationStatus === 'no aplica') issues.push('APPLICABLE_WITH_NO_APPLIES_STATUS');
  if (applicable === true && implementationStatus === 'implementado' && !hasValidEvidence) issues.push('IMPLEMENTED_WITHOUT_VALID_EVIDENCE');
  if (applicable === true && implementationStatus === 'implementado' && rejectedEvidence > 0) issues.push('IMPLEMENTED_WITH_REJECTED_EVIDENCE');
  if (applicable === true && implementationStatus === 'implementado' && expiredEvidence > 0) issues.push('IMPLEMENTED_WITH_EXPIRED_EVIDENCE');
  if (applicable === false && highRisk > 0) issues.push('NOT_APPLICABLE_WITH_HIGH_RISK');
  if (implementationStatus === 'implementado' && openNc > 0) issues.push('COMPLIANT_WITH_OPEN_NC');
  if (implementationStatus === 'implementado' && overdueActions > 0) issues.push('COMPLIANT_WITH_OVERDUE_ACTION');
  if (applicable === true && !owner) issues.push('MISSING_OWNER_FOR_APPLICABLE');
  if (!reviewDate) issues.push('REVIEW_MISSING');
  if (reviewDate && reviewDate < today) issues.push('REVIEW_OVERDUE');
  if (implementationStatus === 'implementado' && openFindings > 0) issues.push('COMPLIANT_WITH_OPEN_FINDING');

  return issues;
}

module.exports = {
  CANONICAL_IMPLEMENTATION_STATUSES,
  normalizeImplementationStatus,
  normalizeApplicable,
  normalizeSoAPayload,
  validateSoAState,
  buildSoAInconsistencies,
};
