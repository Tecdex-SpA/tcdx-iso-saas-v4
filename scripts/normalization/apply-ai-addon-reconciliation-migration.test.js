'use strict';

const assert = require('node:assert/strict');
const { _private } = require('./apply-ai-addon-reconciliation-migration');

const migration = Object.freeze({ checksum: 'expected-checksum' });

const correctState = Object.freeze({
  ai_addon_ready: true,
  ai_capabilities_ready: 2,
  ai_capabilities_historical_classification: 0,
  base_plans_do_not_include_ai: true,
  base_plan_ai_capabilities: 0,
  enterprise_ai_compliance_included: false,
  compatible_standard_plan_versions: 3,
  standard_plan_versions: 3,
});

const historicalReapplyState = Object.freeze({
  ai_addon_ready: true,
  ai_capabilities_ready: 0,
  ai_capabilities_historical_classification: 2,
  base_plans_do_not_include_ai: false,
  base_plan_ai_capabilities: 2,
  enterprise_ai_compliance_included: true,
  compatible_standard_plan_versions: 3,
  standard_plan_versions: 3,
});

assert.equal(
  _private.migrationStateFromRows([{ checksum: migration.checksum, status: 'applied' }], migration),
  'already_applied',
  'matching applied reconciliation ledger is already_applied',
);

assert.equal(
  _private.migrationStateFromRows([{ checksum: 'bad-checksum', status: 'applied' }], migration),
  'checksum_mismatch',
  'checksum mismatch must fail fast',
);

assert.equal(
  _private.migrationStateFromRows([], migration),
  'pending',
  'missing reconciliation ledger is pending',
);

assert.equal(
  _private.isPostconditionSatisfied(correctState),
  true,
  'already reconciled state satisfies postconditions',
);

assert.equal(
  _private.isKnownHistoricalReapplyState(correctState),
  false,
  'already reconciled state does not require repair',
);

assert.equal(
  _private.isKnownHistoricalReapplyState(historicalReapplyState),
  true,
  'known historical reapply state is explicitly recognized',
);

assert.doesNotThrow(
  () => _private.assertPreflightState(correctState),
  'reconciliation preflight accepts already correct state',
);

assert.doesNotThrow(
  () => _private.assertPreflightState(historicalReapplyState),
  'reconciliation preflight accepts the known repairable historical reapply state',
);

assert.throws(
  () => _private.assertPostconditions(historicalReapplyState),
  /postcondition failed/,
  'repairable historical state is not accepted as postcondition complete',
);

assert.throws(
  () => _private.assertPreflightState({
    ...historicalReapplyState,
    ai_capabilities_historical_classification: 1,
  }),
  /unsupported state/,
  'partial AI classification drift fails closed',
);

assert.throws(
  () => _private.assertPreflightState({
    ...historicalReapplyState,
    ai_addon_ready: false,
  }),
  /unsupported state/,
  'missing AI add-on fails closed',
);

assert.throws(
  () => _private.assertPreflightState({
    ...historicalReapplyState,
    compatible_standard_plan_versions: 2,
  }),
  /unsupported state/,
  'incomplete plan add-on compatibility fails closed',
);

assert.throws(
  () => _private.assertPreflightState({
    ...historicalReapplyState,
    enterprise_ai_compliance_included: false,
  }),
  /unsupported state/,
  'unrecognized base-plan drift fails closed',
);

process.stdout.write('AI_ADDON_RECONCILIATION_RUNNER_TEST_PASS\n');
