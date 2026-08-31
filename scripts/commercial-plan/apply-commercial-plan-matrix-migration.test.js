'use strict';

const assert = require('node:assert/strict');
const { _private } = require('./apply-commercial-plan-matrix-migration');

function row(capabilityKey, actualClassification) {
  return {
    capability_key: capabilityKey,
    actual_classification: actualClassification,
  };
}

assert.deepEqual(
  _private.findCatalogClassificationDrift([
    row('ai.auditor', 'GRC_ADVANCED'),
    row('ai.compliance', 'GRC_ADVANCED'),
  ]),
  [],
  'historical AI classification remains valid for the historical runner',
);

assert.deepEqual(
  _private.findCatalogClassificationDrift([row('ai.auditor', 'AI_ADDON')]),
  [],
  'ai.auditor may evolve from GRC_ADVANCED to AI_ADDON',
);

assert.deepEqual(
  _private.findCatalogClassificationDrift([row('ai.compliance', 'AI_ADDON')]),
  [],
  'ai.compliance may evolve from GRC_ADVANCED to AI_ADDON',
);

assert.deepEqual(
  _private.findCatalogClassificationDrift([row('metrics.catalog', 'ISO_ONLY')]),
  ['metrics.catalog'],
  'non-AI classification drift must still fail',
);

assert.deepEqual(
  _private.findCatalogClassificationDrift([row('ai.auditor', 'OPERATIONAL_RISK_EXTENSION')]),
  ['ai.auditor'],
  'arbitrary ai.* classification drift must still fail',
);

assert.deepEqual(
  _private.findAcceptedCatalogClassificationEvolution([
    row('ai.auditor', 'AI_ADDON'),
    row('ai.compliance', 'AI_ADDON'),
    row('metrics.catalog', 'GRC_ADVANCED'),
  ]),
  ['ai.auditor', 'ai.compliance'],
  'only the exact AI add-on evolution is reported as accepted',
);

process.stdout.write('COMMERCIAL_PLAN_RUNNER_CLASSIFICATION_EVOLUTION_TEST_PASS\n');
