'use strict';

const assert = require('node:assert/strict');
const { normalizeIsoCode, isoQueryAliases, isSoAStandard } = require('./isoStandards');
const {
  normalizeSoAPayload,
  validateSoAState,
  buildSoAInconsistencies,
} = require('./soaValidation');
const { buildSoAMetrics } = require('./soaMetrics');

function runTests() {
  assert.equal(normalizeIsoCode('ISO/IEC 27701'), 'ISO27701');
  assert.equal(normalizeIsoCode('iso/iec27017'), 'ISO27017');
  assert.equal(isSoAStandard('ISO/IEC 27018'), true);
  assert.ok(isoQueryAliases('ISO27001').includes('ISO/IEC 27001'));

  const notApplicable = normalizeSoAPayload({
    applicable: false,
    implementation_status: 'implementado',
    justification: 'Fuera de alcance operativo.',
  });
  assert.equal(notApplicable.implementation_status, 'no aplica');
  assert.equal(validateSoAState(notApplicable).ok, true);

  const invalid = validateSoAState({
    applicable: false,
    implementation_status: 'no aplica',
    justification: '',
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((item) => item.includes('justificacion')));

  const implementedWithoutValidEvidence = buildSoAInconsistencies({
    applicable: true,
    implementation_status: 'implementado',
    valid_evidence_count: 0,
    rejected_evidence_count: 1,
    expired_evidence_count: 1,
    owner: '',
    review_date: null,
  });
  assert.ok(implementedWithoutValidEvidence.includes('IMPLEMENTED_WITHOUT_VALID_EVIDENCE'));
  assert.ok(implementedWithoutValidEvidence.includes('IMPLEMENTED_WITH_REJECTED_EVIDENCE'));
  assert.ok(implementedWithoutValidEvidence.includes('IMPLEMENTED_WITH_EXPIRED_EVIDENCE'));
  assert.ok(implementedWithoutValidEvidence.includes('MISSING_OWNER_FOR_APPLICABLE'));

  const metrics = buildSoAMetrics([
    { applicable: true, implementation_status: 'implementado', valid_evidence_count: 1, owner: 'SGSI', review_date: '2999-01-01' },
    { applicable: false, implementation_status: 'no aplica', justification: 'No aplica al servicio.', high_or_critical_risk_count: 1 },
    { applicable: true, implementation_status: 'parcial', expired_evidence_count: 1, owner: 'TI', review_date: '2999-01-01' },
  ]);
  assert.equal(metrics.total_controls, 3);
  assert.equal(metrics.applicable_count, 2);
  assert.equal(metrics.implemented_applicable_count, 1);
  assert.equal(metrics.implementation_coverage_pct, 50);
  assert.equal(metrics.not_applicable_justified_count, 1);
  assert.equal(metrics.controls_with_valid_evidence_count, 1);
  assert.equal(metrics.controls_with_expired_evidence_count, 1);
  assert.equal(metrics.controls_with_high_or_critical_risk_count, 1);
  assert.equal(metrics.inconsistency_count, 1);
}

runTests();
console.log('soaValidation tests OK');
