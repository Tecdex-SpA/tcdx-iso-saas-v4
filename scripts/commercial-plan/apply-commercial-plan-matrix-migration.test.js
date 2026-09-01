'use strict';

const assert = require('node:assert/strict');
const { _private } = require('./apply-commercial-plan-matrix-migration');

function row(capabilityKey, actualClassification) {
  return {
    capability_key: capabilityKey,
    actual_classification: actualClassification,
  };
}

function permissionRow(capabilityKey, actualRequiredPermission) {
  return {
    capability_key: capabilityKey,
    actual_required_permission: actualRequiredPermission,
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

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('ai.compliance', 'ai_compliance.read')]),
  [],
  'ai.compliance historical permission remains valid before NORMALIZATION-01',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([permissionRow('ai.compliance', 'ai_compliance.read')]),
  ['ai.compliance'],
  'ai.compliance historical permission is reported as accepted evolution compatibility',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('ai.compliance', 'ai.view')]),
  [],
  'ai.compliance evolved permission remains valid after NORMALIZATION-01',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([permissionRow('ai.compliance', 'ai.view')]),
  [],
  'ai.compliance evolved permission is not reported as historical compatibility',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('ai.compliance', 'arbitrary.permission')]),
  ['ai.compliance'],
  'ai.compliance arbitrary permission drift must fail',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('iso.actions', 'actions.read')]),
  [],
  'iso.actions historical permission remains valid before NORMALIZATION-01',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([permissionRow('iso.actions', 'actions.read')]),
  ['iso.actions'],
  'iso.actions historical permission is reported as accepted evolution compatibility',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('iso.actions', 'actions.view')]),
  [],
  'iso.actions evolved permission remains valid after NORMALIZATION-01',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([permissionRow('iso.actions', 'actions.view')]),
  [],
  'iso.actions evolved permission is not reported as historical compatibility',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('iso.actions', 'arbitrary.permission')]),
  ['iso.actions'],
  'iso.actions arbitrary permission drift must fail',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('metrics.catalog', 'arbitrary.permission')]),
  ['metrics.catalog'],
  'another capability with permission drift must fail',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('core.dashboard', null)]),
  ['core.dashboard'],
  'unexpected null permission drift must fail',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([permissionRow('new.capability', 'ai.view')]),
  ['new.capability'],
  'unknown capability permission compatibility must fail closed',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([
    permissionRow('ai.compliance', 'ai_compliance.read'),
    permissionRow('iso.actions', 'actions.read'),
  ]),
  [],
  'both historical permissions may coexist before NORMALIZATION-01',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([
    permissionRow('ai.compliance', 'ai_compliance.read'),
    permissionRow('iso.actions', 'actions.read'),
  ]),
  ['ai.compliance', 'iso.actions'],
  'both historical permissions are reported as accepted compatibility',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([
    permissionRow('ai.compliance', 'ai.view'),
    permissionRow('iso.actions', 'actions.view'),
  ]),
  [],
  'both evolved permissions may coexist after NORMALIZATION-01',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([
    permissionRow('ai.compliance', 'ai.view'),
    permissionRow('iso.actions', 'actions.view'),
  ]),
  [],
  'both evolved permissions do not require compatibility reporting',
);

assert.deepEqual(
  _private.findCatalogPermissionDrift([
    permissionRow('ai.compliance', 'ai_compliance.read'),
    permissionRow('iso.actions', 'actions.view'),
  ]),
  [],
  'mixed historical/evolved permissions may coexist during staged deploy',
);

assert.deepEqual(
  _private.findAcceptedCatalogPermissionEvolution([
    permissionRow('ai.compliance', 'ai_compliance.read'),
    permissionRow('iso.actions', 'actions.view'),
  ]),
  ['ai.compliance'],
  'only historical rows in a mixed state are reported as accepted compatibility',
);

process.stdout.write('COMMERCIAL_PLAN_RUNNER_CLASSIFICATION_EVOLUTION_TEST_PASS\n');
process.stdout.write('COMMERCIAL_PLAN_RUNNER_PERMISSION_EVOLUTION_TEST_PASS\n');
